/**
 * The queue between somebody who is in a photograph and the archive.
 *
 * `/contact` has promised this since the site went up - "Staat u ergens op en wilt u dat een
 * foto weggaat, zeg het dan - dat is geen discussie" - and there was no way to say it. The
 * page names no address, by design, and the only route it pointed at was the comment box on
 * `/upload`, which `submitPhoto` refuses without a photograph attached. A person who wanted
 * out of the archive had to put something into it first.
 *
 * Modelled on `photoFactService` on purpose. The archive already runs one public queue that
 * a curator reads and decides, and a second kind of queue is a queue somebody forgets. The
 * one difference that matters is the default: a dating suggestion is weighed, and this is
 * honoured. The page said "geen discussie" and meant it.
 */

import { randomUUID } from 'crypto';

import type { RemovalRequest, RemovalStatus } from '../../../sharedModels/removal-request';
import { RemovalRequestError, readRemovalRequest } from '../../../sharedModels/removal-request';
import type { Contributor } from '../../../sharedModels/submission';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';
import * as photoEdits from './photoEditService';

export const REMOVAL_REQUEST_COLLECTION = 'removal-requests';

/** How many a curator sees at once. This queue should never be long. */
const PAGE = 200;

function now(): string {
	return new Date().toISOString();
}

/** Stores a request. Nothing is hidden until a curator says so. */
export async function submit(
	input: Record<string, unknown>,
	contributor: Contributor
): Promise<RemovalRequest> {
	const read = readRemovalRequest(input);

	const request: RemovalRequest = {
		id: randomUUID(),
		photoId: read.photoId,
		photoTitle: read.photoTitle,
		status: 'pending',
		ground: read.ground,
		message: read.message,
		contributor,
		submittedAt: now()
	};

	await firestore.collection(REMOVAL_REQUEST_COLLECTION).doc(request.id).set(request);
	return request;
}

/** What a curator sees, newest first. Needs the composite index in firestore.indexes.json. */
export async function list(status: RemovalStatus): Promise<RemovalRequest[]> {
	const snapshot = await firestore
		.collection(REMOVAL_REQUEST_COLLECTION)
		.where('status', '==', status)
		.orderBy('submittedAt', 'desc')
		.limit(PAGE)
		.get();

	return snapshot.docs.map((document) => document.data() as RemovalRequest);
}

/**
 * Records a curator's decision, and hides or restores the photograph.
 *
 * The overlay is written BEFORE the record is marked, the same way the dating queue does it:
 * if the overlay write fails, the request stays pending and can be tried again, where
 * marking it first would leave a record saying a photograph was taken down while it was
 * still on the site. For this queue that ordering is not a tidiness argument - it is the
 * difference between a promise kept and a promise recorded.
 *
 * Rejecting restores, so a request accepted in error is a second click rather than a
 * restore from a backup. That is the whole reason this hides through the overlay instead of
 * deleting anything.
 */
export async function decide(
	id: string,
	status: RemovalStatus,
	curator: AdminIdentity,
	note?: string
): Promise<RemovalRequest> {
	const reference = firestore.collection(REMOVAL_REQUEST_COLLECTION).doc(id);
	const document = await reference.get();

	if (!document.exists) throw new RemovalRequestError('Dat verzoek bestaat niet.');

	const request = document.data() as RemovalRequest;

	if (request.status !== 'pending' && status !== 'pending') {
		throw new RemovalRequestError(`Dit verzoek is al ${request.status}.`);
	}

	if (status !== 'pending') {
		// Merged with whatever else has been corrected about this photograph. `save` writes the
		// whole patch, so sending `hidden` alone would erase a curator's corrected title or
		// description - and restoring the photograph later would bring back a worse version of
		// it than the one that was taken down.
		const current = (await photoEdits.all())[request.photoId];

		await photoEdits.save(
			request.photoId,
			{
				...(current?.title ? { title: current.title } : {}),
				...(current?.subject ? { subject: current.subject } : {}),
				...(current?.places ? { places: current.places } : {}),
				...(current?.houseNumber ? { houseNumber: current.houseNumber } : {}),
				...(current?.year ? { year: current.year } : {}),
				...(current?.donor ? { donor: current.donor } : {}),
				...(current?.description ? { description: current.description } : {}),
				hidden: status === 'accepted'
			},
			curator
		);
	}

	const decided: RemovalRequest = {
		...request,
		status,
		reviewedAt: now(),
		reviewedBy: curator.email
	};

	if (note?.trim()) decided.note = note.trim();
	else delete decided.note;

	await reference.set(decided);
	return decided;
}
