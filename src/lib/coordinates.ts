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

import type { Approximation } from '../../sharedModels/approximation';
import { loadPlacePins } from './place-pins';

/** One placed coordinate, with who placed it and when. */
export interface PlacedCoordinate {
	lat: number;
	lng: number;
	/** Who placed it, so a doubtful pin can be asked about. */
	by?: string;
	/** ISO date it was placed. */
	on?: string;
}

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

/** A street's real centreline, from the official register. */
export interface StreetGeometry {
	name: string;
	municipality: string;
	lat: number;
	lng: number;
	/** Simplified centreline(s) as [lng, lat] pairs, ready to draw. */
	lines: [number, number][][];
	/** Metres. */
	length?: number;
}

export interface StreetGeometryFile {
	version: number;
	streets: Record<string, StreetGeometry>;
}

let cached: PlaceCoordinates | null = null;
let geometryCache: Record<string, StreetGeometry> | null = null;

/**
 * Loads the placed coordinates. Missing or unreadable means "none placed yet", not an error.
 *
 * Two layers merged into one answer: the committed file, and the live pins a curator placed
 * on /beheer since the last deploy. A pin wins over the file - it is the newer judgement of
 * the same kind of person. Both halves fail soft, so the map draws whatever is reachable.
 */
export async function loadCoordinates(fetcher: typeof fetch = fetch): Promise<PlaceCoordinates> {
	if (cached) return cached;

	const committed = await (async (): Promise<Record<string, PlacedCoordinate>> => {
		try {
			const response = await fetcher('/data/place-coordinates.json');
			if (!response.ok) return {};

			const parsed = (await response.json()) as Partial<PlaceCoordinates>;
			return parsed.places ?? {};
		} catch {
			return {};
		}
	})();

	const pins = await loadPlacePins(fetcher);

	cached = { places: { ...committed, ...pins } };
	return cached;
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

/** Where a coordinate came from, worst case last. */
export type CoordinateSource = 'placed' | 'register' | 'onderzoek';

/**
 * Where a place is, best source first.
 *
 * A coordinate a person clicked always beats one derived from the register. The register is
 * authoritative about where the Dorpsstraat runs, but a curator who moved a place did so
 * for a reason - the castle sits back from the road, the photograph is of the far end - and
 * that judgement is worth more than a centreline midpoint.
 *
 * Researched places come last, and deliberately so: they are the only tier that can be
 * wrong by hundreds of metres. `source` is returned rather than discarded precisely so a
 * caller can tell the three apart - a map that cannot distinguish a clicked pin from a
 * reading of a sentence will draw them the same, and then nobody knows which to trust.
 *
 * This answers "where is it", not "should it be drawn". A place outside Kapellen has a
 * perfectly good coordinate and still does not belong on a map of Kapellen; that is
 * `isDrawable`'s decision, not this one.
 */
export function locate(
	placeId: string,
	placedCoordinates: Record<string, PlacedCoordinate>,
	geometry: Record<string, StreetGeometry>,
	approximations: Record<string, Approximation> = {}
): { lat: number; lng: number; source: CoordinateSource } | null {
	const byHand = placedCoordinates[placeId];
	if (byHand) return { lat: byHand.lat, lng: byHand.lng, source: 'placed' };

	const derived = geometry[placeId];
	if (derived) return { lat: derived.lat, lng: derived.lng, source: 'register' };

	const researched = approximations[placeId];
	if (researched && researched.lat != null && researched.lng != null) {
		return { lat: researched.lat, lng: researched.lng, source: 'onderzoek' };
	}

	return null;
}

/** Rounds to about a metre - more precision than that is false precision from a map click. */
export function roundCoordinate(value: number): number {
	return Math.round(value * 1e5) / 1e5;
}
