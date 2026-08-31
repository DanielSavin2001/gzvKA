/**
 * A coordinate a curator placed for a whole place - a castle, a wijk, a café.
 *
 * This is the live counterpart of `static/data/place-coordinates.json`: same meaning, same
 * shape, but stored in Firestore so a click on the beheer page moves the map immediately
 * instead of waiting for somebody to download a file, replace it in the repository and
 * deploy. The site merges these pins over the committed file, and a pin always wins - it is
 * the newer judgement.
 *
 * A pin is the one coordinate tier a machine must never write. Every entry records who
 * placed it and when, so a doubtful pin can be asked about.
 */

/** One placed coordinate, with its provenance. */
export interface PlacePin {
	lat: number;
	lng: number;
	/** The curator's email. */
	by: string;
	/** ISO date it was placed. */
	on: string;
}

/** What the public endpoint answers. */
export interface PlacePinFile {
	version: number;
	pins: Record<string, PlacePin>;
}

/** Raised when a pin cannot be stored. The message is shown to the curator. */
export class PlacePinError extends Error {}

/** What a save request must carry. */
export interface PlacePinRequest {
	placeId: string;
	lat: number;
	lng: number;
}

/** Gazetteer ids are slugs; anything else in the id position is a mistake or a probe. */
const PLACE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/**
 * Reads a save request into something safe to store.
 *
 * The place id is not checked against the gazetteer here - the functions bundle does not
 * carry it - but a pin for an unknown id is harmless: nothing on the site asks for it, and
 * the beheer page only offers real places to pin.
 */
export function readPlacePin(input: Record<string, unknown>): PlacePinRequest {
	const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
	if (!PLACE_ID.test(placeId)) {
		throw new PlacePinError('Geen plaats opgegeven.');
	}

	// Real numbers only: `Number(null)` and `Number('')` are 0, which is a finite, in-range
	// coordinate on the equator - exactly the silent mis-pin this reader exists to refuse.
	const lat = typeof input.lat === 'number' ? input.lat : NaN;
	const lng = typeof input.lng === 'number' ? input.lng : NaN;
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		throw new PlacePinError('De coördinaat is onleesbaar.');
	}
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		throw new PlacePinError('De coördinaat ligt buiten de wereld.');
	}

	// About a metre. More precision than a map click supports would be false.
	const round = (value: number): number => Math.round(value * 1e5) / 1e5;

	return { placeId, lat: round(lat), lng: round(lng) };
}

/** Reads a remove request: only the place id, validated the same way. */
export function readPlacePinRemoval(input: Record<string, unknown>): string {
	const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
	if (!PLACE_ID.test(placeId)) {
		throw new PlacePinError('Geen plaats opgegeven.');
	}
	return placeId;
}
