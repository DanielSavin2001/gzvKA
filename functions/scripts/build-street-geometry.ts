/**
 * Puts the archive on the map, from the official street register.
 *
 * Until now no photograph in this archive had a coordinate. The map at `/kaart` worked, but
 * every place on it had to be positioned by hand, one click at a time, because a coordinate
 * invented by a machine puts a photograph in the wrong street permanently and nobody ever
 * notices.
 *
 * The street register in `functions/src/data/streets/` removes that problem rather than
 * working around it: it is the real centreline of every street in Kapellen and Stabroek,
 * with its name. Joining a gazetteer place to its register entry by name is an exact
 * lookup, not a guess - so the coordinates it produces are derived from an authoritative
 * source and are reproducible, which is a different thing from being invented.
 *
 * Two files come out:
 *
 *   static/data/street-geometry.json   centreline and midpoint per matched place
 *   docs/streets-not-in-register.md    the places the register does not know
 *
 * That second file is the interesting one for the archive. A street the modern register has
 * never heard of is a street that was renamed or built over, which is evidence about the
 * photographs filed under it.
 *
 * Human-placed coordinates still win: `place-coordinates.json` is not touched by this, and
 * the site prefers a coordinate a person clicked over one derived here.
 *
 * Usage, from the repository root:
 *
 *   npm run streets
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer } from '../../sharedModels/gazetteer';
import { normalizeText, slugify } from '../../sharedModels/text';

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
const STREET_DIR = path.join(REPO_ROOT, 'functions', 'src', 'data', 'streets');
const GAZETTEER_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');
const ARCHIVE_INDEX = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const OUTPUT_FILE = path.join(REPO_ROOT, 'static', 'data', 'street-geometry.json');
const REPORT_FILE = path.join(REPO_ROOT, 'docs', 'streets-not-in-register.md');
const REGISTER_OUTPUT = path.join(REPO_ROOT, 'static', 'data', 'street-register.json');

const REGISTER_FILES = ['11023_Kapellen_streets.geojson', '11044_Stabroek_streets.geojson'];

/**
 * How far a simplified line may stray from the original, in degrees. About 1.1 metres of
 * latitude, which is finer than the street is wide - the shape stays true while the file
 * stays small enough to ship to a browser.
 */
const SIMPLIFY_TOLERANCE = 0.00001;

type Position = [number, number];

interface RegisterFeature {
	properties: {
		name: string;
		municipality: string;
		length_m?: number;
		lat?: number;
		lon?: number;
	};
	geometry: { type: string; coordinates: unknown };
}

/** The register's own key for a name: case, accents and punctuation carry no meaning here. */
function registerKey(name: string): string {
	return normalizeText(name).replace(/[^a-z0-9]+/g, '');
}

function readRegister(): Map<string, RegisterFeature[]> {
	const byKey = new Map<string, RegisterFeature[]>();

	for (const fileName of REGISTER_FILES) {
		const collection = JSON.parse(fs.readFileSync(path.join(STREET_DIR, fileName), 'utf8')) as {
			features: RegisterFeature[];
		};

		for (const feature of collection.features) {
			const key = registerKey(feature.properties.name);
			if (key === '') continue;

			const existing = byKey.get(key);
			if (existing) existing.push(feature);
			else byKey.set(key, [feature]);
		}
	}

	return byKey;
}

/**
 * Keeps one municipality's copy of a name.
 *
 * 28 street names exist in both Kapellen and Stabroek - Dorpsstraat, Kerkstraat,
 * Antwerpsesteenweg and so on - and they are different streets kilometres apart. Taking
 * both put Kapellen's Dorpsstraat at 4.368, halfway to Hoevenen and nowhere near the
 * street the photographs are of. This is the Kapellen archive, so Kapellen wins; a name
 * only Stabroek has still resolves, which matters for the Putte end of the parish.
 */
function preferKapellen(features: RegisterFeature[]): RegisterFeature[] {
	const kapellen = features.filter((feature) => feature.properties.municipality === 'Kapellen');
	return kapellen.length > 0 ? kapellen : features;
}

/** Every line in a feature, whatever geometry type the register used for it. */
function linesOf(feature: RegisterFeature): Position[][] {
	const { type, coordinates } = feature.geometry;

	if (type === 'MultiLineString') return coordinates as Position[][];
	if (type === 'LineString') return [coordinates as Position[]];
	// Five streets in the register have only address points rather than a centreline.
	if (type === 'MultiPoint') return [coordinates as Position[]];
	if (type === 'Point') return [[coordinates as Position]];
	return [];
}

/**
 * Ramer-Douglas-Peucker. The register carries every vertex OpenStreetMap has, which is far
 * more than a map at this zoom can show; keeping it all would triple the file for detail no
 * one can see.
 */
