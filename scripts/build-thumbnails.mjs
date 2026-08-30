/**
 * Generates the web-sized copies of the archive that the site actually serves.
 *
 * The originals are 937 MB across 2948 files - far too much to ship to a browser, and too
 * much to put in a hosting deploy. This produces a browse-sized thumbnail and a larger
 * detail image for each photograph, which together come to a small fraction of that.
 *
 * The output lives in `static/foto/` and is deliberately NOT committed: it is derived from
 * the originals, and a hundred megabytes of generated files does not belong in git. Run it
 * once after cloning:
 *
 *   npm run thumbs
 *
 * It is idempotent - a photograph whose output is already newer than its source is skipped -
 * so re-running after adding a few images costs seconds rather than minutes.
 *
 * The format is chosen from the file's actual bytes, not its extension: 55 images in this
 * archive carry an extension that disagrees with their content.
 */

import { createRequire } from 'node:module';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const OUTPUT_DIR = path.join(REPO_ROOT, 'static', 'foto');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** Browse grid: small enough that a page of 60 is a couple of megabytes. */
const THUMB = { name: 'thumb', suffix: '.thumb.webp', longEdge: 480, quality: 74 };

/** Detail view: large enough to read a shop sign, small enough to load instantly. */
const DETAIL = { name: 'detail', suffix: '.web.webp', longEdge: 1400, quality: 82 };

/**
 * The link preview.
 *
 * Facebook, WhatsApp and LinkedIn only draw the big card everybody recognises when the
 * image is at least 600x315; below that they fall back to a thumbnail beside a line of
 * text. Every thumbnail here is 480 on its long edge, so every share the archive has ever
 * produced rendered as the small one.
 *
 * A fixed 1200x630 canvas rather than a scaled photograph, because a preview is cropped by
 * whoever is displaying it, and a fixed 1.91:1 is the ratio they all crop to. The
 * photograph is fitted inside it and the remainder is `paper-base`, so a portrait
 * photograph sits on the archive's own colour instead of a black bar.
 *
 * Deliberately still not enlarging: a small original keeps its size and gets more paper
 * around it. The canvas is 1200x630 either way, so the card is always valid - it just is
 * not upscaled into fuzz.
 */
const SOCIAL = {
	name: 'social',
	suffix: '.card.webp',
	width: 1200,
	height: 630,
	fit: 'contain',
	// #fcf9f0 - `paper-base` in the Tailwind config, which is what the page paints.
	background: { r: 252, g: 249, b: 240 },
	quality: 72
};

/**
 * Which sizes to produce. `--only=thumb,social` is what the deploy uses: measured over the
 * whole corpus that is 78 MB of thumbnails and 280 MB of cards, against 693 MB for all
 * three, and a hosting deploy pays for every version it keeps. The detail page falls back
 * to the thumbnail when the larger file is absent, so a deploy without `detail` shows every
 * photograph - just not at full size.
 *
 * The cards are the expensive half and their cost is the pixel count, not the quality:
 * dropping from 72 to 55 saves only 17%. If they ever need to be smaller the lever is the
 * canvas - 900x473 is still comfortably over the 600x315 floor and roughly halves it.
 *
 * Comma-separated, so a deploy can ask for exactly the set it serves.
 */
const ALL_VARIANTS = { thumb: THUMB, detail: DETAIL, social: SOCIAL };
const onlyArgument = process.argv.find((argument) => argument.startsWith('--only='))?.split('=')[1];
const VARIANTS = onlyArgument
	? onlyArgument.split(',').map((name) => {
			const variant = ALL_VARIANTS[name.trim()];
			if (!variant) {
				console.error(
					`Unknown variant "${name.trim()}". Known: ${Object.keys(ALL_VARIANTS).join(', ')}`
				);
				process.exit(1);
			}
			return variant;
	  })
	: [THUMB, DETAIL, SOCIAL];

async function listCorpusFiles(directory) {
	const found = [];

	async function walk(current) {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(absolute);
		}
	}

	await walk(directory);
	return found.sort();
}

/** True when the output already exists and is at least as new as its source. */
async function isUpToDate(sourcePath, outputPath) {
	if (!existsSync(outputPath)) return false;

	const [source, output] = await Promise.all([stat(sourcePath), stat(outputPath)]);
	return output.mtimeMs >= source.mtimeMs;
}

async function convertOne(sourcePath) {
	const relative = path.relative(CORPUS_DIR, sourcePath);
	const outputBase = path.join(OUTPUT_DIR, relative);

	await mkdir(path.dirname(outputBase), { recursive: true });

	let written = 0;
	let skipped = 0;

	for (const variant of VARIANTS) {
		const outputPath = outputBase + variant.suffix;

		if (await isUpToDate(sourcePath, outputPath)) {
			skipped += 1;
			continue;
		}

		// `failOn: 'none'` keeps a slightly corrupt scan from aborting the whole run; the
		// archive has files that have been through several conversions over the years.
		await sharp(sourcePath, { failOn: 'none', animated: false })
			.rotate() // honour EXIF orientation before resizing
			.resize({
				// A `longEdge` variant bounds both sides by the same number and keeps the
				// photograph's own shape; a card variant asks for an exact canvas and pads
				// what is left over.
				width: variant.width ?? variant.longEdge,
				height: variant.height ?? variant.longEdge,
				fit: variant.fit ?? 'inside',
				...(variant.background ? { background: variant.background } : {}),
				withoutEnlargement: true // never upscale: it costs bytes and adds nothing
			})
			.webp({ quality: variant.quality })
			.toFile(outputPath);

		written += 1;
	}

	return { written, skipped };
}

async function main() {
	if (!existsSync(CORPUS_DIR)) {
		console.error(`No corpus at ${path.relative(REPO_ROOT, CORPUS_DIR)}`);
		process.exit(1);
	}

	const files = await listCorpusFiles(CORPUS_DIR);
	console.log(
		`Converting ${files.length} photographs into ${path.relative(REPO_ROOT, OUTPUT_DIR)} ` +
			`(${VARIANTS.map((v) => v.name).join(' + ')})`
	);

	// sharp releases the event loop while libvips works, so a small pool saturates the CPU
	// without exhausting memory on the larger scans.
	const concurrency = Math.max(2, Math.min(8, cpus().length));
	let cursor = 0;
	let written = 0;
	let skipped = 0;
	let failed = 0;
	const failures = [];

	async function worker() {
		for (;;) {
			const i = cursor++;
			if (i >= files.length) return;

			try {
				const result = await convertOne(files[i]);
				written += result.written;
				skipped += result.skipped;
			} catch (error) {
				failed += 1;
				failures.push(`${path.relative(CORPUS_DIR, files[i])}: ${error.message}`);
			}

			const done = i + 1;
			if (done % 250 === 0 || done === files.length) {
				console.log(
					`  ${done}/${files.length}  written ${written}  skipped ${skipped}  failed ${failed}`
				);
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));

	if (failures.length > 0) {
		console.log(`\n${failures.length} could not be converted:`);
		for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
		// Recorded rather than only printed, so the list survives the scrollback.
		await writeFile(path.join(OUTPUT_DIR, 'failures.txt'), failures.join('\n'), 'utf8');
	}

	console.log(`\nDone. ${written} written, ${skipped} already current, ${failed} failed.`);
}

await main();
