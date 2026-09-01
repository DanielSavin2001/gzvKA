/**
 * Places a curator created or corrected, fetched live.
 *
 * The committed gazetteer is the durable record; this overlay is what makes adding Kasteel
 * Appel a click instead of a clone. It fails soft exactly as the pin and photo-edit overlays
 * do: no backend, no network, or a nonsense answer all mean "no extra places", and the site
 * shows what the generated index says.
 */

import type { PlaceKind } from '../../sharedModels/gazetteer';
import { readCuratorApproximation, readCuratorGeometry } from '../../sharedModels/place-overlay';
import type { PlaceRecord, PlaceRecordFile } from '../../sharedModels/place-record';
import { CURATOR_KINDS } from '../../sharedModels/place-record';

/**
 * The kinds a stored record may carry. `person` is not one a curator can choose, but the
 * gazetteer has one and a correction to it would be legitimate, so it is accepted here.
 */
const KNOWN_KINDS: PlaceKind[] = [...CURATOR_KINDS, 'person'];

export type { PlaceRecord } from '../../sharedModels/place-record';
export { withApproximationRecords, withGeometryRecords } from '../../sharedModels/place-overlay';

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/** Bounded, because a visitor is waiting on it - the same three seconds the pins use. */
const TIMEOUT_MS = 3_000;

let cache: Record<string, PlaceRecord> | null = null;

/**
 * A record is only usable if it has the fields the site reads. A payload that parses but is
 * the wrong shape must not reach `buildArchive`, which iterates places without guarding -
 * the lesson `loadPublished` already learned the hard way.
 */
function usable(value: unknown): value is PlaceRecord {
	if (!value || typeof value !== 'object') return false;

	// Read through an unknown-valued view rather than `Partial<PlaceRecord>`: the point is
	// that this payload may be nothing like a PlaceRecord, and typing it as a partial one
	// asserts the very thing being checked.
	const record = value as Record<string, unknown>;
	const text = (field: unknown): boolean => typeof field === 'string' && field.trim() !== '';

	// The kind decides the browse family and the marker colour, so an unknown one is not
	// merely missing information - it would file the place somewhere arbitrary.
	return text(record.id) && text(record.name) && KNOWN_KINDS.includes(record.kind as PlaceKind);
}

/**
 * A record with anything unreadable in its two optional blocks dropped from it.
 *
 * The same readers the endpoint validates with, run again on the way out. Not belt and
 * braces: a stored record predates the reader that is running now - a field renamed, a
 * ceiling lowered - and the merges downstream build a marker and a circle out of these
 * without guarding. Dropping one block is much better than dropping the place, because the
 * place is what the photographs point at.
 */
function readable(record: PlaceRecord): PlaceRecord {
	const kept: PlaceRecord = { ...record };

	try {
		const approximation = readCuratorApproximation(record.approximation);
		if (approximation) kept.approximation = approximation;
		else delete kept.approximation;
	} catch {
		delete kept.approximation;
	}

	try {
		const geometry = readCuratorGeometry(record.geometry);
		if (geometry) kept.geometry = geometry;
		else delete kept.geometry;
	} catch {
		delete kept.geometry;
	}

	return kept;
}

/** The records, or null when they could not be fetched - null is "unknown", not "none". */
export async function loadPlaceRecords(
	fetcher: typeof fetch = fetch,
	options: { fresh?: boolean } = {}
): Promise<Record<string, PlaceRecord> | null> {
	if (cache && !options.fresh) return cache;

	// No backend configured: the normal state for a fresh clone; the site works without it.
	if (!FUNCTIONS_BASE) return {};

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}placeRecords`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			...(options.fresh ? { cache: 'reload' as RequestCache } : {})
		});
		if (!response.ok) return null;

		const parsed = (await response.json()) as Partial<PlaceRecordFile>;
		const kept: Record<string, PlaceRecord> = {};
		for (const [id, record] of Object.entries(parsed.places ?? {})) {
			if (usable(record)) kept[id] = readable(record);
		}

		cache = kept;
		return cache;
	} catch {
		return null;
	}
}

/** Forgets what was fetched, so a curator sees their own place without a reload. */
export function forgetPlaceRecords(): void {
	cache = null;
}