function simplify(points: Position[], tolerance: number): Position[] {
	if (points.length <= 2) return points;

	let worst = 0;
	let index = 0;
	for (let i = 1; i < points.length - 1; i += 1) {
		const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
		if (distance > worst) {
			worst = distance;
			index = i;
		}
	}

	if (worst <= tolerance) return [points[0], points[points.length - 1]];

	return [
		...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
		...simplify(points.slice(index), tolerance)
	];
}

function perpendicularDistance(point: Position, start: Position, end: Position): number {
	const [x, y] = point;
	const [x1, y1] = start;
	const [x2, y2] = end;

	const dx = x2 - x1;
	const dy = y2 - y1;
	if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);

	const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function round(value: number): number {
	// Five decimals is about a metre. The register's extra digits are false precision here.
	return Math.round(value * 1e5) / 1e5;
}

/**
 * The point halfway along the street, by distance rather than by vertex count.
 *
 * A plain average of the vertices drifts towards whichever end has more of them, which for
 * a street with a curve at one end puts its marker off the road entirely.
 */
function midpoint(lines: Position[][]): Position {
	const longest = lines.reduce((best, line) => (line.length > best.length ? line : best), lines[0]);
	if (longest.length === 1) return longest[0];

	const lengths: number[] = [];
	let total = 0;
	for (let i = 1; i < longest.length; i += 1) {
		const segment = Math.hypot(
			longest[i][0] - longest[i - 1][0],
			longest[i][1] - longest[i - 1][1]
		);
		lengths.push(segment);
		total += segment;
	}

	let travelled = 0;
	for (let i = 0; i < lengths.length; i += 1) {
		if (travelled + lengths[i] >= total / 2) {
			const along = lengths[i] === 0 ? 0 : (total / 2 - travelled) / lengths[i];
			return [
				longest[i][0] + along * (longest[i + 1][0] - longest[i][0]),
				longest[i][1] + along * (longest[i + 1][1] - longest[i][1])
			];
		}
		travelled += lengths[i];
	}

	return longest[longest.length - 1];
}

interface StreetGeometry {
	name: string;
	municipality: string;
	/** Midpoint of the street, where its marker goes. */
	lat: number;
	lng: number;
	/** Simplified centreline(s), as [lng, lat] pairs. */
	lines: Position[][];
	/** Metres, from the register. */
	length?: number;
}

/**
 * Every street the register knows, so the site can answer for the ones it has no photograph
 * of.
 *
 * The archive holds photographs of 45 streets. Kapellen has 313. The most common visit is
 * somebody typing the street they grew up in, and for 277 of them that failed completely -
 * no page, no map, no suggestion, and a search box replying "Probeer een straatnaam". The
 * site even contradicted itself: `/straten` advertises its index as running "van de
 * Antwerpsesteenweg tot de Zilverenhoeklaan", and the Zilverenhoeklaan had no page.
 *
 * Name, slug, point and length only - about 20 KB for the lot. No centreline: this file is
 * for a page that says "this street exists, here it is, we have no photograph of it yet",
 * and a shape would be forty times the size for a sentence that does not need one.
 *
 * A street the gazetteer already knows is skipped, because that street has a real page with
 * a map, house numbers and stories on it.
 */
function writeStreetRegister(
	register: Map<string, RegisterFeature[]>,
	placed: Set<string>,
	counts: Map<string, number>
): void {
	const streets: { slug: string; name: string; lat: number; lng: number; length?: number }[] = [];

	for (const features of register.values()) {
		const kapellen = preferKapellen(features);
		if (!kapellen || kapellen[0].properties.municipality !== 'Kapellen') continue;

		const name = kapellen[0].properties.name;
		const slug = slugify(name);
		if (!slug) continue;

		// The archive's own page is the better page wherever it exists - it carries the
		// photographs, the map, the house numbers and the stories.
		if (placed.has(slug) || counts.has(slug)) continue;

		const [lng, lat] = midpoint(kapellen.flatMap(linesOf).filter((line) => line.length > 0));
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

		const length = kapellen.reduce((sum, feature) => sum + (feature.properties.length_m ?? 0), 0);

		streets.push({
			slug,
			name,
			lat: round(lat),
			lng: round(lng),
			...(length > 0 ? { length: Math.round(length) } : {})
		});
	}

	streets.sort((one, two) => one.name.localeCompare(two.name, 'nl'));

	fs.writeFileSync(
		REGISTER_OUTPUT,
		JSON.stringify({
			version: 1,
			_comment:
				'Every street in Kapellen that the official register knows and this archive has no ' +
				'photograph of, from `npm run streets`. It exists so that somebody who types their own ' +
				'street gets an answer instead of a shrug. Streets the archive does have are not here: ' +
				'they have a real page.',
			streets
		}),
		'utf8'
	);

	console.log(`Register       ${streets.length} streets with no photographs yet`);
}

