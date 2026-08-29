import { collectFiles, MAX_FILE_BYTES, UploadValidationError } from './multipart';

const BOUNDARY = '----gzvkaTestBoundary';

/** Builds a multipart body the same way a browser's FormData upload does. */
function multipartBody(
	files: Array<{ field?: string; filename: string; contentType: string; content: Buffer | string }>
): { headers: Record<string, string>; body: Buffer } {
	const parts: Buffer[] = [];

	for (const file of files) {
		parts.push(
			Buffer.from(
				`--${BOUNDARY}\r\n` +
					`Content-Disposition: form-data; name="${file.field ?? 'files'}"; filename="${
						file.filename
					}"\r\n` +
					`Content-Type: ${file.contentType}\r\n\r\n`,
				'latin1'
			),
			Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'latin1'),
			Buffer.from('\r\n', 'latin1')
		);
	}

	parts.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'latin1'));

	return {
		headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
		body: Buffer.concat(parts)
	};
}

describe('collectFiles', () => {
	it('resolves with the file once it has been read in full', async () => {
		const { headers, body } = multipartBody([
			{
				filename: 'Dorpsstraat 15 - Swatti Alix - zd.jpg',
				contentType: 'image/jpeg',
				content: 'photo-bytes'
			}
		]);

		const files = await collectFiles(headers, body);

		expect(files).toHaveLength(1);
		expect(files[0].fields.filename).toBe('Dorpsstraat 15 - Swatti Alix - zd.jpg');
		expect(files[0].fields.mimeType).toBe('image/jpeg');
		expect(files[0].buffer.toString('latin1')).toBe('photo-bytes');
	});

	it('resolves only after every file is complete, in order', async () => {
		const { headers, body } = multipartBody([
			{ filename: 'a.jpg', contentType: 'image/jpeg', content: 'first' },
			{ filename: 'b.png', contentType: 'image/png', content: 'second' },
			{ filename: 'c.gif', contentType: 'image/gif', content: 'third' }
		]);

		const files = await collectFiles(headers, body);

		expect(files.map((f) => f.fields.filename)).toEqual(['a.jpg', 'b.png', 'c.gif']);
		expect(files.map((f) => f.buffer.toString('latin1'))).toEqual(['first', 'second', 'third']);
	});

	it('reassembles a file that arrives in several chunks', async () => {
		// A megabyte crosses busboy's internal chunk size, so this exercises the join.
		const content = Buffer.alloc(1024 * 1024, 0x41);
		const { headers, body } = multipartBody([
			{ filename: 'big.jpg', contentType: 'image/jpeg', content }
		]);

		const files = await collectFiles(headers, body);

		expect(files[0].buffer.length).toBe(content.length);
		expect(files[0].buffer.equals(content)).toBe(true);
	});

	it('preserves binary content exactly', async () => {
		const content = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0xff, 0x0d, 0x0a]);
		const { headers, body } = multipartBody([
			{ filename: 'binary.jpg', contentType: 'image/jpeg', content }
		]);

		const files = await collectFiles(headers, body);

		expect(files[0].buffer.equals(content)).toBe(true);
	});

	it('rejects a request that carries no files', async () => {
		const headers = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };
		const body = Buffer.from(`--${BOUNDARY}--\r\n`, 'latin1');

		await expect(collectFiles(headers, body)).rejects.toThrow(UploadValidationError);
		await expect(collectFiles(headers, body)).rejects.toThrow('No files were uploaded.');
	});

	it('rejects a malformed content type instead of hanging', async () => {
		await expect(collectFiles({}, Buffer.from(''))).rejects.toThrow(UploadValidationError);
	});

	it('rejects a file larger than the limit', async () => {
		const oversized = Buffer.alloc(MAX_FILE_BYTES + 1024, 0x41);
		const { headers, body } = multipartBody([
			{ filename: 'huge.jpg', contentType: 'image/jpeg', content: oversized }
		]);

		await expect(collectFiles(headers, body)).rejects.toThrow(UploadValidationError);
	});

	it('always settles, so a request can never hang waiting on it', async () => {
		const { headers, body } = multipartBody([
			{ filename: 'a.jpg', contentType: 'image/jpeg', content: 'x' }
		]);

		// If the promise never settled this would time out rather than fail.
		await expect(
			Promise.race([
				collectFiles(headers, body),
				new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 3000))
			])
		).resolves.toBeDefined();
	});
});
