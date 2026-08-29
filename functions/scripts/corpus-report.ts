/**
 * Runs the deterministic place matcher over every image in the local corpus and reports
 * what it can extract, with no API key and no network access.
 *
 * This is the honest measure of the zero-cost layer: whatever it cannot resolve here is
 * precisely the work the AI vision pass has to do, so the "no place found" figure is the
 * number that sizes the enrichment job rather than an embarrassment to be hidden.
 *
 * Usage, from the `functions/` directory:
 *
 *   npm run corpus:report              # summary
 *   npm run corpus:report -- --samples # summary plus worked examples
 *   npm run corpus:report -- --misses  # summary plus files nothing matched
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer } from '../../sharedModels/gazetteer';
import { buildIndex, matchImagePath } from '../src/gazetteer/match';
import { splitFilename } from '../src/gazetteer/segment';

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
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const GAZETTEER_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function listCorpusFiles(directory: string): string[] {
	const found: string[] = [];

	const walk = (current: string): void => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) walk(absolute);
			else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				found.push(path.relative(REPO_ROOT, absolute));
			}
		}
	};

	walk(directory);
	return found.sort();
}

function percent(part: number, whole: number): string {
	return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

function main(): void {
	const showSamples = process.argv.includes('--samples');
	const showMisses = process.argv.includes('--misses');

	const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf8')) as Gazetteer;
	const index = buildIndex(gazetteer);
	const files = listCorpusFiles(CORPUS_DIR);

	let anyPlace = 0;
	let anyStreet = 0;
	let houseNumbers = 0;
	let corners = 0;
	let contributors = 0;
	let acquisitionDates = 0;
	let topicalOnly = 0;

	const streetCounts = new Map<string, number>();
	const misses: string[] = [];
	const samples: string[] = [];

	for (const file of files) {
		const parts = splitFilename(file.split('/').pop() ?? '');
		const result = matchImagePath(file, index);

		if (parts.contributor !== null) contributors += 1;
		if (parts.dateOfAcquisition !== null) acquisitionDates += 1;
		if (result.topicalOnly) topicalOnly += 1;
		if (result.corners.length > 0) corners += 1;

		if (result.matches.length > 0) anyPlace += 1;
		else misses.push(file);

		if (result.bestStreet) {
			anyStreet += 1;
			const id = result.bestStreet.entryId;
			streetCounts.set(id, (streetCounts.get(id) ?? 0) + 1);

			if (result.bestStreet.houseNumber !== null) {
				houseNumbers += 1;
				if (samples.length < 12) {
					samples.push(
						`  ${path.basename(file)}\n` +
							`    -> ${result.bestStreet.canonicalName} ${result.bestStreet.houseNumber}` +
							`${result.bestStreet.houseNumberSuffix ?? ''}` +
							`  [${result.bestStreet.method}, confidence ${result.bestStreet.confidence.toFixed(
								2
							)}]` +
							`${parts.contributor ? `, donated by ${parts.contributor}` : ''}` +
							`${parts.dateOfAcquisition ? ` on ${parts.dateOfAcquisition}` : ''}`
					);
				}
			}
		}
	}

	const total = files.length;

	console.log('Deterministic extraction over the local corpus');
	console.log('='.repeat(62));
	console.log(`Images scanned                    ${total}`);
	console.log(`Gazetteer entries                 ${gazetteer.entries.length}`);
	console.log('');
	console.log(`Any place matched                 ${anyPlace}  (${percent(anyPlace, total)})`);
	console.log(`A street or square matched        ${anyStreet}  (${percent(anyStreet, total)})`);
	console.log(
		`House number recovered            ${houseNumbers}  (${percent(houseNumbers, total)})`
	);
	console.log(`Street corner recognised          ${corners}  (${percent(corners, total)})`);
	console.log(
		`Donor recovered from filename     ${contributors}  (${percent(contributors, total)})`
	);
	console.log(
		`Donation date recovered           ${acquisitionDates}  (${percent(acquisitionDates, total)})`
	);
	console.log('');
	console.log(
		`No place matched at all           ${misses.length}  (${percent(misses.length, total)})`
	);
	console.log(`  of which prize-draw photography ${topicalOnly}  (the Wedstrijden GZVKA subtree)`);
	console.log('  -> this is the set the AI vision pass has to earn its cost on.');

	console.log('\nTop streets by photographs:');
	for (const [id, count] of [...streetCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
		const entry = index.byId.get(id);
		console.log(`  ${String(count).padStart(4)}  ${entry?.name ?? id}`);
	}

	if (showSamples) {
		console.log('\nWorked examples with a recovered address:');
		for (const sample of samples) console.log(sample);
	}

	if (showMisses) {
		console.log(`\nA sample of files nothing matched (${misses.length} total):`);
		for (const miss of misses.slice(0, 40)) console.log(`  ${path.basename(miss)}`);
	}
}

main();
