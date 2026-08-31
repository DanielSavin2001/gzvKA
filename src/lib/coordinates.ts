/**
 * Where the places of Kapellen are.
 *
 * Kept in `static/data/place-coordinates.json`, separate from the generated archive index,
 * because these are the one piece of archive data that a machine must never produce. Every
 * coordinate here was placed by a person clicking the map; none are derived from a fitted
 * transform, looked up from memory, or inferred from a name. A photograph pinned to the
 * wrong street stays wrong for years without anyone noticing.
 *
 * The file is small and hand-editable on purpose. Placing streets is done in the browser
 * at `/kaart`, which hands back a replacement for this file.
 */

import { loadPlacePins } from './place-pins';

/**
 * `locate` and the two record shapes it reads live in the shared models, so the jest suite
 * in `functions/` can reach them - the same reason `approximation.ts` gives for living
 * there. They are re-exported here because this is where every page imports them from, and
 * because "where a place is" and "how that answer is fetched" belong to one another.
 */
export type { PlacedCoordinate, StreetGeometry, CoordinateSource } from '../../sharedModels/locate';
export { locate } from '../../sharedModels/locate';

import type { PlacedCoordinate, StreetGeometry } from '../../sharedModels/locate';

export interface PlaceCoordinates {
	places: Record<string, PlacedCoordinate>;
}

/** Kapellen village centre, used only to open the map somewhere sensible. */
export const KAPELLEN_CENTRE: [number, number] = [4.4295, 51.3125];

/** A generous bounding box for the municipality, used to reject an obvious mis-click. */
export const KAPELLEN_BOUNDS = { minLng: 4.32, maxLng: 4.55, minLat: 51.25, maxLat: 51.4 };

/** True when a coordinate is plausibly inside Kapellen. */
export function isWithinKapellen(lat: number, lng: number): boolean {
	return (
		lat >= KAPELLEN_BOUNDS.minLat &&
		lat <= KAPELLEN_BOUNDS.maxLat &&
		lng >= KAPELLEN_BOUNDS.minLng &&
		lng <= KAPELLEN_BOUNDS.maxLng
	);
}

export interface StreetGeometryFile {
	version: number;
	streets: Record<string, StreetGeometry>;
}

let cached: PlaceCoordinates | null = null;
let geometryCache: Record<string, StreetGeometry> | null = null;

/**
 * The committed half of the answer, or null when the fetch failed - so a transient error is
 * distinguishable from a genuinely empty file and never cached as "none placed".
 */
export async function loadCommittedPlaces(
	fetcher: typeof fetch = fetch
): Promise<Record<string, PlacedCoordinate> | null> {
	try {
		const response = await fetcher('/data/place-coordinates.json');
		if (!response.ok) return null;

		const parsed = (await response.json()) as Partial<PlaceCoordinates>;
		return parsed.places ?? {};
	} catch {
		return null;
	}
}

/**
 * Loads the placed coordinates. Missing or unreadable means "none placed yet", not an error.
 *
 * Two layers merged into one answer: the committed file, and the live pins a curator placed
 * on /beheer since the last deploy. A pin wins over the file - it is the newer judgement of
 * the same kind of person. Both halves fail soft, so the map draws whatever is reachable -
 * but a failed half is never cached, so the next call retries instead of freezing an empty
 * answer for the whole session.
 */
export async function loadCoordinates(fetcher: typeof fetch = fetch): Promise<PlaceCoordinates> {
	if (cached) return cached;

	const [committed, pins] = await Promise.all([
		loadCommittedPlaces(fetcher),
		loadPlacePins(fetcher)
	]);

	const merged = { places: { ...(committed ?? {}), ...(pins ?? {}) } };
	if (committed !== null && pins !== null) cached = merged;
	return merged;
}

/** Forgets what was fetched, so a curator sees their own pin without a reload. */
export function forgetCoordinates(): void {
	cached = null;
}

/**
 * Loads the street centrelines derived from the official register by `npm run streets`.
 *
 * Missing means "no geometry", never an error: the map still works from hand-placed
 * coordinates alone, which is how it worked before the register existed.
 */
export async function loadStreetGeometry(
	fetcher: typeof fetch = fetch
): Promise<Record<string, StreetGeometry>> {
	if (geometryCache) return geometryCache;

	try {
		const response = await fetcher('/data/street-geometry.json');
		if (!response.ok) return {};

		const parsed = (await response.json()) as Partial<StreetGeometryFile>;
		geometryCache = parsed.streets ?? {};
		return geometryCache;
	} catch {
		return {};
	}
}

/** Rounds to about a metre - more precision than that is false precision from a map click. */
export function roundCoordinate(value: number): number {
	return Math.round(value * 1e5) / 1e5;
}
