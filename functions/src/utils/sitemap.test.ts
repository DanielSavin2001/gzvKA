import { escapeXml, renderRobots, renderSitemap, sitemapUrl } from './sitemap';

const SITE = 'https://gzvka.com';

describe('sitemapUrl', () => {
	it('keeps an ordinary slug as it is', () => {
		expect(sitemapUrl(SITE, '/foto/akkerstraat-1')).toBe('https://gzvka.com/foto/akkerstraat-1');
	});

	it('encodes each segment without eating the slashes', () => {
		expect(sitemapUrl(SITE, '/straat/sint-jozef')).toBe('https://gzvka.com/straat/sint-jozef');
		expect(sitemapUrl(SITE, '/verhaal/café-pancras')).toBe(
			'https://gzvka.com/verhaal/caf%C3%A9-pancras'
		);
	});

	it('encodes the characters that would otherwise end the URL early', () => {
		// 26 photographs in the archive have an "&" in their filename. A raw one here makes
		// the rest of the path a query string.
		expect(sitemapUrl(SITE, '/foto/engel-&-voelkers-1')).toBe(
			'https://gzvka.com/foto/engel-%26-voelkers-1'
		);
		expect(sitemapUrl(SITE, '/foto/a b')).toBe('https://gzvka.com/foto/a%20b');
		expect(sitemapUrl(SITE, '/foto/x#y')).toBe('https://gzvka.com/foto/x%23y');
		expect(sitemapUrl(SITE, '/foto/x?y')).toBe('https://gzvka.com/foto/x%3Fy');
	});

	it('produces something the URL parser accepts', () => {
		for (const slug of [
			'engel-&-voelkers',
			'post-+-autobus',
			'school,-klooster',
			"café-'t-hoekske"
		]) {
			expect(() => new URL(sitemapUrl(SITE, `/foto/${slug}`))).not.toThrow();
		}
	});
});

describe('escapeXml', () => {
	it('escapes all five', () => {
		expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
	});

	it('escapes the ampersand first, so an escape is not escaped twice', () => {
		expect(escapeXml('a & b < c')).toBe('a &amp; b &lt; c');
		expect(escapeXml('a &amp; b')).toBe('a &amp;amp; b');
	});
});

describe('renderSitemap', () => {
	const entries = [
		{ path: '/', priority: 1.0, changefreq: 'weekly' as const },
		{ path: '/foto/engel-&-voelkers-1', priority: 0.6, changefreq: 'yearly' as const }
	];

	it('wraps the entries in a urlset', () => {
		const xml = renderSitemap(SITE, entries);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
		expect(xml.match(/<url>/g)).toHaveLength(2);
	});

	it('leaves no raw ampersand anywhere in the file', () => {
		// The one failure mode that costs the whole sitemap rather than one URL.
		const xml = renderSitemap(SITE, entries);
		expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
	});

	it('writes the priority with one decimal, which is what the schema expects', () => {
		expect(renderSitemap(SITE, entries)).toContain('<priority>1.0</priority>');
		expect(renderSitemap(SITE, entries)).toContain('<priority>0.6</priority>');
	});
});

describe('renderRobots', () => {
	const robots = renderRobots(SITE);

	it('points at the sitemap', () => {
		expect(robots).toContain('Sitemap: https://gzvka.com/sitemap.xml');
	});

	it('keeps the curator queue and the empty shell out', () => {
		expect(robots).toContain('Disallow: /beheer');
		expect(robots).toContain('Disallow: /200');
	});

	it('lets everything else be crawled', () => {
		expect(robots).toContain('Allow: /');
		// A blanket disallow here would take the whole archive out of search, which is the
		// opposite of the point.
		expect(robots).not.toMatch(/^Disallow: \/$/m);
	});
});
