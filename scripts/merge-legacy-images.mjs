/**
 * Folds the photographs downloaded from the live gzvka.be into the archive.
 *
 * The repository held 2,948 photographs; the live website showed 1,562 more that had never
 * been added to it. `src/lib/Legacy-website-images/` is that download - a flat folder of
 * 3,745 files, most of which the archive already has.
 *
 * Three things have to be got right, and none of them can be guessed:
 *
 *   - **Which are already here.** Matched on the filename reduced to letters and digits,
 *     the same key the story build uses. The names were never changed between the website
 *     and this repository, so this is a real join rather than a similarity score.
 *   - **Where the new ones go.** The corpus is organised into subject folders that
 *     correspond to pages of the old site. Every photograph on that site sits on a page, and
 *     `legacy-site/` holds all 101 of them, so the page that shows a photograph decides its
 *     folder. Where a page's photographs are already here, its folder is learned from them;
 *     where a page has none yet, a folder named after that page is created.
 *   - **What the file is really called.** Some names arrived as UTF-8 read as Latin-1 -
 *     "CafÃ© De Vrede", "75 jaar BelgiÃ«" - which is repaired on the way in. Left alone,
 *     those photographs would never match the page that references them.
 *
 * Nothing is placed on a guess. A photograph no page references is left where it is and
 * reported, because a photograph filed under the wrong subject is worse than one not filed.
 *
 * Usage, from the repository root:
 *
 *   node scripts/merge-legacy-images.mjs           # report only, changes nothing
 *   node scripts/merge-legacy-images.mjs --apply   # do it
 *
 * `--apply` moves the new photographs into the corpus and deletes the duplicates from the
 * download folder, leaving behind only what could not be placed.
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_IMAGES = path.join(REPO_ROOT, 'src', 'lib', 'Legacy-website-images');
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const LEGACY_PAGES = path.join(REPO_ROOT, 'legacy-site');
const REPORT_FILE = path.join(REPO_ROOT, 'docs', 'legacy-image-merge.md');

const APPLY = process.argv.includes('--apply');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/**
 * Pages that are the old site's own navigation rather than a subject. A photograph whose
 * only reference is the front page tells us nothing about where it belongs.
 */
const NAV_PAGES = new Set(['index.htm', 'index.html', 'kastelen.htm', 'Andere Straten.htm']);

/** The join key: a filename reduced to letters and digits. Matches the story build's. */
function photoKey(name) {
	const base = path.basename(name).replace(/\.[^.]+$/, '');
	return base
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

/**
 * Repairs a name that arrived as UTF-8 bytes read as Latin-1.
 *
 * Twenty of the downloaded files carry names like "CafÃ© De Vrede" and "75 jaar BelgiÃ«".
 * Round-tripping through Latin-1 recovers the real name; anything that does not survive the
 * round trip was never mojibake and is returned untouched.
 */
function repairMojibake(name) {
	if (!/[ÃÂ][-¿]/.test(name)) return name;

	try {
		const repaired = Buffer.from(name, 'latin1').toString('utf8');
		return repaired.includes('�') ? name : repaired;
	} catch {
		return name;
	}
}

function decodeEntities(text) {
	return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
		if (body.startsWith('#')) {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
		}
		const named = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>' };
		return named[body.toLowerCase()] ?? whole;
	});
}

async function listCorpus() {
	const byKey = new Map();

	async function walk(current) {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				byKey.set(photoKey(entry.name), path.relative(CORPUS_DIR, absolute));
			}
		}
	}

	await walk(CORPUS_DIR);
	return byKey;
}

/** Which page(s) of the old site show each photograph. */
async function readPageReferences() {
	const references = new Map();

	for (const fileName of (await readdir(LEGACY_PAGES)).filter((name) => /\.html?$/i.test(name))) {
		const html = Buffer.from(await readFile(path.join(LEGACY_PAGES, fileName))).toString('latin1');

		for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
			let src = decodeEntities(match[1]);
			if (src.includes('%')) {
				try {
					src = decodeURIComponent(src);
				} catch {
					// A malformed escape still keys consistently in its raw form.
				}
			}

			const key = photoKey(src);
			if (key === '') continue;
			if (!references.has(key)) references.set(key, new Set());
			references.get(key).add(fileName);
		}
	}

	return references;
}

/** Folder names already in the corpus, keyed for accent- and case-insensitive lookup. */
function folderIndex(names) {
	return new Map(names.map((name) => [photoKey(name), name]));
}