function main(): void {
	const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf8')) as Gazetteer;
	const register = readRegister();

	const counts = new Map<string, number>();
	if (fs.existsSync(ARCHIVE_INDEX)) {
		const archive = JSON.parse(fs.readFileSync(ARCHIVE_INDEX, 'utf8')) as {
			places: { id: string; count: number }[];
		};
		for (const place of archive.places) counts.set(place.id, place.count);
	}

	const streets: Record<string, StreetGeometry> = {};
	const unmatched: { id: string; name: string; kind: string; count: number }[] = [];

	for (const entry of gazetteer.entries) {
		// The register lists streets. A castle, a wood or a district is legitimately absent
		// from it, so only a street's absence tells us anything.
		const found = [entry.name, ...entry.aliases]
			.map((name) => register.get(registerKey(name)))
			.find((match): match is RegisterFeature[] => match !== undefined);

		const features = found ? preferKapellen(found) : undefined;

		if (!features) {
			if (entry.isStreet) {
				unmatched.push({
					id: entry.id,
					name: entry.name,
					kind: entry.kind,
					count: counts.get(entry.id) ?? 0
				});
			}
			continue;
		}

		const lines = features
			.flatMap(linesOf)
			.filter((line) => line.length > 0)
			.map((line) =>
				simplify(line, SIMPLIFY_TOLERANCE).map(([x, y]) => [round(x), round(y)] as Position)
			);

		if (lines.length === 0) continue;

		const [lng, lat] = midpoint(lines);
		const length = features.reduce((sum, feature) => sum + (feature.properties.length_m ?? 0), 0);

		streets[entry.id] = {
			name: entry.name,
			municipality: features[0].properties.municipality,
			lat: round(lat),
			lng: round(lng),
			lines,
			...(length > 0 ? { length: Math.round(length) } : {})
		};
	}

	fs.writeFileSync(
		OUTPUT_FILE,
		JSON.stringify({
			version: 1,
			_comment:
				'Derived from the official street register in functions/src/data/streets/ by ' +
				'`npm run streets`. Joined to the gazetteer by exact name, never by guesswork. ' +
				'A coordinate a person placed in place-coordinates.json still wins over anything here.',
			streets
		}),
		'utf8'
	);

	writeStreetRegister(register, new Set(Object.keys(streets)), counts);
	writeReport(unmatched, register.size);

	const placed = Object.keys(streets).length;
	const withPhotos = Object.keys(streets).filter((id) => (counts.get(id) ?? 0) > 0).length;

	console.log(`Register       ${register.size} street names across Kapellen and Stabroek`);
	console.log(`Placed         ${placed} gazetteer places, ${withPhotos} of them with photographs`);
	console.log(
		`Not in it      ${unmatched.length} streets - see ${path.relative(REPO_ROOT, REPORT_FILE)}`
	);
	console.log(
		`Output         ${path.relative(REPO_ROOT, OUTPUT_FILE)} ` +
			`(${Math.round(fs.statSync(OUTPUT_FILE).size / 1024)} KB)`
	);
}

function writeReport(
	unmatched: { id: string; name: string; kind: string; count: number }[],
	registerSize: number
): void {
	const withPhotos = unmatched.filter((street) => street.count > 0);

	const lines = [
		'# Streets the register does not know',
		'',
		'Generated by `npm run streets`. Do not edit by hand.',
		'',
		`The street register in \`functions/src/data/streets/\` lists ${registerSize} street names`,
		'across Kapellen and Stabroek as they stand today. The streets below are in this',
		"archive's gazetteer but not in that register.",
		'',
		'That is **evidence, not proof**. A street can be missing from it because it was',
		'renamed, because it was built over, because it is a path or a place rather than a',
		'street, or because this archive spells it differently from the register. Each one',
		'needs a person to say which - the municipal archive is the place to settle it.',
		'',
		`## ${withPhotos.length} with photographs in the archive`,
		'',
		"These matter most: photographs are filed under a name today's Kapellen does not use.",
		'',
		'| Street | Photographs | Kind |',
		'| --- | --- | --- |',
		...withPhotos
			.sort((a, b) => b.count - a.count)
			.map((street) => `| ${street.name} | ${street.count} | ${street.kind} |`),
		''
	];

	const withoutPhotos = unmatched.filter((street) => street.count === 0);
	if (withoutPhotos.length > 0) {
		lines.push(
			`## ${withoutPhotos.length} with no photographs yet`,
			'',
			withoutPhotos
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((street) => `- ${street.name}`)
				.join('\n'),
			''
		);
	}

	fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
	fs.writeFileSync(REPORT_FILE, lines.join('\n'), 'utf8');
}

main();
