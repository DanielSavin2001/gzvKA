/**
 * A place a curator created or corrected, live.
 *
 * Every one of the 131 places is a build-time artefact: `functions/src/gazetteer/seed.ts` ->
 * `npm run gazetteer:build` -> `npm run archive:index` -> `static/data/archive-index.json`,
 * and the site's list of places is that file. So until now a curator could file a photograph
 * under a place that exists and under nothing else. Kasteel Appel is not in the gazetteer;
 * there was no way to say so except to clone the repository.
 *
 * This is the same overlay idea as `place-pin.ts` one level up: the pin says where a place
 * is, and this says that the place exists at all, what it is called, and what it sits under.
 * The site merges these over the generated index exactly as it merges pins over the
 * committed coordinates, and the next `npm run archive:index` folds them into the file.
 *
 * ## Why a new place works on a fully prerendered site
 *
 * It looks as though it cannot: `/straat/[slug]` is prerendered from a list read off disk, so
 * a new id has no HTML file. But the build is `adapter-static` with `fallback: '200.html'`
 * and hosting rewrites `**` to it, so an unknown path serves the shell, the router boots and
 * the page renders from the merged archive. A new place is therefore real everywhere a
 * visitor can reach it - the maps, the browse lists, search, the photo pages - and only lacks
 * prerendered HTML for crawlers until the next build. That is the same bargain an approved
 * upload already makes.
 *
 * ## What it deliberately cannot do
 *
 * It cannot delete a place, and it cannot rename a gazetteer id. An id is what photographs,
 * stories, pins and the sitemap all point at; changing one at runtime would strand every one
 * of them. Renaming here changes the NAME, which is what a reader sees; the id stays.
 */

import type { District, PlaceKind } from './gazetteer';
import type { CuratorApproximation, CuratorGeometry } from './place-overlay';
import { readCuratorApproximation, readCuratorGeometry } from './place-overlay';

/** The kinds a curator may choose. `person` is excluded: it is not a place, and the one entry that uses it was a judgement about an existing record rather than something to create more of. */
export const CURATOR_KINDS: PlaceKind[] = [
	'street',
	'square',
	'park',
	'castle-estate',
	'fort',
	'building',
	'area'
];

export const DISTRICTS: District[] = [
	'kapellen',
	'hoogboom',
	'putte-kapellen',
	'ertbrand',
	'unknown'
];

/** One place created or corrected by a curator. */
export interface PlaceRecord {
	id: string;
	name: string;
	kind: PlaceKind;
	/**
	 * The place this one sits under - "Station Kapellen" under "Stations", or the near end of
	 * a street under the street. Optional, and a place without one behaves exactly as every
	 * place did before this existed.
	 */
	parentId?: string;
	district?: District;
	/**
	 * Where the place is and how sure we are, when a curator has said so. Read and written by
	 * `place-overlay.ts`, which explains why this is a subset of `Approximation` rather than
	 * one: a curator sets the judgement, the build keeps the counts.
	 */
	approximation?: CuratorApproximation;
	/** A shape drawn by hand, laid over whatever the street register says. */
	geometry?: CuratorGeometry;
	/** The curator's email. */
	by: string;
	/** ISO date. */
	on: string;
}

/** What the public endpoint answers. */
export interface PlaceRecordFile {
	version: number;
	places: Record<string, PlaceRecord>;
}

/** Raised when a record cannot be stored. The message is shown to the curator. */
export class PlaceRecordError extends Error {}

/** Gazetteer ids are slugs; anything else in the id position is a mistake or a probe. */
const PLACE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

const MAX_NAME = 120;

/**
 * A slug from a name, matching what the gazetteer build produces, so a place created here
 * and the same place added to `seed.ts` later land on one id rather than two.
 */
