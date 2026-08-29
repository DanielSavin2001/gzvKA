/**
 * Makes every photograph's extension tell the truth about its bytes.
 *
 * 57 files in the archive are named for one format and hold another: 28 GIFs called `.png`,
 * 27 PNGs called `.jpg`, 2 JPEGs called `.png`. They display correctly today only because
 * the thumbnail build reads magic bytes rather than trusting the name - but every other tool
 * that touches this archive will trust the name, and one of them will eventually be wrong
 * in a way nobody notices.
 *
 * Two different repairs, chosen so that nothing is ever lost:
 *
 *   - **A GIF is re-encoded to PNG.** GIF is not a photograph format, and these are scans of
 *     photographs. PNG holds the same 256-colour palette losslessly, so the picture is
 *     unchanged and the file is finally what it claims to be. (It cannot be made to look
 *     better: the colour was thrown away when the GIF was made, and nothing can bring it
 *     back. Only a fresh scan can.)
 *   - **Everything else is renamed.** A PNG called `.jpg` is already a perfectly good PNG;
 *     re-encoding it to JPEG would throw away quality to satisfy its filename, which is
 *     backwards. The bytes are left exactly as they are.
 *
 * A photograph's id is derived from its path with the extension stripped, so none of this
 * changes a URL - links and the corrections file keep working across the repair.
 *
 * Usage, from the repository root:
 *
 *   node scripts/fix-image-formats.mjs           # report only
 *   node scripts/fix-image-formats.mjs --apply   # do it
 */

import { createRequire } from 'node:module';
import { open, readdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');

const APPLY = process.argv.includes('--apply');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** The extension each format should carry. */
const CANONICAL = { jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp' };

async function detectFormat(file) {
	const handle = await open(file, 'r');
	try {
		const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0);

		if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpeg';
		if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'png';
		if (buffer.subarray(0, 3).toString('latin1') === 'GIF') return 'gif';
		if (
			buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
			buffer.subarray(8, 12).toString('latin1') === 'WEBP'
		) {
			return 'webp';
		}
		return null;
	} finally {
		await handle.close();
	}
}

async function listCorpus() {
	const found = [];

	async function walk(current) {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(absolute);
		}
	}

	await walk(CORPUS_DIR);
	return found.sort();
}

/** A free name next to `file`, so a repair never silently overwrites another photograph. */
function freeName(directory, base, extension) {
	let candidate = path.join(directory, base + extension);
	let suffix = 2;
	while (existsSync(candidate)) {
		candidate = path.join(directory, `${base} (${suffix})${extension}`);
		suffix += 1;
	}
	return candidate;
}

async function main() {
	const files = await listCorpus();

	const toConvert = [];
	const toRename = [];
	let unreadable = 0;

	for (const file of files) {
		const format = await detectFormat(file);
		if (!format) {
			unreadable += 1;
			continue;
		}

		const extension = path.extname(file).toLowerCase();
		const canonical = CANONICAL[format];

		// `.jpeg` and `.jpg` are the same thing; only a real disagreement is worth touching.
		const agrees = extension === canonical || (format === 'jpeg' && extension === '.jpeg');
		if (agrees) continue;

		if (format === 'gif') toConvert.push(file);
		else toRename.push({ file, canonical });
	}

	console.log(`Photographs        ${files.length}`);
	console.log(`GIFs to convert    ${toConvert.length} -> PNG (lossless)`);
	console.log(`To rename          ${toRename.length} (bytes untouched)`);
	if (unreadable > 0) console.log(`Unrecognised       ${unreadable}`);

	if (!APPLY) {
		for (const file of [...toConvert, ...toRename.map((r) => r.file)].slice(0, 10)) {
			console.log(`   ${path.relative(CORPUS_DIR, file)}`);
		}
		console.log('\nReport only. Re-run with --apply to repair.');
		return;
	}

	for (const file of toConvert) {
		const directory = path.dirname(file);
		const base = path.basename(file, path.extname(file));

		// A GIF called `.png` keeps its own name: the extension is already right, only the
		// bytes are wrong. Asking for a free name here would see the file itself as a clash
		// and rename it to "... (2).png", which is how this went wrong the first time.
		const wanted = path.join(directory, `${base}.png`);
		const inPlace = path.resolve(wanted) === path.resolve(file);
		const target = inPlace ? `${file}.converting` : freeName(directory, base, '.png');

		await sharp(file, { failOn: 'none', animated: false }).png().toFile(target);

		if (inPlace) {
			await rm(file);
			await rename(target, wanted);
		} else {
			await rm(file);
		}
	}

	for (const { file, canonical } of toRename) {
		const directory = path.dirname(file);
		const base = path.basename(file, path.extname(file));
		await rename(file, freeName(directory, base, canonical));
	}

	console.log(`\nConverted ${toConvert.length}, renamed ${toRename.length}.`);
	console.log('Re-run `npm run thumbs` and `npm run archive:index`.');
}

await main();
