/**
 * Builds `functions/src/data/kapellen-gazetteer.json` by joining the curated seed in
 * `src/gazetteer/seed.ts` against the real image corpus.
 *
 * The point of generating rather than hand-writing this file is that every claim in it is
 * then checked against the archive: an alias that occurs nowhere is reported, and the
 * sample path attached to each entry is a real photograph a reviewer can open. Nothing in
 * the output is invented, and coordinates are deliberately absent - geometry arrives
 * separately from OpenStreetMap.
 *
 * Usage, from the `functions/` directory:
 *
 *   npm run gazetteer:build          # writes the JSON, reports unmatched aliases
 *   npm run gazetteer:build -- --check   # verifies only; non-zero exit if stale or invalid
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer, GazetteerEntry } from '../../sharedModels/gazetteer';
import { normalizePlace } from '../src/gazetteer/normalize';
import {
	EXCLUDED_FROM_GAZETTEER,
	resolveSeedDefaults,
	SEED_ENTRIES,
	SeedEntry
} from '../src/gazetteer/seed';

/**
 * Walks up from this file to the repository root.
 *
 * The depth cannot be hard-coded: `tsc` infers the repository root as its rootDir (the
 * sources reach outside `functions/` into `sharedModels/`), so the compiled script sits
 * at `functions/lib/functions/scripts/` while its source sits at `functions/scripts/`.
 * Looking for marker files makes the script work identically from either location.
 */
function findRepoRoot(startDirectory: string): string {
	let current = startDirectory;

	for (;;) {
		const looksLikeRoot =
			fs.existsSync(path.join(current, 'firebase.json')) &&
			fs.existsSync(path.join(current, 'sharedModels'));

		if (looksLikeRoot) return current;

		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error(
				`Could not find the repository root above ${startDirectory} ` +
					'(looked for a directory containing both firebase.json and sharedModels/).'
			);
		}
		current = parent;
	}
}

const REPO_ROOT = findRepoRoot(__dirname);
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const OUTPUT_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** Recursively lists every image file under a directory, as repository-relative paths. */
function listCorpusFiles(directory: string): string[] {
	if (!fs.existsSync(directory)) return [];

	const found: string[] = [];

	const walk = (current: string): void => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) {
				walk(absolute);
			} else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				found.push(path.relative(REPO_ROOT, absolute));
			}
		}
	};

	walk(directory);
	return found.sort();
}

/**
 * True when `needle` occurs in `haystack` as a whole sequence of tokens, so that
 * "wal" does not match inside "walstraat" but does match inside "op den wal 5".
 * Both arguments must already be normalized.
 */
function containsTokenSequence(haystack: string, needle: string): boolean {
	if (needle === '') return false;
	return ` ${haystack} `.includes(` ${needle} `);
}

/** True when any negative-context guard fires against the original (unnormalized) path. */
function isGuarded(originalPath: string, negativeContext: string[] | undefined): boolean {
	if (!negativeContext || negativeContext.length === 0) return false;

	return negativeContext.some((source) => new RegExp(source, 'i').test(originalPath));
}

interface BuildResult {
	gazetteer: Gazetteer;
	corpusFileCount: number;
	/**
	 * Surface forms with no unguarded occurrence. Split by whether a guard was the reason,
	 * because those are opposite signals: a form suppressed entirely by its negative
	 * context means the guard is doing its job, while a form that simply never occurs is
	 * either a typo in the seed or a guess about the corpus.
	 */
	unobservedForms: Array<{ entryId: string; form: string; guarded: number }>;
	/** The real error signal: an entry no corpus file supports at all. */
	entriesWithoutHits: string[];
	guardedHits: number;
}