export function placeIdFrom(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** Reads a save request into something safe to store. */
export function readPlaceRecord(input: Record<string, unknown>): Omit<PlaceRecord, 'by' | 'on'> {
	const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
	if (!name) throw new PlaceRecordError('Geef de plaats een naam.');
	if (name.length > MAX_NAME) throw new PlaceRecordError('Die naam is te lang.');

	// An explicit id is honoured so an existing gazetteer place can be corrected; otherwise
	// the name decides, the same way the gazetteer build decides.
	const asked = typeof input.id === 'string' ? input.id.trim() : '';
	const id = asked || placeIdFrom(name);
	if (!PLACE_ID.test(id)) throw new PlaceRecordError('Die naam levert geen bruikbare id op.');

	const kind = typeof input.kind === 'string' ? (input.kind as PlaceKind) : ('area' as PlaceKind);
	if (!CURATOR_KINDS.includes(kind)) throw new PlaceRecordError('Onbekende soort plaats.');

	const record: Omit<PlaceRecord, 'by' | 'on'> = { id, name, kind };

	const parentId = typeof input.parentId === 'string' ? input.parentId.trim() : '';
	if (parentId) {
		if (!PLACE_ID.test(parentId)) throw new PlaceRecordError('Onbekende bovenliggende plaats.');
		if (parentId === id) throw new PlaceRecordError('Een plaats kan niet onder zichzelf staan.');
		record.parentId = parentId;
	}

	if (typeof input.district === 'string' && input.district) {
		const district = input.district as District;
		if (!DISTRICTS.includes(district)) throw new PlaceRecordError('Onbekende deelgemeente.');
		record.district = district;
	}

	// Both optional and both all-or-nothing: an omitted block means "this record says nothing
	// about that", and the site falls back to the shipped research or the street register.
	// Clearing one is therefore expressible, which matters because `save` writes the whole
	// record - see the note on the `set` there.
	const approximation = readCuratorApproximation(input.approximation);
	if (approximation) record.approximation = approximation;

	const geometry = readCuratorGeometry(input.geometry);
	if (geometry) record.geometry = geometry;

	return record;
}

/**
 * Whether making `parentId` the parent of `id` would close a loop.
 *
 * Walks up from the proposed parent. A loop is not a theoretical worry: two saves - A under
 * B, then B under A - is an easy pair of clicks, and any code that later walks the chain to
 * build a breadcrumb would hang rather than fail.
 */
export function wouldLoop(
	id: string,
	parentId: string,
	records: Record<string, { parentId?: string }>
): boolean {
	const seen = new Set<string>([id]);

	let current: string | undefined = parentId;
	while (current) {
		if (seen.has(current)) return true;
		seen.add(current);
		current = records[current]?.parentId;
	}

	return false;
}

/** True for the kinds the site files under "straten". Derived, never stored: the gazetteer's own `isStreet` is exactly this. */
export function isStreetKind(kind: PlaceKind): boolean {
	return kind === 'street' || kind === 'square';
}

/**
 * The little of a place this merge reads and writes.
 *
 * Structural rather than imported, for the reason `place-family.ts` gives about the same
 * problem: `ArchivePlace` lives in `src/lib`, which runs under Vite and which the jest suite
 * in `functions/` cannot see - and this function decides whether a place exists at all, so
 * it is the last thing that should go untested.
 */
export interface MergeablePlace {
	id: string;
	name: string;
	kind: string;
	district: string;
	isStreet: boolean;
	count: number;
	parentId?: string;
}

/**
 * The generated places, with a curator's corrections laid over them and their new ones added.
 *
 * Two different operations through one door. A record whose id the gazetteer already knows is
 * a correction - a better name, a kind that was wrong, a parent it belongs under - and only
 * the fields a curator can set are taken, so `count` and anything the build knows better
 * survive. A record with an id the gazetteer has never seen is a new place, appended.
 *
 * `isStreet` is derived rather than carried, because in the gazetteer it is exactly
 * "kind is street or square" across all 131 entries. Storing it separately would let the two
 * disagree, and the browse family reads both.
 */
export function withPlaceRecords(
	places: MergeablePlace[],
	records: Record<string, PlaceRecord>
): MergeablePlace[] {
	const merged = places.map((place) => {
		const record = records[place.id];
		if (!record) return place;

		return {
			...place,
			name: record.name,
			kind: record.kind,
			isStreet: isStreetKind(record.kind),
			...(record.district ? { district: record.district } : {}),
			...(record.parentId ? { parentId: record.parentId } : {})
		};
	});

	const known = new Set(places.map((place) => place.id));
	for (const record of Object.values(records)) {
		if (known.has(record.id)) continue;

		merged.push({
			id: record.id,
			name: record.name,
			kind: record.kind,
			district: record.district ?? 'unknown',
			isStreet: isStreetKind(record.kind),
			// Recounted from the photographs a moment later, like every other place.
			count: 0,
			...(record.parentId ? { parentId: record.parentId } : {})
		});
	}

	return merged;
}
