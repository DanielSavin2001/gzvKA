/**
 * The queue between somebody who knows where a place really is and the archive.
 *
 * 615 photographs sit on points worked out from sentences rather than looked up. The people
 * who can settle those are the ones who grew up on the street, and the moment they will do
 * it is the moment they see the pin and think "that's not right". So a correction is stored
 * like a submitted photograph is stored - immediately, and out of sight until a curator has
 * looked at it.
 *
 * A correction is never applied here. `applyCorrection` in the shared model produces the
 * new record, and a curator writes it into `plaatsen.geojson` deliberately, because the map
 * is built from a file in the repository rather than from this collection. That is the
 * point: a stranger cannot move a pin on the live site, and the change arrives as a commit
 * somebody can read.
 */

import { randomUUID } from 'crypto';

import type { Approximation } from '../../../sharedModels/approximation';
import type { CorrectionStatus, PlaceCorrection } from '../../../sharedModels/correction';
import { canDecide, readCorrection, snapshot } from '../../../sharedModels/correction';
import { CorrectionError } from '../../../sharedModels/correction';
import type { Contributor } from '../../../sharedModels/submission';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const CORRECTION_COLLECTION = 'corrections';

/** How many a curator sees at once. Enough to work through, small enough to load. */
const PAGE = 200;

function now(): string {
	return new Date().toISOString();
}

/**
 * A place a correction can be about.
 *
 * The research record is optional, and that is the change: this used to be an
 * `Approximation`, so the only places anybody could report were the 27 the archive had
 * already researched and flagged as open to correction. The other hundred - every street
 * straight out of the register, every place a curator made - drew a marker somebody could
 * click and then had nothing behind it. A reader who can see the pin is wrong is exactly
 * the reader worth listening to, whether or not the archive had thought to ask.
 */
export interface KnownPlace {
	id: string;
	name: string;
	/** What the research said, when there was any. */
	approximation?: Approximation;
}

/**
 * Stores what somebody told us.
 *
 * `previous` is captured here rather than at review time, so the record shows what the map
 * was actually claiming when they objected. By the time a curator looks, the research may
 * have been regenerated and the thing they were correcting may no longer be there.
 */
export async function submit(
	input: Record<string, unknown>,
	contributor: Contributor,
	place: KnownPlace
): Promise<PlaceCorrection> {
	const read = readCorrection(
		input,
		place.approximation?.candidates?.map((candidate) => candidate.label)
	);

	const correction: PlaceCorrection = {
		id: randomUUID(),
		placeId: place.id,
		placeName: place.name,
		kind: read.kind,
		status: 'pending',
		message: read.message,
		contributor,
		previous: snapshot(place.approximation),
		submittedAt: now()
	};

	if (read.lat != null && read.lng != null) {
		correction.lat = read.lat;
		correction.lng = read.lng;
	}
	if (read.candidateLabel) correction.candidateLabel = read.candidateLabel;

	await firestore.collection(CORRECTION_COLLECTION).doc(correction.id).set(correction);
	return correction;
}

/** What a curator sees, newest first. */
export async function list(status: CorrectionStatus): Promise<PlaceCorrection[]> {
	// Ordered in the query, not afterwards. Sorting a page that the database chose by
	// document id gives the newest of an arbitrary 200, which is not the newest 200 - so
	// once the queue passed the cap a curator would have silently stopped seeing new
	// reports. Needs the composite index in firestore.indexes.json.
	const snapshotResult = await firestore
		.collection(CORRECTION_COLLECTION)
		.where('status', '==', status)
		.orderBy('submittedAt', 'desc')
		.limit(PAGE)
		.get();

	return snapshotResult.docs.map((document) => document.data() as PlaceCorrection);
}

/**
 * Records a curator's decision.
 *
 * Accepting a correction does not move anything by itself. It marks the report as good, and
 * the curator then applies it to `plaatsen.geojson` - where the change is reviewable, and
 * where the grade, the radius and the doubt text move along with the coordinate instead of
 * a pin quietly relocating under a warning that still says it is a guess.
 */
export async function decide(
	id: string,
	status: CorrectionStatus,
	curator: AdminIdentity,
	rejectionReason?: string
): Promise<PlaceCorrection> {
	const reference = firestore.collection(CORRECTION_COLLECTION).doc(id);
	const document = await reference.get();

	if (!document.exists) throw new CorrectionError('Die melding bestaat niet.');

	const correction = document.data() as PlaceCorrection;

	if (!canDecide(correction.status, status)) {
		throw new CorrectionError(`Deze melding is al ${status}.`);
	}

	const decided: PlaceCorrection = {
		...correction,
		status,
		reviewedAt: now(),
		reviewedBy: curator.email
	};

	// A rejection needs no reason. It used to, and the rule was quietly load-bearing: the
	// only way to give one was a `window.prompt`, and cancelling it or leaving it empty
	// abandoned the whole decision - so a curator who did not want to write a sentence could
	// not decline at all. The reason is a message back to whoever sent this in, and there is
	// nothing to say when a photograph is simply already in the archive.
	if (status === 'rejected' && rejectionReason) {
		decided.rejectionReason = rejectionReason.trim();
	} else {
		delete decided.rejectionReason;
	}

	await reference.set(decided);
	return decided;
}