async function main() {
	if (!existsSync(LEGACY_IMAGES)) {
		console.log(`Nothing to do: ${path.relative(REPO_ROOT, LEGACY_IMAGES)} does not exist.`);
		return;
	}

	const corpus = await listCorpus();
	const references = await readPageReferences();

	const existingFolders = (await readdir(CORPUS_DIR, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
	const folders = folderIndex(existingFolders);

	// A page's folder is learned from the photographs of its that are already filed. This is
	// what makes placement evidence rather than a name-similarity guess.
	const pageFolders = new Map();
	for (const [key, pages] of references) {
		const filed = corpus.get(key);
		if (!filed) continue;

		const folder = filed.split(path.sep)[0];
		for (const page of pages) {
			if (!pageFolders.has(page)) pageFolders.set(page, new Map());
			const counts = pageFolders.get(page);
			counts.set(folder, (counts.get(folder) ?? 0) + 1);
		}
	}

	const folderForPage = new Map();
	for (const [page, counts] of pageFolders) {
		const [best] = [...counts].sort((a, b) => b[1] - a[1]);
		folderForPage.set(page, best[0]);
	}

	// A page with no photographs filed yet still names its own subject: "Kasteel Oude
	// Gracht.htm" becomes "Kasteel Oude Gracht", reusing an existing folder when one already
	// matches so the same subject does not end up split in two.
	function folderForNewPage(page) {
		const stem = page.replace(/\.html?$/i, '');
		return folders.get(photoKey(stem)) ?? stem;
	}

	const entries = (await readdir(LEGACY_IMAGES, { withFileTypes: true })).filter((entry) =>
		entry.isFile()
	);

	const duplicates = [];
	const placements = [];
	const unplaceable = [];
	const nonImages = [];

	for (const entry of entries) {
		const source = path.join(LEGACY_IMAGES, entry.name);
		const trueName = repairMojibake(entry.name);
		const extension = path.extname(trueName).toLowerCase();

		if (!IMAGE_EXTENSIONS.has(extension)) {
			nonImages.push(entry.name);
			continue;
		}

		const key = photoKey(trueName);
		if (corpus.has(key)) {
			duplicates.push({ name: entry.name, already: corpus.get(key) });
			continue;
		}

		const pages = [...(references.get(key) ?? [])].filter((page) => !NAV_PAGES.has(page));
		if (pages.length === 0) {
			unplaceable.push(entry.name);
			continue;
		}

		// Prefer a page whose folder is known; fall back to naming a folder after the page.
		const known = pages.find((page) => folderForPage.has(page));
		const folder = known ? folderForPage.get(known) : folderForNewPage(pages[0]);

		placements.push({
			source,
			folder,
			name: trueName,
			page: known ?? pages[0],
			renamed: trueName !== entry.name
		});
	}

	await report({ duplicates, placements, unplaceable, nonImages, folders: existingFolders });

	if (!APPLY) {
		console.log('\nReport only. Re-run with --apply to move the files.');
		return;
	}

	let moved = 0;
	let converted = 0;

	for (const placement of placements) {
		const directory = path.join(CORPUS_DIR, placement.folder);
		await mkdir(directory, { recursive: true });

		// A GIF is not a photograph format. Converting to PNG is lossless - both hold the
		// same palette - so nothing is lost, and the file then is what its name says.
		const isGif = path.extname(placement.name).toLowerCase() === '.gif';
		const targetName = isGif ? placement.name.replace(/\.gif$/i, '.png') : placement.name;
		const target = path.join(directory, targetName);

		if (existsSync(target)) continue;

		if (isGif) {
			await sharp(placement.source, { failOn: 'none', animated: false }).png().toFile(target);
			await rm(placement.source);
			converted += 1;
		} else {
			await rename(placement.source, target);
		}
		moved += 1;
	}

	for (const duplicate of duplicates) {
		await rm(path.join(LEGACY_IMAGES, duplicate.name));
	}

	console.log(
		`\nMoved ${moved} photographs into the archive (${converted} GIFs converted to PNG), ` +
			`deleted ${duplicates.length} duplicates from the download folder.`
	);
	console.log(`${unplaceable.length + nonImages.length} files remain in it - see the report.`);
}

async function report({ duplicates, placements, unplaceable, nonImages, folders }) {
	const byFolder = new Map();
	for (const placement of placements) {
		byFolder.set(placement.folder, (byFolder.get(placement.folder) ?? 0) + 1);
	}

	const known = new Set(folders);
	const newFolders = [...byFolder.keys()].filter((folder) => !known.has(folder)).sort();

	let bytes = 0;
	for (const placement of placements) bytes += (await stat(placement.source)).size;

	console.log(
		`Download folder    ${
			duplicates.length + placements.length + unplaceable.length + nonImages.length
		} files`
	);
	console.log(`Already in archive ${duplicates.length} (deleted from the folder by --apply)`);
	console.log(`To be added        ${placements.length} (${(bytes / 1e9).toFixed(2)} GB)`);
	console.log(`New subjects       ${newFolders.length}`);
	console.log(`Cannot place       ${unplaceable.length} images, ${nonImages.length} other files`);

	const lines = [
		'# Merging the legacy website images',
		'',
		'Generated by `node scripts/merge-legacy-images.mjs`. Do not edit by hand.',
		'',
		`The download in \`src/lib/Legacy-website-images/\` held ${
			duplicates.length + placements.length + unplaceable.length + nonImages.length
		} files.`,
		`${duplicates.length} were already in the archive. ${placements.length} were not, and are placed by`,
		'the page of the old website that shows them.',
		'',
		`## ${placements.length} photographs added`,
		'',
		'| Subject | Added | New folder |',
		'| --- | --- | --- |',
		...[...byFolder]
			.sort((a, b) => b[1] - a[1])
			.map(([folder, count]) => `| ${folder} | ${count} | ${known.has(folder) ? '' : 'yes'} |`),
		''
	];

	if (unplaceable.length > 0) {
		lines.push(
			`## ${unplaceable.length} could not be placed`,
			'',
			'No page of the old site references these, so there is no evidence of what they are',
			'photographs of. They are left in the download folder rather than filed on a guess.',
			'',
			...unplaceable.sort().map((name) => `- ${name}`),
			''
		);
	}

	if (nonImages.length > 0) {
		lines.push(
			`## ${nonImages.length} files that are not photographs`,
			'',
			...nonImages.sort().map((name) => `- ${name}`),
			''
		);
	}

	await mkdir(path.dirname(REPORT_FILE), { recursive: true });
	await writeFile(REPORT_FILE, lines.join('\n'), 'utf8');
	console.log(`\nReport written to ${path.relative(REPO_ROOT, REPORT_FILE)}`);
}

await main();
