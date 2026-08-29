/**
 * Turns the researched places into something the map can draw honestly.
 *
 * Until now the archive placed a photograph only when it could do so exactly: a street from
 * the official register, or a coordinate a person clicked. Everything else - the castles,
 * the cafés, the hamlets, the demolished villas - stayed off the map entirely. That was the
 * right default while the alternative was inventing coordinates, but it left 82 places and
 * 3,644 photographs invisible.
 *
 * `plaatsen.geojson` is the way out. Every row carries a confidence grade and, where the
 * grade is not exact, the radius the point could be wrong by and a sentence saying why. So
 * a place can go on the map *with its uncertainty attached* rather than being either hidden
 * or silently promoted to a fact.
 *
 * That is the whole point of this file, and the reason it is worth the extra machinery: a
 * marker that looks identical to a geocoded address, but is really one reading of the
 * phrase "on the north side of the Kalmthoutsesteenweg", is a lie the map tells for years.
 * The `weergave` field decides how each place is drawn, and it comes from the data rather
 * than from the component.
 *
 * The script refuses to emit anything it cannot verify:
 *
 *   - a place name that does not resolve to the archive is a hard error, because a silently
 *     dropped row is a place that vanishes from the map with nobody the wiser;
 *   - a photo count that disagrees with the archive is a hard error, since it means the
 *     research was done against a different archive than the one being built;
 *   - an alias pointing at a place the archive does not have is reported and the link is
 *     dropped, because the name is still worth searching for even when the target is not
 *     there to link to.
 *
 * Usage, from the repository root:
 *
 *   npm run plaatsen
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Approximation, Display } from '../../sharedModels/approximation';
import { normalizeText } from '../../sharedModels/text';

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
const SOURCE_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'plaatsen.geojson');
const ARCHIVE_INDEX = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const OUTPUT_FILE = path.join(REPO_ROOT, 'static', 'data', 'place-approximations.json');

/**
 * A second copy next to the functions, because the correction endpoint has to know what the
 * map was claiming about a place before it can record somebody disagreeing with it. The
 * site's copy lives in `static/` and is served to browsers; a deployed function cannot read
 * that, so the same generator writes both from the one source file rather than the two
 * being kept in step by hand.
 */
const FUNCTIONS_COPY = path.join(
	REPO_ROOT,
	'functions',
	'src',
	'data',
	'place-approximations.json'
);

const DISPLAYS: Display[] = [
	'punt',
	'punt_met_twijfel',
	'benadering',
	'kandidaten',
	'niet_geplaatst'
];

const GRADES = ['A', 'B', 'C', '?'];

interface SourceProperties {
	plaats: string;
	categorie: string;
	fotos: number;
	zekerheid: string;
	toelichting: string;
	onzeker: boolean;
	straal_m: number | null;
	twijfel: string;
	onderzoek: string;
	kandidaten: { lat: number; lon: number; label: string }[] | null;
	type: string;
	alias_van: string | null;
	buiten_kapellen: boolean;
	weergave: Display;
	corrigeerbaar: boolean;
	prioriteit: number;
}

interface SourceFeature {
	type: 'Feature';
	geometry: { type: 'Point'; coordinates: [number, number] } | null;
	properties: SourceProperties;
}

interface ArchivePlace {
	id: string;
	name: string;
	count: number;
}

