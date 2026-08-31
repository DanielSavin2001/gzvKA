/**
 * Places a curator created or corrected, stored live.
 *
 * The same bargain as `placePinService`: the committed gazetteer is the durable record, and
 * this is what makes adding a place a click rather than a clone, a script run and a deploy.
 * The site merges these over the generated index; the next `npm run archive:index` folds
 * them in and this collection becomes a no-op for those ids.
 */

import type { PlaceRecord } from '../../../sharedModels/place-record';
import { PlaceRecordError, wouldLoop } from '../../../sharedModels/place-record';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const PLACE_RECORD_COLLECTION = 'places';

/**
 * A ceiling rather than a page cursor, for the reason the photo-edit overlay gives: past a
 * few hundred hand-made places the right move is a build, not an ever-growing overlay
 * shipped to every visitor. The gazetteer holds 131.
 */
const MAX_RECORDS = 500;

function now(): string {
	return new Date().toISOString();
}

/** Everything the site needs to overlay. Public. */
export async function all(): Promise<Record<string, PlaceRecord>> {
	const snapshot = await firestore.collection(PLACE_RECORD_COLLECTION).limit(MAX_RECORDS).get();

	const places: Record<string, PlaceRecord> = {};
	for (const document of snapshot.docs) {
		places[document.id] = document.data() as PlaceRecord;
	}

	return places;
}

/**
 * Stores one place.
 *
 * The loop check reads the collection first, which is the reason this is not a bare `set`:
 * "A under B" and then "B under A" is two easy clicks, and anything that later walks the
 * chain to draw a breadcrumb would hang rather than fail. Checked against what is stored
 * plus the record being written, because the new parent may be the very thing that closes
 * the loop.
 */
export async function save(
	fields: Omit<PlaceRecord, 'by' | 'on'>,
	curator: AdminIdentity
): Promise<PlaceRecord> {
	if (fields.parentId) {
		const existing = await all();
		const proposed = { ...existing, [fields.id]: { parentId: fields.parentId } };

		if (wouldLoop(fields.id, fields.parentId, proposed)) {
			throw new PlaceRecordError('Dat zet deze plaats onder zichzelf, via een omweg.');
		}
	}

	const record: PlaceRecord = { ...fields, by: curator.email, on: now() };

	// `set` without merge: a record is the whole statement about a place, and clearing the
	// parent has to be expressible. Merging would make "no longer under anything" impossible.
	await firestore.collection(PLACE_RECORD_COLLECTION).doc(record.id).set(record);
	return record;
}

/**
 * Drops the overlay for one place.
 *
 * For a place the gazetteer also knows, this reverts it to what the build says. For one that
 * only existed here, it removes it - and the photographs that pointed at it are left
 * pointing at an id nothing describes, which is exactly what they did before it was created.
 */
export async function remove(placeId: string): Promise<void> {
	await firestore.collection(PLACE_RECORD_COLLECTION).doc(placeId).delete();
}
