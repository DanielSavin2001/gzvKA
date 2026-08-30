/**
 * The address the archive should be known by.
 *
 * The same site answers on gzvka.com, gzvka-12a9f.web.app and gzvka-12a9f.firebaseapp.com,
 * and every pull request adds another preview host. To a search engine those are three or
 * four copies of 4,700 pages, competing with each other. A canonical link on every page is
 * what says which one is the real address.
 */

export const SITE = 'https://gzvka.com';

export const SITE_NAME = 'gzvKA fotoarchief';

/** Absolute URL for a path on the canonical host. */
export function canonical(pathname: string): string {
	return SITE + (pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname);
}

/**
 * Trimmed to something a search result can show.
 *
 * Google renders about 155 characters and cuts mid-word after that. Cutting at a word
 * boundary here means the visible part always ends cleanly.
 */
export function summarise(text: string, limit = 155): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= limit) return clean;

	const cut = clean.slice(0, limit);
	const lastSpace = cut.lastIndexOf(' ');
	return `${cut.slice(0, lastSpace > 60 ? lastSpace : limit).trimEnd()}…`;
}
