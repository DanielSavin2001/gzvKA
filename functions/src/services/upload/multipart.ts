/**
 * Collects the files out of a multipart upload.
 *
 * Split out of `imageService` for two reasons. It is the half of uploading that has no
 * Firebase dependency, so it can be unit-tested with no credentials - and it returns a
 * promise, which is what lets the request handler wait for the upload to finish before it
 * answers. Previously the parse was fire-and-forget: `busboy.end()` was called and the
 * handler returned immediately, so the HTTP 200 was sent before a single byte reached
 * storage, and any error thrown while storing became an unhandled rejection instead of a
 * failed request. On Cloud Functions an instance may be frozen once it has responded, so
 * that pattern can silently lose an upload.
 *
 * Pure with respect to Firebase: imports only busboy and the logger.
 */

import { IncomingHttpHeaders } from 'http';
import * as Busboy from 'busboy';
import * as logger from 'firebase-functions/logger';

import { FileData, FileDataFields } from '../../../../sharedModels/interfaces';

/** How large a single upload may be before it is rejected, in bytes. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Raised when the client sent something we will not store. */
export class UploadValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UploadValidationError';
	}
}

/**
 * Parses a multipart request body and resolves once every file has been read in full.
 *
 * @param headers The request headers, which carry the multipart boundary.
 * @param body The raw request body.
 * @returns Every file in the request, in the order they appeared.
 *
 * @throws {UploadValidationError} if the request contains no files, or a file exceeds
 * {@link MAX_FILE_BYTES}.
 */
export function collectFiles(
	headers: IncomingHttpHeaders,
	body: Buffer | string
): Promise<FileData[]> {
	return new Promise<FileData[]>((resolve, reject) => {
		let busboy: Busboy.Busboy;

		try {
			busboy = Busboy({ headers, limits: { fileSize: MAX_FILE_BYTES } });
		} catch (error) {
			// A missing or malformed content-type throws synchronously.
			reject(new UploadValidationError(`Could not read the upload: ${error}`));
			return;
		}

		const files: FileData[] = [];
		let settled = false;

		const fail = (error: Error): void => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		busboy.on('file', (fieldName: string, file: NodeJS.ReadableStream, fields: FileDataFields) => {
			const chunks: Buffer[] = [];

			file.on('data', (chunk: Buffer) => chunks.push(chunk));

			// busboy signals the size limit on the file stream, not on the request.
			file.on('limit', () =>
				fail(
					new UploadValidationError(
						`"${fields?.filename}" is larger than the ${Math.round(
							MAX_FILE_BYTES / (1024 * 1024)
						)} MB limit.`
					)
				)
			);

			file.on('error', (error: Error) => fail(error));

			file.on('end', () => {
				files.push({ fieldName, fields, buffer: Buffer.concat(chunks) });
				logger.log(`Read uploaded file: ${fields?.filename}`);
			});
		});

		busboy.on('error', (error: unknown) =>
			fail(error instanceof Error ? error : new Error(String(error)))
		);

		busboy.on('finish', () => {
			if (settled) return;

			if (files.length === 0) {
				fail(new UploadValidationError('No files were uploaded.'));
				return;
			}

			settled = true;
			resolve(files);
		});

		busboy.end(body);
	});
}
