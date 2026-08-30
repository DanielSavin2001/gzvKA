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
