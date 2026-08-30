/**
 * Telling search engines what is here.
 *
 * The archive has 4,700-odd addresses and, until this existed, no way for anyone to find
 * out: nothing links to an individual photograph from a static page, so a crawler that
 * arrives at the front door can see the home page and essentially nothing else. A sitemap
 * is the list of doors.
 *
 * Generated rather than written, for the same reason the archive index is: a hand-kept list
 * of 4,504 photographs is wrong the day after it is written.
 *
 * Usage, from the repository root:
 *
 *   npm run sitemap
 */

import * as fs from 'fs';
import * as path from 'path';

import type { SitemapEntry } from '../src/utils/sitemap';
import { renderRobots, renderSitemap } from '../src/utils/sitemap';

function findRepoRoot(startDirectory: string): string {
	let current = startDirectory;
	for (;;) {
		if (
			fs.existsSync(path.join(current, 'firebase.json')) &&
			fs.existsSync(path.join(current, 'sharedModels'))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) throw new Error('Could not find the repository root.');
		current = parent;
	}
}

const REPO_ROOT = findRepoRoot(__dirname);
const ARCHIVE_INDEX = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const STORIES = path.join(REPO_ROOT, 'static', 'data', 'stories.json');
const SITEMAP = path.join(REPO_ROOT, 'static', 'sitemap.xml');
const ROBOTS = path.join(REPO_ROOT, 'static', 'robots.txt');

/** Where the archive lives. Every URL in the sitemap has to be absolute and on this host. */
const SITE = 'https://gzvka.com';

function read<T>(file: string): T {
	return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function main(): void {
	const archive = read<{
		photos: { id: string }[];
		places: { id: string; count: number }[];
	}>(ARCHIVE_INDEX);

	const stories = read<{ stories?: { slug: string }[] } | { slug: string }[]>(STORIES);
	const storyList = Array.isArray(stories) ? stories : stories.stories ?? [];

	const entries: SitemapEntry[] = [
		{ path: '/', priority: 1.0, changefreq: 'weekly' },
		{ path: '/verhalen', priority: 0.8, changefreq: 'monthly' },
		// The three ways into the archive. High priority: between them they link to every
		// one of the 121 places, which is how a crawler reaches the photographs.
		{ path: '/straten', priority: 0.9, changefreq: 'monthly' },
		{ path: '/kastelen', priority: 0.9, changefreq: 'monthly' },
		{ path: '/wijken', priority: 0.9, changefreq: 'monthly' },
		{ path: '/tijdlijn', priority: 0.8, changefreq: 'monthly' },
		{ path: '/upload', priority: 0.6, changefreq: 'yearly' },
		{ path: '/over-ons', priority: 0.5, changefreq: 'yearly' },
		{ path: '/contact', priority: 0.5, changefreq: 'yearly' },
		{ path: '/privacy', priority: 0.3, changefreq: 'yearly' }
	];

	// Places carrying photographs. A place with none is a page that says so, and there is
	// no reason to ask anybody to index that.
	for (const place of archive.places.filter((place) => place.count > 0)) {
		entries.push({ path: `/straat/${place.id}`, priority: 0.8, changefreq: 'monthly' });
	}

	for (const story of storyList) {
		entries.push({ path: `/verhaal/${story.slug}`, priority: 0.7, changefreq: 'yearly' });
	}

	// The photographs themselves. These are the long tail and the reason anybody arrives
	// from a search: somebody looking for "Dorpsstraat 1960" wants one of these, not the
	// front page.
	for (const photo of archive.photos) {
		entries.push({ path: `/foto/${photo.id}`, priority: 0.6, changefreq: 'yearly' });
	}

	fs.writeFileSync(SITEMAP, renderSitemap(SITE, entries));
	fs.writeFileSync(ROBOTS, renderRobots(SITE));

	const bytes = fs.statSync(SITEMAP).size;
	console.log(`Wrote ${entries.length} URLs to ${SITEMAP} (${Math.round(bytes / 1024)} KB)`);
	console.log(`   ${archive.photos.length} photographs`);
	console.log(`   ${archive.places.filter((place) => place.count > 0).length} places`);
	console.log(`   ${storyList.length} stories`);
	console.log(`Wrote ${ROBOTS}`);

	// The sitemaps protocol caps a single file at 50,000 URLs and 50 MB uncompressed. Well
	// under both today; worth failing loudly rather than shipping a file search engines
	// reject in full.
	if (entries.length > 50000) throw new Error('Over 50,000 URLs: split into a sitemap index.');
	if (bytes > 50 * 1024 * 1024) throw new Error('Over 50 MB: split into a sitemap index.');
}

main();