function read<T>(file: string): T {
	return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Rounds to about a metre. More precision than the research supports would be false. */
function round(value: number): number {
	return Math.round(value * 1e5) / 1e5;
}

function blank(value: string | null | undefined): boolean {
	return value == null || value.trim() === '';
}

function main(): void {
	const source = read<{ features: SourceFeature[]; metadata?: Record<string, unknown> }>(
		SOURCE_FILE
	);
	const archive = read<{ places: ArchivePlace[] }>(ARCHIVE_INDEX);

	// The archive is keyed by id, but the research was written against display names, so
	// both are accepted. `normalizeText` is what the rest of the archive matches names with.
	const byName = new Map<string, ArchivePlace>();
	for (const place of archive.places) {
		byName.set(normalizeText(place.name), place);
		byName.set(normalizeText(place.id), place);
	}

	const approximations: Record<string, Approximation> = {};
	const unresolvedAliases: string[] = [];
	const problems: string[] = [];

	for (const feature of source.features) {
		const properties = feature.properties;
		const place = byName.get(normalizeText(properties.plaats));

		if (!place) {
			problems.push(`"${properties.plaats}" is not a place this archive has.`);
			continue;
		}

		if (properties.fotos !== place.count) {
			problems.push(
				`"${properties.plaats}" was researched against ${properties.fotos} photographs but ` +
					`the archive holds ${place.count}. The research and the archive disagree.`
			);
			continue;
		}

		if (!DISPLAYS.includes(properties.weergave)) {
			problems.push(`"${properties.plaats}" has an unknown weergave "${properties.weergave}".`);
			continue;
		}

		if (!GRADES.includes(properties.zekerheid)) {
			problems.push(`"${properties.plaats}" has an unknown grade "${properties.zekerheid}".`);
			continue;
		}

		// The map draws a circle from this. Without it there is nothing to draw, and a
		// default radius would be a number nobody researched.
		if (properties.weergave === 'benadering' && !properties.straal_m) {
			problems.push(`"${properties.plaats}" is an approximation with no radius.`);
			continue;
		}

		// The whole point of the mode is offering a choice, and one option is not a choice.
		if (properties.weergave === 'kandidaten' && (properties.kandidaten ?? []).length < 2) {
			problems.push(`"${properties.plaats}" is marked kandidaten but has fewer than two.`);
			continue;
		}

		// The panel exists to show this sentence. An empty one leaves a button under a
		// heading that promises an explanation and does not give one.
		if (properties.corrigeerbaar && blank(properties.twijfel)) {
			problems.push(`"${properties.plaats}" is correctable but says nothing about the doubt.`);
			continue;
		}

		// A person is not a place, and drawing one as an approximation says something the
		// archive itself denies. Tajje de Kotter was a man; the 58 photographs are of the
		// parade for his hundredth birthday, which crossed the whole municipality. The
		// research gave the row a 300 m circle around the street he was collected from, and
		// a circle means "the real location is somewhere in here" - which is exactly what
		// the same row's own doubt text says is not true.
		//
		// The coordinate is still worth keeping: it is where the parade set off. So the
		// marker stays and the panel stays; the circle and the claim that goes with it do
		// not.
		if (properties.type === 'persoon' && properties.weergave === 'benadering') {
			properties.weergave = 'punt_met_twijfel';
			properties.straal_m = null;
		}

		const entry: Approximation = {
			id: place.id,
			name: place.name,
			grade: properties.zekerheid,
			display: properties.weergave,
			note: properties.toelichting,
			correctable: properties.corrigeerbaar,
			priority: properties.prioriteit,
			kind: properties.type,
			outsideKapellen: Boolean(properties.buiten_kapellen)
		};

		if (feature.geometry) {
			const [lng, lat] = feature.geometry.coordinates;
			entry.lat = round(lat);
			entry.lng = round(lng);
		}

		if (properties.straal_m) entry.radius = properties.straal_m;
		if (!blank(properties.twijfel)) entry.doubt = properties.twijfel.trim();
		if (!blank(properties.onderzoek)) entry.research = properties.onderzoek.trim();

		if ((properties.kandidaten ?? []).length > 0) {
			entry.candidates = properties.kandidaten!.map((candidate) => ({
				lat: round(candidate.lat),
				lng: round(candidate.lon),
				label: candidate.label
			}));
		}

		if (properties.alias_van) {
			const target = byName.get(normalizeText(properties.alias_van));
			if (target) {
				entry.aliasOf = target.id;
			} else {
				// Not fatal. "Denneburgdreef is the register's Dennenburgdreef" is worth saying
				// even when the archive has no photographs filed under the register spelling -
				// it just cannot be a link to a page that does not exist.
				unresolvedAliases.push(`${properties.plaats} -> ${properties.alias_van}`);
			}
		}

		// Two rows resolving to one place would leave the second silently replacing the
		// first, and the row that vanished would take its photographs' only description
		// with it.
		if (approximations[place.id]) {
			problems.push(
				`"${properties.plaats}" and "${approximations[place.id].name}" both resolve to ` +
					`the place "${place.id}". One of them needs a different name.`
			);
			continue;
		}

		approximations[place.id] = entry;
	}

	if (problems.length > 0) {
		throw new Error(
			`plaatsen.geojson does not match this archive:\n  ${problems.join('\n  ')}\n\n` +
				'Fix the data rather than this script: a place quietly dropped here is a place ' +
				'that disappears from the map with nobody the wiser.'
		);
	}

	const counts = new Map<Display, number>();
	for (const entry of Object.values(approximations)) {
		counts.set(entry.display, (counts.get(entry.display) ?? 0) + 1);
	}

	const output = JSON.stringify(
		{
			version: 1,
			_comment:
				'Generated by `npm run plaatsen` from functions/src/data/plaatsen.geojson. Do not ' +
				'edit by hand. Every entry carries the confidence it was researched at; the map ' +
				'draws it according to `display` so that an approximation never looks like an ' +
				'address.',
			attribution: [
				'OpenStreetMap contributors (ODbL)',
				'Inventaris Onroerend Erfgoed',
				'Vlaams Adressenregister'
			],
			places: approximations
		},
		null,
		'\t'
	);

	fs.writeFileSync(OUTPUT_FILE, output + '\n');
	fs.writeFileSync(FUNCTIONS_COPY, output + '\n');

	const drawn = Object.values(approximations).filter(
		(entry) => entry.display !== 'niet_geplaatst' && !entry.outsideKapellen
	).length;
	const correctable = Object.values(approximations).filter((entry) => entry.correctable);
	const photos = correctable.reduce((total, entry) => total + entry.priority, 0);

	console.log(`Wrote ${Object.keys(approximations).length} places to ${OUTPUT_FILE}`);
	for (const display of DISPLAYS) {
		console.log(`   ${display.padEnd(18)} ${counts.get(display) ?? 0}`);
	}
	console.log(`   ${'on the map'.padEnd(18)} ${drawn}`);
	console.log(`   ${'correctable'.padEnd(18)} ${correctable.length} (${photos} photographs)`);

	if (unresolvedAliases.length > 0) {
		console.log('\nAliases kept as text, target not in the archive:');
		for (const alias of unresolvedAliases) console.log(`   ${alias}`);
	}
}

main();
