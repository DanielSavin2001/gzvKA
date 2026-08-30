/**
 * Lists the photographs that belong to no place at all.
 *
 * This is the other half of `list-unplaced.mjs`, and it exists because that script could
 * never have found these. It starts from the *places* the archive knows and asks which of
 * them are missing a coordinate. A photograph filed under no place is in no place's count,
 * so it is invisible to that question by construction - 969 photographs, a fifth of the
 * archive, sitting in a blind spot of the only report that was supposed to surface blind
 * spots.
 *
 * Those photographs are unreachable from the map and from every street page. Search is the
 * only way to them, which means you have to already know they exist.
 *
 * Two different things are mixed together in that 969, and the difference decides the fix:
 *
 *   - Places the gazetteer has never heard of. Kasteel Oude Gracht is a castle in Kapellen
 *     with 46 photographs of it; the archive simply has no entry for it. Adding the entry
 *     is a change to the gazetteer, after which the existing pipeline places it like any
 *     other place.
 *   - Photographs that genuinely have no place. A class photo and a tournament are events,
 *     not locations, and pinning them somewhere would be inventing a fact. These need a
 *     different way in - by subject - not a coordinate.
 *
 * The split below is a guess made from the folder name, and it is presented as a guess.
 *
 * Usage, from the repository root:
 *
 *   node scripts/list-placeless-photos.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'fotos-zonder-plaats.md');

const readJson = async (relative) =>
	JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8'));

/**
 * Words that make a folder name read like somewhere you can stand.
 *
 * Deliberately crude. Its only job is to sort the list so the placeable ones float to the
 * top; a wrong guess costs somebody a glance, and the document says as much.
 *
 * Anchored at the end of the word only, never at the start, because Dutch glues these onto
 * the front half of a name: Ertbrand + bos, Essenhout + straat. Requiring a word boundary
 * on both sides filed both of those under "not a place", which is exactly backwards.
 *
 * `kapellen` is deliberately absent while `kerken` and `kapel` are present. It is the name
 * of the municipality, so it appears in folder names like "Sport in Kapellen" that are not
 * places at all - and "Kerken en kapellen" is already caught by `kerken`.
 */
const PLACE_WORDS = new RegExp(
	'(' +
		[
			'kasteel',
			'villa',
			'fort',
			'domein',
			'station',
			'hoeve',
			'molen',
			'bos',
			'bossen',
			'straat',
			'straten',
			'steenweg',
			'baan',
			'dreef',
			'laan',
			'lei',
			'plein',
			'park',
			'hof',
			'kerk',
			'kerken',
			'kapel',
			'huis',
			'gracht',
			'vijver',
			'brug',
			'school',
			'heide',
			'veld',
			'dijk'
		].join('|') +
		')\\b',
	'i'
);

/** How many filenames to show per subject, so the table stays readable. */
const SAMPLES = 3;

function looksLikeAPlace(subject) {
	return PLACE_WORDS.test(subject);
}

