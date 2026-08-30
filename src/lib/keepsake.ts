/**
 * Taking a photograph away with you: saving it, or sending it to somebody.
 *
 * The two things a visitor most obviously wants from a family archive and could not do.
 * Somebody finds their grandparents' house and the only way to keep it was a long-press on
 * a WebP with a filename nobody would recognise.
 */

/**
 * A filename a person would recognise in their downloads folder.
 *
 * Not the corpus path: `Akkerstraat 1 - Onroerend Erfgoed - zd.jpg.thumb.webp` says
 * nothing to anybody. The photograph's title, the year when there is one, and `gzvKA` so
 * that in five years the file still says where it came from.
 */
export function keepsakeName(title: string, year?: string, extension = 'webp'): string {
	const clean = title
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return `${[clean || 'foto', year, 'gzvKA'].filter(Boolean).join(' - ')}.${extension}`;
}

/** The extension of whatever the browser actually loaded, so the file opens. */
export function extensionOf(url: string): string {
	const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
	return match ? match[1].toLowerCase() : 'webp';
}

/**
 * The format to hand somebody, taken from the format the archive holds.
 *
 * The site serves WebP because it is half the bytes, but a saved file is not a page: it
 * goes into a downloads folder and gets opened years later by whatever is on that machine,
 * emailed to a cousin, printed at a shop. WebP is a bad guest there. So a download is
 * re-encoded to what the original actually is.
 *
 * The corpus is 4,081 JPEGs, 411 PNGs and 12 .jpeg - no GIFs, nothing animated - so this
 * is a two-way choice and not a general format table. PNG stays PNG because some of those
 * are scans and maps where a JPEG's ringing shows; everything else becomes a JPEG, which
 * is both what it already was and the one format that opens anywhere.
 */
export function originalFormat(corpusPath: string): { extension: string; mime: string } {
	return /\.png$/i.test(corpusPath)
		? { extension: 'png', mime: 'image/png' }
		: { extension: 'jpg', mime: 'image/jpeg' };
}

/**
 * What became of a save.
 *
 * Three outcomes rather than a boolean, because two of the failures need opposite
 * handling. `unconvertible` means the bytes were a real photograph that could not be
 * re-encoded - a blocked canvas, no `toBlob` - and handing them over unchanged is a fine
 * answer. `not-an-image` means the server did not send a photograph at all, and handing
 * *those* bytes over is the exact bug this function exists to prevent: a static host
 * answers a missing file with the site's own HTML, so the fallback would save a web page
 * renamed `.jpg`.
 */
export type SaveOutcome = 'saved' | 'unconvertible' | 'not-an-image';

/**
 * Saves what is on screen, converted to `mime`.
 *
 * A plain `<a download>` would hand over the WebP the page happens to be showing. This
 * draws it into a canvas and re-encodes instead. Same origin, so the canvas is not tainted
 * and `toBlob` is allowed.
 */
export async function saveConverted(
	source: string,
	filename: string,
	mime: string
): Promise<SaveOutcome> {
	let blob: Blob;
	try {
		const response = await fetch(source);
		if (!response.ok) return 'not-an-image';

		blob = await response.blob();
		// The guard that matters: a static host answers a missing path with its own HTML,
		// and 200 OK on a page is not a photograph.
		if (!blob.type.startsWith('image/')) return 'not-an-image';
	} catch {
		return 'not-an-image';
	}

	const objectUrl = URL.createObjectURL(blob);
	try {
		const image = new Image();
		image.src = objectUrl;
		await image.decode();

		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;

		const context = canvas.getContext('2d');
		if (!context) return 'unconvertible';

		// JPEG has no alpha, so a transparent PNG would composite onto black. White is
		// what a scan's transparent margin is meant to be.
		if (mime === 'image/jpeg') {
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, canvas.width, canvas.height);
		}
		context.drawImage(image, 0, 0);

		const converted = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, mime, 0.92)
		);
		if (!converted) return 'unconvertible';

		download(URL.createObjectURL(converted), filename, true);
		return 'saved';
	} catch {
		// Decoding failed on bytes that claimed to be an image. Whatever they are, they are
		// not something to hand somebody as their grandparents' house.
		return 'not-an-image';
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

/** Clicks an invisible link, which is still the only way to name a downloaded file. */
export function download(href: string, filename: string, revoke = false): void {
	const anchor = document.createElement('a');
	anchor.href = href;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();

	// Revoked on the next turn of the loop: revoking synchronously races the download in
	// Firefox and hands over an empty file.
	if (revoke) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * What the visitor is actually looking at.
 *
 * Deliberately `currentSrc` rather than the larger copy's URL. The deploy carries
 * thumbnails only - both sizes together come to 443 MB and hosting keeps every version -
 * so the page asks for the 1400 px file and quietly falls back when it is not there. A
 * download button pointed at the larger copy would hand people a 404 on the live site
 * while working perfectly here. `currentSrc` is whichever one really loaded.
 */
export function loadedSource(image: HTMLImageElement | null | undefined): string | null {
	if (!image) return null;
	return image.currentSrc || image.src || null;
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Hand the page to somebody else.
 *
 * `navigator.share` opens the phone's own sheet, which is where WhatsApp is - and WhatsApp
 * is how this archive actually travels around Kapellen. Desktop browsers mostly lack it,
 * so the fallback copies the address instead; both are a real answer, which is why the
 * caller is told which happened rather than being left to guess.
 */
export async function shareOrCopy(share: {
	title: string;
	text?: string;
	url: string;
}): Promise<ShareOutcome> {
	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		try {
			await navigator.share(share);
			return 'shared';
		} catch (error) {
			// Dismissing the sheet throws `AbortError`. That is somebody changing their mind,
			// not a failure, and it must not fall through to copying a link they did not ask
			// for or shouting an error at them.
			if (error instanceof Error && error.name === 'AbortError') return 'shared';
		}
	}

	try {
		await navigator.clipboard.writeText(share.url);
		return 'copied';
	} catch {
		return 'failed';
	}
}
