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

let cached: PlaceCoordinates | null = null;

/** Loads the placed coordinates. Missing or unreadable means "none placed yet", not an error. */
export async function loadCoordinates(fetcher: typeof fetch = fetch): Promise<PlaceCoordinates> {
	if (cached) return cached;

	try {
		const response = await fetcher('/data/place-coordinates.json');
		if (!response.ok) return { places: {} };

		const parsed = (await response.json()) as Partial<PlaceCoordinates>;
		cached = { places: parsed.places ?? {} };
		return cached;
	} catch {
		return { places: {} };
	}
}

/** Rounds to about a metre - more precision than that is false precision from a map click. */
export function roundCoordinate(value: number): number {
	return Math.round(value * 1e5) / 1e5;
}