function build(): BuildResult {
	const corpusFiles = listCorpusFiles(CORPUS_DIR);

	// Normalize every corpus path once; this is the text every alias is searched in.
	const normalizedPaths = corpusFiles.map((relativePath) => ({
		relativePath,
		normalized: normalizePlace(relativePath.replace(/\.[^.]+$/, '').replace(/\//g, ' '))
	}));

	const seenIds = new Set<string>();
	const excludedNames = new Set(EXCLUDED_FROM_GAZETTEER.map((e) => normalizePlace(e.name)));

	const entries: GazetteerEntry[] = [];
	const unobservedForms: BuildResult['unobservedForms'] = [];
	const entriesWithoutHits: string[] = [];
	let guardedHits = 0;

	for (const seed of SEED_ENTRIES as SeedEntry[]) {
		if (seenIds.has(seed.id)) {
			throw new Error(`Duplicate gazetteer id: ${seed.id}`);
		}
		seenIds.add(seed.id);

		if (excludedNames.has(normalizePlace(seed.name))) {
			throw new Error(
				`"${seed.name}" is on the EXCLUDED_FROM_GAZETTEER list but was seeded as an entry.`
			);
		}

		const defaults = resolveSeedDefaults(seed);
		const surfaceForms = [seed.name, ...(seed.aliases ?? [])];

		// Counted as distinct photographs, not as alias occurrences: a file whose path
		// contains both "De Uitlegger" and "Uitlegger" is still one photograph, and
		// evidence that reads 368 for a folder of 124 files helps nobody.
		const matchedFiles = new Set<string>();
		let sampleFile = '';

		for (const surfaceForm of surfaceForms) {
			const normalizedAlias = normalizePlace(surfaceForm);
			let hits = 0;
			let guardedForForm = 0;

			for (const candidate of normalizedPaths) {
				if (!containsTokenSequence(candidate.normalized, normalizedAlias)) continue;

				if (isGuarded(candidate.relativePath, seed.negativeContext)) {
					guardedForForm += 1;
					guardedHits += 1;
					continue;
				}

				hits += 1;
				matchedFiles.add(candidate.relativePath);
			}

			if (hits === 0) {
				unobservedForms.push({ entryId: seed.id, form: surfaceForm, guarded: guardedForForm });
			}
		}

		// The sample is the first matching path in sorted order, so it is stable
		// across rebuilds regardless of which alias happened to match first.
		const sortedMatches = [...matchedFiles].sort();
		if (sortedMatches.length > 0) sampleFile = sortedMatches[0];

		const totalHits = matchedFiles.size;
		if (totalHits === 0) entriesWithoutHits.push(seed.id);

		entries.push({
			id: seed.id,
			name: seed.name,
			aliases: seed.aliases ?? [],
			kind: seed.kind,
			district: defaults.district,
			inMunicipality: defaults.inMunicipality,
			isStreet: defaults.isStreet,
			allowHouseNumber: defaults.allowHouseNumber,
			fuzzy: defaults.fuzzy,
			...(seed.negativeContext ? { negativeContext: seed.negativeContext } : {}),
			...(seed.relatedIds ? { relatedIds: seed.relatedIds } : {}),
			...(seed.note ? { note: seed.note } : {}),
			manualGeometry: null,
			evidence: { corpusHits: totalHits, sampleFile }
		});
	}

	// Every relatedIds reference must point at a real entry, or the graph is broken.
	for (const entry of entries) {
		for (const relatedId of entry.relatedIds ?? []) {
			if (!seenIds.has(relatedId)) {
				throw new Error(`Entry "${entry.id}" references unknown relatedId "${relatedId}".`);
			}
		}
	}

	entries.sort((a, b) => a.id.localeCompare(b.id));

	return {
		gazetteer: {
			version: 1,
			// Fixed rather than "now": a rebuild that changes nothing should produce an
			// identical file, so `--check` can be meaningful in CI.
			updatedAt: '2026-08-29',
			entries
		},
		corpusFileCount: corpusFiles.length,
		unobservedForms,
		entriesWithoutHits,
		guardedHits
	};
}

function main(): void {
	const checkOnly = process.argv.includes('--check');
	const result = build();

	const serialized = `${JSON.stringify(result.gazetteer, null, '\t')}\n`;

	console.log(`Corpus files scanned:      ${result.corpusFileCount}`);
	console.log(`Gazetteer entries:         ${result.gazetteer.entries.length}`);
	console.log(`Hits suppressed by guards: ${result.guardedHits}`);

	const totalHits = result.gazetteer.entries.reduce((sum, e) => sum + e.evidence.corpusHits, 0);
	console.log(`Entry-to-photo links:      ${totalHits}`);

	const suppressed = result.unobservedForms.filter((f) => f.guarded > 0);
	const absent = result.unobservedForms.filter((f) => f.guarded === 0);

	if (suppressed.length > 0) {
		console.log(`\nForms whose every occurrence was suppressed by a guard (${suppressed.length}):`);
		for (const { entryId, form, guarded } of suppressed) {
			console.log(`  ${entryId.padEnd(32)} "${form}" (${guarded} suppressed)`);
		}
		console.log('  -> Expected. The negative-context guard is doing its job.');
	}

	if (absent.length > 0) {
		console.log(`\nForms never observed in the corpus (${absent.length}):`);
		for (const { entryId, form } of absent) {
			console.log(`  ${entryId.padEnd(32)} "${form}"`);
		}
		console.log(
			'  -> Fine for a canonical name the archive never spells out in full;\n' +
				'     a typo or a guess otherwise. Check each against the seed.'
		);
	}

	if (result.entriesWithoutHits.length > 0) {
		console.error(
			`\nERROR - entries with no corpus evidence at all (${result.entriesWithoutHits.length}):`
		);
		for (const id of result.entriesWithoutHits) console.error(`  ${id}`);
		console.error('  -> An entry no photograph supports does not belong in the gazetteer.');
		process.exitCode = 1;
	}

	if (checkOnly) {
		const existing = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : '';
		if (existing !== serialized) {
			console.error('\nkapellen-gazetteer.json is stale. Run: npm run gazetteer:build');
			process.exit(1);
		}
		console.log('\nGazetteer is up to date.');
		return;
	}

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, serialized, 'utf8');
	console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

main();