async function main() {
	const archive = await readJson('static/data/archive-index.json');
	const gazetteer = await readJson('functions/src/data/kapellen-gazetteer.json');

	const known = new Set(gazetteer.entries.map((entry) => entry.name.toLowerCase()));

	const placeless = archive.photos.filter((photo) => !photo.st || photo.st.length === 0);

	/** Grouped by the folder they came out of, which is all the archive knows about them. */
	const bySubject = new Map();
	for (const photo of placeless) {
		const group = bySubject.get(photo.s);
		if (group) group.push(photo);
		else bySubject.set(photo.s, [photo]);
	}

	const groups = [...bySubject.entries()]
		.map(([subject, photos]) => ({
			subject,
			photos,
			placeLike: looksLikeAPlace(subject),
			// A folder whose name already matches a gazetteer entry is a different bug: the
			// place exists and the photographs did not attach to it.
			alreadyKnown: known.has(subject.toLowerCase())
		}))
		.sort((a, b) => b.photos.length - a.photos.length);

	const placeLike = groups.filter((group) => group.placeLike);
	const eventLike = groups.filter((group) => !group.placeLike);
	const countOf = (list) => list.reduce((sum, group) => sum + group.photos.length, 0);

	const table = (list) => {
		const rows = [
			"| Foto's | Map | Voorbeelden | **Is dit een plaats? (vul aan)** |",
			'| ---: | --- | --- | --- |'
		];

		for (const group of list) {
			const samples = group.photos
				.slice(0, SAMPLES)
				.map((photo) => path.basename(photo.p).replace(/\|/g, '/'))
				.join('<br>');
			const flag = group.alreadyKnown ? ' _(staat al in de gazetteer!)_' : '';
			rows.push(
				`| ${group.photos.length} | **${group.subject}**${flag} | ${samples} |  |`
			);
		}

		return rows;
	};

	const lines = [
		"# Foto's die aan geen enkele plaats hangen",
		'',
		'Gegenereerd door `node scripts/list-placeless-photos.mjs`. Niet met de hand aanpassen.',
		'',
		`**${placeless.length.toLocaleString('nl-BE')}** van de ${archive.photos.length.toLocaleString(
			'nl-BE'
		)} foto's (${((placeless.length / archive.photos.length) * 100).toFixed(
			1
		)}%) hangen aan geen`,
		'enkele plaats. Ze staan niet op de kaart, niet op een straatpagina, en zijn alleen via',
		'de zoekbalk te vinden - je moet dus al weten dat ze bestaan.',
		'',
		'Dit is iets anders dan `plaatsen-te-bepalen.md`. Dat document vraagt waar een gekende',
		'plaats ligt. Dit document vraagt of iets überhaupt een plaats is.',
		'',
		'---',
		'',
		'## Waarschijnlijk wél een plaats',
		'',
		`${placeLike.length} mappen, ${countOf(placeLike).toLocaleString('nl-BE')} foto's.`,
		'',
		'Deze mapnamen lezen als een plek waar je kan gaan staan, maar de gazetteer kent ze',
		"niet. Zeg je dat het klopt, dan komt er een gazetteer-entry bij en gedragen de foto's",
		'zich verder als elke andere plaats: ze verschijnen op de kaart zodra we weten waar ze',
		"liggen, en krijgen een eigen pagina. Bevestig je dat niet, dan blijven ze zoals ze nu",
		'zijn.',
		'',
		...table(placeLike),
		'',
		'## Waarschijnlijk géén plaats',
		'',
		`${eventLike.length} mappen, ${countOf(eventLike).toLocaleString('nl-BE')} foto's.`,
		'',
		'Een klasfoto en een wedstrijd zijn een gebeurtenis, geen locatie. Die ergens op de',
		'kaart prikken zou een feit verzinnen, dus dat doen we niet. Wat ze wél nodig hebben is',
		'een andere ingang: bladeren op onderwerp in plaats van op plaats. Zolang die er niet is,',
		'blijven ze alleen vindbaar via de zoekbalk.',
		'',
		'Staat er hier toch iets tussen dat wél ergens ligt, zet het dan in de laatste kolom.',
		'Enkele die daarop lijken: "Hoogboom Spoorwegbataljon" (Hoogboom kent het archief al),',
		'"Koninklijke Straten" (de twee foto\'s zijn Spoorstraat) en "Op weg naar Putte".',
		'',
		...table(eventLike),
		''
	];

	if (!existsSync(path.dirname(OUTPUT_FILE)))
		await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await writeFile(OUTPUT_FILE, lines.join('\n'), 'utf8');

	console.log(`Photographs                 ${archive.photos.length}`);
	console.log(`On no place at all          ${placeless.length}`);
	console.log(`  probably a place          ${countOf(placeLike)} in ${placeLike.length} folders`);
	console.log(`  probably not a place      ${countOf(eventLike)} in ${eventLike.length} folders`);
	console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

await main();
