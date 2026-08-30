/**
 * Lists the places that hold photographs but are still nowhere on the map.
 *
 * The street register positioned every street it knows. It does not know castles, woods,
 * cafés, chapels or districts, and nothing in this repository can work out where those are:
 * a filename does not carry a coordinate, and this environment's network policy is an
 * allowlist covering GitHub, npm and the Anthropic API - OpenStreetMap, Nominatim, Wikipedia
 * and the Flemish geo services are all unreachable from here.
 *
 * So the remaining positions have to come from someone who knows Kapellen. This produces
 * the list to hand them, ordered by how many photographs each place holds, so an hour spent
 * on the top of it is worth more than a day spent on the bottom.
 *
 * Usage, from the repository root:
 *
 *   node scripts/list-unplaced.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'plaatsen-te-bepalen.md');

const readJson = async (relative) =>
	JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8'));

/** How the kinds are introduced, and in what order they are worth working through. */
const KINDS = [
	['area', 'Wijken en gehuchten', 'Een ruw middelpunt volstaat hier.'],
	[
		'castle-estate',
		'Kastelen en domeinen',
		'De meeste staan er nog; sommige zijn genoemd naar hun straat.'
	],
	[
		'building',
		'Gebouwen, cafés, kerken en kapellen',
		'Juist de verdwenen gebouwen zijn het belangrijkst.'
	],
	['park', 'Parken', ''],
	['fort', 'Forten', ''],
	[
		'square',
		'Pleinen',
		'Staan niet in het huidige stratenregister - zie docs/streets-not-in-register.md.'
	],
	[
		'street',
		'Straten',
		'Staan niet in het huidige stratenregister; wellicht hernoemd of verdwenen.'
	]
];

async function main() {
	const archive = await readJson('static/data/archive-index.json');
	const geometry = (await readJson('static/data/street-geometry.json')).streets;
	const placed = (await readJson('static/data/place-coordinates.json')).places;

	// The researched placements, which is where nearly every place actually got located.
	// This file used to count only the street register and the handful of pins placed by
	// hand, so it kept reporting 82 places still to find long after they had been found -
	// a document whose whole purpose is to ask somebody for work, asking for work already
	// done. A place counts as placed once the map can draw it.
	const approximations = (await readJson('static/data/place-approximations.json')).places;
	const drawable = new Set(
		Object.values(approximations)
			.filter((entry) => {
				if (entry.display === 'niet_geplaatst') return false;
				if (entry.display === 'kandidaten') return (entry.candidates ?? []).length > 0;
				return entry.lat != null && entry.lng != null;
			})
			.map((entry) => entry.id)
	);
	const gazetteer = await readJson('functions/src/data/kapellen-gazetteer.json');

	const entries = new Map(gazetteer.entries.map((entry) => [entry.id, entry]));

	const withPhotos = archive.places.filter((place) => place.count > 0);
	const unplaced = withPhotos.filter(
		(place) => !(place.id in geometry) && !(place.id in placed) && !drawable.has(place.id)
	);

	const photographs = unplaced.reduce((sum, place) => sum + place.count, 0);

	const header = [
		'# Plaatsen die nog op de kaart moeten',
		'',
		'Gegenereerd door `node scripts/list-unplaced.mjs`. Niet met de hand aanpassen.',
		''
	];

	// Nothing left to ask for. A document whose entire purpose is to request work should
	// say so plainly when the work is done, rather than repeating the whole explanation of
	// what it needs above an empty list.
	if (unplaced.length === 0) {
		await writeFile(
			OUTPUT_FILE,
			[
				...header,
				`Alle **${withPhotos.length}** plaatsen met foto's staan op de kaart. Er is niets meer`,
				'aan te vullen.',
				'',
				'Komen er nieuwe plaatsen bij, dan verschijnen ze hier vanzelf weer: draai',
				'`node scripts/list-unplaced.mjs` opnieuw nadat de index opnieuw gebouwd is.',
				''
			].join('\n'),
			'utf8'
		);

		console.log(`Places with photographs   ${withPhotos.length}`);
		console.log(`On the map                ${withPhotos.length}`);
		console.log('Still to place            0');
		console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
		return;
	}

	const lines = [
		...header,
		`Van de ${withPhotos.length} plaatsen met foto's staan er **${
			withPhotos.length - unplaced.length
		}** op`,
		`de kaart en **${unplaced.length} nog niet**, samen goed voor **${photographs.toLocaleString(
			'nl-BE'
		)} foto's**.`,
		'',
		'Het stratenregister heeft elke straat die het kent al geplaatst. Kastelen, bossen,',
		'cafés, kapellen en wijken staan daar niet in, en niets in deze repository kan uitzoeken',
		'waar die liggen: een bestandsnaam bevat geen coördinaten, en deze omgeving mag alleen',
		'GitHub, npm en de Anthropic-API bereiken. OpenStreetMap, Nominatim, Wikipedia en de',
		'Vlaamse geodiensten zijn hier niet bereikbaar - dat is een instelling van de omgeving,',
		'geen keuze.',
		'',
		'## Wat we nodig hebben',
		'',
		'Per plaats is één van deze genoeg, van precies naar ruw:',
		'',
		'1. **Coördinaten** (`51.3125, 4.4295`) - het beste, gaat er meteen in.',
		'2. **Adres** (`Kapelsestraat 45`) - we zetten het dan op die straat.',
		'3. **Omschrijving** (`hoek van X en Y`, `achter het station`) - dan een ruwe plaats.',
		'4. **"Weet ik niet"** - ook een antwoord; dan blijft het van de kaart en verzinnen we niets.',
		'',
		'Fijn afstellen kan achteraf op `/kaart?beheer` door op de kaart te klikken.',
		'',
		'---',
		''
	];

	for (const [kind, heading, note] of KINDS) {
		const group = unplaced.filter((place) => place.kind === kind).sort((a, b) => b.count - a.count);
		if (group.length === 0) continue;

		const total = group.reduce((sum, place) => sum + place.count, 0);
		lines.push(
			`## ${heading}`,
			'',
			`${group.length} plaatsen, ${total.toLocaleString('nl-BE')} foto's.${note ? ` ${note}` : ''}`,
			'',
			"| Foto's | Plaats | Ook bekend als | Wat het archief al zegt | **Ligging (vul aan)** |",
			'| ---: | --- | --- | --- | --- |'
		);

		for (const place of group) {
			const entry = entries.get(place.id) ?? {};
			const aliases = (entry.aliases ?? []).join(', ');
			const note = (entry.note ?? '').replace(/\|/g, '/');
			lines.push(`| ${place.count} | **${place.name}** | ${aliases} | ${note} |  |`);
		}

		lines.push('');
	}

	if (!existsSync(path.dirname(OUTPUT_FILE)))
		await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await writeFile(OUTPUT_FILE, lines.join('\n'), 'utf8');

	console.log(`Places with photographs   ${withPhotos.length}`);
	console.log(`On the map                ${withPhotos.length - unplaced.length}`);
	console.log(
		`Still to place            ${unplaced.length} (${photographs.toLocaleString(
			'en-GB'
		)} photographs)`
	);
	console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

await main();
