/**
 * The queue between somebody who remembers when a photograph was taken and the archive.
 *
 * 3,896 of the 4,504 photographs have no year at all, and no amount of work inside this
 * repository can change that: a year is not derivable from a picture, it is remembered.
 * This is where the remembering arrives, and it is stored like a submitted photograph is
 * stored - immediately, and out of sight until a curator has looked at it.
 *
 * Unlike a place correction, accepting one *does* change the site at once. A year is a
 * single unambiguous field with no radius, no grade and no doubt text to fall out of step
 * with it, so there is nothing here that needs a human to carry it across in a commit. It
 * is written to the photo-edit overlay, which is where a curator's own correction to a
 * photograph already lands - one answer to "what year is this", not two that can disagree.
 */

import { randomUUID } from 'crypto';

import type { PhotoFact, PhotoFactStatus } from '../../../sharedModels/photo-fact';
import { PhotoFactError, readPhotoFact } from '../../../sharedModels/photo-fact';
import type { Contributor } from '../../../sharedModels/submission';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';
import * as photoEdits from './photoEditService';

export const PHOTO_FACT_COLLECTION = 'photo-facts';

/** How many a curator sees at once. Enough to work through, small enough to load. */
const PAGE = 200;

function now(): string {
	return new Date().toISOString();
}

/**
 * The latest year a photograph can claim to be from.
 *
 * Read at call time rather than baked into a constant, so the archive does not start
 * rejecting this year's photographs on the first of January.
 */
export function latestYear(): number {
	return new Date().getFullYear();
}

/** Stores what somebody told us. */
export async function submit(
	input: Record<string, unknown>,
	contributor: Contributor
): Promise<PhotoFact> {
	const read = readPhotoFact(input, latestYear());

	const fact: PhotoFact = {
		id: randomUUID(),
		photoId: read.photoId,
		photoTitle: read.photoTitle,
		status: 'pending',
		year: read.year,
		message: read.message,
		contributor,
		submittedAt: now()
	};

	// What the archive says right now, captured at submission rather than at review. By the
	// time a curator looks, somebody else's suggestion may already have been accepted, and
	// the reviewer needs to see what this person was actually contradicting.
	const existing = (await photoEdits.all())[read.photoId]?.year;
	if (existing) fact.previousYear = existing;

	await firestore.collection(PHOTO_FACT_COLLECTION).doc(fact.id).set(fact);
	return fact;
}

/** What a curator sees, newest first. Needs the composite index in firestore.indexes.json. */
export async function list(status: PhotoFactStatus): Promise<PhotoFact[]> {
	const snapshot = await firestore
		.collection(PHOTO_FACT_COLLECTION)
		.where('status', '==', status)
		.orderBy('submittedAt', 'desc')
		.limit(PAGE)
		.get();

	return snapshot.docs.map((document) => document.data() as PhotoFact);
}

/**
 * Records a curator's decision.
 *
 * Accepting writes the year into the photo-edit overlay, so it is on the site the moment
 * the curator says yes rather than after the next rebuild. The write happens *before* the
 * record is marked accepted: if the overlay write fails, the suggestion stays in the queue
 * to be tried again, where marking it first would have left a record claiming a change that
 * never happened.
 */
export async function decide(
	id: string,
	status: PhotoFactStatus,
	curator: AdminIdentity,
	rejectionReason?: string
): Promise<PhotoFact> {
	const reference = firestore.collection(PHOTO_FACT_COLLECTION).doc(id);
	const document = await reference.get();

	if (!document.exists) throw new PhotoFactError('Die melding bestaat niet.');

	const fact = document.data() as PhotoFact;

	if (fact.status !== 'pending' && status !== 'pending') {
		throw new PhotoFactError(`Deze melding is al ${fact.status}.`);
	}

	if (status === 'rejected' && !rejectionReason?.trim()) {
		throw new PhotoFactError('Geef een reden op bij het afwijzen.');
	}

	if (status === 'accepted') {
		// Merged with whatever else has been corrected about this photograph. `save` writes
		// the whole patch, so passing the year alone would erase a curator's corrected title
		// or description - which nobody would notice until they went looking for it.
		const current = (await photoEdits.all())[fact.photoId];
		await photoEdits.save(
			fact.photoId,
			{
				...(current?.title ? { title: current.title } : {}),
				...(current?.subject ? { subject: current.subject } : {}),
				...(current?.places ? { places: current.places } : {}),
				...(current?.houseNumber ? { houseNumber: current.houseNumber } : {}),
				...(current?.donor ? { donor: current.donor } : {}),
				...(current?.description ? { description: current.description } : {}),
				year: fact.year
			},
			curator
		);
	}

	const decided: PhotoFact = {
		...fact,
		status,
		reviewedAt: now(),
		reviewedBy: curator.email
	};

	if (status === 'rejected' && rejectionReason) {
		decided.rejectionReason = rejectionReason.trim();
	} else {
		delete decided.rejectionReason;
	}

	await reference.set(decided);
	return decided;
}
