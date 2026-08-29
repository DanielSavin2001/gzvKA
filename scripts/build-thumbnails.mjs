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
const THUMB = { suffix: '.thumb.webp', longEdge: 480, quality: 74 };

/** Detail view: large enough to read a shop sign, small enough to load instantly. */
const DETAIL = { suffix: '.web.webp', longEdge: 1400, quality: 82 };

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

	for (const variant of [THUMB, DETAIL]) {
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
				width: variant.longEdge,
				height: variant.longEdge,
				fit: 'inside',
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
		`Converting ${files.length} photographs into ${path.relative(REPO_ROOT, OUTPUT_DIR)}`
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
