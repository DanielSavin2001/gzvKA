/**
 * Writes `docs/dubbele-plaatsen.md`: places holding the same photographs.
 *
 *   npm run plaatsen:dubbel
 *
 * `npm run duplicates` already looks for duplicate *files*, by hashing them, and it has
 * never found this because there is nothing here for it to find. Ertbrand holds 62
 * photographs and Fort van Ertbrand holds 55, and 55 of them are the same 55. Not one file
 * is duplicated. What is duplicated is the place: two bubbles on the map showing the same
 * pictures, and no way for a reader to know which one they wanted.
 *
 * The report has two halves and the split is the whole point of it. The first names the
 * pairs where the two sides are effectively one set - one place under two names, which is a
 * decision somebody has to make. The second names ordinary nestings, where a castle or a
 * chapel sits inside a district or a street, which are correct and are listed only so that
 * nobody has to wonder whether they were checked.
 *
 * Nothing is changed by running this. Which of two names is right, whether Heidestraat and
 * Christiaan Pallemansstraat are one street before and after a renaming, whether the fort
 * belongs under the district or beside it - those are questions about Kapellen, and the
 * answer is not in the photograph counts.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { OverlapPhoto, OverlapPlace, PlaceOverlap } from '../../sharedModels/place-overlap';
import { overlappingPlaces } from '../../sharedModels/place-overlap';

function findRepoRoot(start: string): string {
	let current = start;
	for (;;) {
		if (fs.existsSync(path.join(current, 'svelte.config.js'))) return current;
		const parent = path.dirname(current);
		if (parent === current) throw new Error('Could not find the repository root.');
		current = parent;
	}
}

const REPO_ROOT = findRepoRoot(__dirname);
const ARCHIVE_INDEX = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'dubbele-plaatsen.md');

interface ArchiveIndex {
	photos: OverlapPhoto[];
	places: OverlapPlace[];
}

function percent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function row(overlap: PlaceOverlap): string {
	// Markdown, so a plain apostrophe and no HTML entities; the leading `|` is written out
	// rather than joined from an empty first element, which left every row indented.
	return [
		`| \`${overlap.a.id}\``,
		`${overlap.a.name} (${overlap.a.count})`,
		`${overlap.b.name} (${overlap.b.count})`,
		String(overlap.shared),
		percent(overlap.containment),
		`${percent(overlap.overlap)} |`
	].join(' | ');
}

const TABLE_HEAD = [
	'| id | Grootste | Kleinste | Samen | Zit erin | Overlap |',
	'| --- | --- | --- | ---: | ---: | ---: |'
].join('\n');

function main(): void {
	if (!fs.existsSync(ARCHIVE_INDEX)) {
		throw new Error(`${ARCHIVE_INDEX} is er niet. Draai eerst "npm run archive:index".`);
	}

	const index = JSON.parse(fs.readFileSync(ARCHIVE_INDEX, 'utf8')) as ArchiveIndex;
	const overlaps = overlappingPlaces(index.photos, index.places);

	const same = overlaps.filter((overlap) => overlap.kind === 'zelfde');
	const nested = overlaps.filter((overlap) => overlap.kind === 'binnen');

	const lines = [
		"# Plaatsen die dezelfde foto's bevatten",
		'',
		'Geschreven door `npm run plaatsen:dubbel`. Niet met de hand bijwerken: de volgende',
		'run overschrijft dit bestand.',
		'',
		'`npm run duplicates` zoekt dubbele *bestanden*. Dit zoekt dubbele *plaatsen*: twee',
		"gazetteer-ingangen waar grotendeels dezelfde foto's onder hangen. Op de kaart zijn",
		'dat twee bollen die hetzelfde laten zien, en een lezer kan niet weten welke hij moet',
		'hebben.',
		'',
		'| | |',
		'| --- | ---: |',
		`| Foto's | ${index.photos.length} |`,
		`| Plaatsen met foto's | ${new Set(index.photos.flatMap((photo) => photo.st ?? [])).size} |`,
		`| Eén plaats, twee namen | ${same.length} |`,
		`| Nesting (klopt meestal) | ${nested.length} |`,
		'',
		'## Waarschijnlijk één plaats onder twee namen',
		'',
		'Hier zit de kleinste vrijwel helemaal in de grootste **en** blijft er van de grootste',
		'nauwelijks iets over als je de kleinste eraf haalt. Dat is geen nesting maar een',
		'dubbele ingang. Kies er één, of hang de ene onder de andere met `parentId`.',
		''
	];

	if (same.length === 0) lines.push('Geen.', '');
	else lines.push(TABLE_HEAD, ...same.map(row), '');

	lines.push(
		'## Nesting',
		'',
		'De kleinste zit in de grootste, maar de grootste is veel meer dan de kleinste: een',
		'kasteel in een wijk, een kapel aan een straat. Dat hoort zo. Het staat hier zodat',
		'niemand zich hoeft af te vragen of het nagekeken is.',
		''
	);

	if (nested.length === 0) lines.push('Geen.', '');
	else lines.push(TABLE_HEAD, ...nested.map(row), '');

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, `${lines.join('\n')}\n`, 'utf8');

	console.log('Overlappende plaatsen');
	console.log('='.repeat(52));
	console.log(`Eén plaats, twee namen   ${same.length}`);
	console.log(`Nesting                  ${nested.length}`);
	console.log('');

	for (const overlap of same) {
		console.log(
			`  ${overlap.a.name} (${overlap.a.count}) <-> ${overlap.b.name} (${overlap.b.count})` +
				`  ${overlap.shared} samen, ${percent(overlap.overlap)} overlap`
		);
	}

	console.log('');
	console.log(`wrote  docs/${path.basename(OUTPUT_FILE)}`);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
