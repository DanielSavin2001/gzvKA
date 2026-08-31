/**
 * Where curator-placed coordinates for whole places live.
 *
 * Firestore rather than the repository, for the same reason as the photo edits: a pin has
 * to move the map the moment it is placed, and "download a file, replace it, commit,
 * deploy" is how 24 places stayed unplaced for a year. The committed
 * `static/data/place-coordinates.json` remains the durable record - the beheer page can
 * export the merged set for a commit - but the live answer comes from here.
 *
 * Pins are readable by anyone: like a photo edit, a pin is site content the moment it is
 * made. Only placing one is protected.
 */

import type { PlacePin, PlacePinRequest } from '../../../sharedModels/place-pin';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const PLACE_PIN_COLLECTION = 'place-pins';

/**
 * A ceiling, not a cursor: the archive knows about 131 places, so a thousand pins means
 * something is writing that should not be.
 */
const MAX_PINS = 1000;

/** Stores one pin, replacing whatever was there for that place. */
export async function save(request: PlacePinRequest, curator: AdminIdentity): Promise<PlacePin> {
	const pin: PlacePin = {
		lat: request.lat,
		lng: request.lng,
		by: curator.email,
		on: new Date().toISOString().slice(0, 10)
	};

	await firestore.collection(PLACE_PIN_COLLECTION).doc(request.placeId).set(pin);
	return pin;
}

/** Every pin, keyed by place id. Public. */
export async function all(): Promise<Record<string, PlacePin>> {
	const snapshot = await firestore.collection(PLACE_PIN_COLLECTION).limit(MAX_PINS).get();

	const pins: Record<string, PlacePin> = {};
	for (const document of snapshot.docs) {
		pins[document.id] = document.data() as PlacePin;
	}
	return pins;
}

/** Drops a pin, so the place falls back to the register or the research. */
export async function remove(placeId: string): Promise<void> {
	await firestore.collection(PLACE_PIN_COLLECTION).doc(placeId).delete();
}
