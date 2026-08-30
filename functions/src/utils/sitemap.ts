/**
 * Turning archive ids into sitemap entries.
 *
 * Small enough to have lived inside `scripts/build-sitemap.ts`, and it did - but a sitemap
 * is validated as a whole. One badly escaped character and a search engine rejects all
 * 4,731 URLs rather than the one, and nothing about the file looks wrong when you open it.
 * That is worth testing, and testing needs it importable.
 */

/** XML has five characters that cannot appear raw. */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * An absolute URL for a path, encoded segment by segment.
 *
 * The ids are already slugs, but they came out of filenames and the archive has had
 * surprises before - 26 of its photographs have an `&` in their name. Encoding per segment
 * rather than whole keeps the slashes as slashes.
 */
export function sitemapUrl(site: string, pathname: string): string {
	return site + pathname.split('/').map(encodeURIComponent).join('/');
}

export interface SitemapEntry {
	path: string;
	/** How much of the site's attention this page deserves, relative to the others. */
	priority: number;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export function renderSitemap(site: string, entries: SitemapEntry[]): string {
	const body = entries
		.map(
			(entry) =>
				'\t<url>\n' +
				`\t\t<loc>${escapeXml(sitemapUrl(site, entry.path))}</loc>\n` +
				`\t\t<changefreq>${entry.changefreq}</changefreq>\n` +
				`\t\t<priority>${entry.priority.toFixed(1)}</priority>\n` +
				'\t</url>'
		)
		.join('\n');

	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		body +
		'\n</urlset>\n'
	);
}

export function renderRobots(site: string): string {
	return (
		"# The archive is meant to be found. Everything is open except the curator's desk,\n" +
		'# which is behind a sign-in anyway and has nothing to offer a search engine.\n' +
		'User-agent: *\n' +
		'Allow: /\n' +
		'Disallow: /beheer\n' +
		// The client-side shell Firebase serves for the few routes that are not prerendered.
		// It has no content of its own and should not be a search result.
		'Disallow: /200\n' +
		'\n' +
		`Sitemap: ${site}/sitemap.xml\n`
	);
}
