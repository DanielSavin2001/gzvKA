/**
 * The queue between a resident with a photograph and the archive.
 *
 * A submission is stored the moment it arrives and shows nowhere until a curator approves
 * it. Approving copies the file to a public place and records the curator's own corrections
 * alongside it; rejecting keeps the record, with the reason, so a decision can be explained
 * or reversed later. Nothing is ever deleted by this service - an archive that quietly
 * discards what it was sent is not an archive.
 */

import { randomUUID } from 'crypto';

import type {
	CuratorFields,
	PhotoSuggestion,
	PublishedPhoto,
	Submission,
	SubmissionStatus
} from '../../../sharedModels/submission';
import {
	SubmissionError,
	canTransition,
	toPublished,
	validateFile
} from '../../../sharedModels/submission';
import type { AdminIdentity } from './admin-auth';
import { firestore, storage } from './externalServices';

export const SUBMISSION_COLLECTION = 'submissions';

/** Where a photograph waits. Not publicly readable. */
const PENDING_PREFIX = 'inzendingen';

/** Where an approved photograph lives. Publicly readable. */
const PUBLISHED_PREFIX = 'archief';

function extensionFor(contentType: string, originalName: string): string {
	const fromName = /\.([a-z0-9]+)$/i.exec(originalName)?.[1]?.toLowerCase();
	const byType: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp'
	};

	// The content type is sniffed from the bytes upstream, so it beats the filename - which
	// is wrong about the format for 57 of the photographs already in this archive.
	return byType[contentType] ?? fromName ?? 'jpg';
}

export interface IncomingFile {
	buffer: Buffer;
	originalName: string;
	contentType: string;
}

/**
 * Stores one contributed photograph as `pending`.
 *
 * The file is written before the record, so a record never points at a file that is not
 * there. The reverse - a file with no record - is merely an orphan, which a curator never
 * sees and a sweep can collect.
 */
export async function submit(
	file: IncomingFile,
	contributor: Submission['contributor'],
	suggestion?: PhotoSuggestion
): Promise<Submission> {
	validateFile({ contentType: file.contentType, bytes: file.buffer.length });

	const id = randomUUID();
	const storagePath = `${PENDING_PREFIX}/${id}.${extensionFor(
		file.contentType,
		file.originalName
	)}`;

	await storage.file(storagePath).save(file.buffer, {
		contentType: file.contentType,
		resumable: false,
		metadata: { cacheControl: 'private, max-age=0' }
	});

	const submission: Submission = {
		id,
		status: 'pending',
		storagePath,
		originalName: file.originalName,
		contentType: file.contentType,
		bytes: file.buffer.length,
		contributor,
		...(suggestion ? { suggestion } : {}),
		submittedAt: new Date().toISOString()
	};

	await firestore.collection(SUBMISSION_COLLECTION).doc(id).set(submission);
	return submission;
}

export async function list(status: SubmissionStatus | 'all', limit = 200): Promise<Submission[]> {
	let query = firestore
		.collection(SUBMISSION_COLLECTION)
		.orderBy('submittedAt', 'desc')
		.limit(limit);
	if (status !== 'all') query = query.where('status', '==', status) as typeof query;

	const snapshot = await query.get();
	return snapshot.docs.map((doc) => doc.data() as Submission);
}

/** Strips the fields a curator may set, ignoring anything else the request carried. */
export function readCuratorFields(input: Record<string, unknown>): CuratorFields {
	const fields: CuratorFields = {};

	if (typeof input.title === 'string' && input.title.trim()) {
		fields.title = input.title.trim().slice(0, 200);
	}
	if (Array.isArray(input.places)) {
		fields.places = input.places.filter((place): place is string => typeof place === 'string');
	}
	if (typeof input.houseNumber === 'number' && Number.isInteger(input.houseNumber)) {
		fields.houseNumber = input.houseNumber;
	}
	if (typeof input.year === 'string' && /^\d{4}(-\d{4})?$/.test(input.year.trim())) {
		fields.year = input.year.trim();
	}
	if (typeof input.donor === 'string' && input.donor.trim()) {
		fields.donor = input.donor.trim().slice(0, 200);
	}
	// An empty string is kept, deliberately: the beheer form prefills the description from
	// the contributor's unreviewed suggestion, so "cleared the field" must actually clear it.
	// Dropping empties here would let review()'s merge resurrect text a curator deleted.
	if (typeof input.description === 'string') {
		fields.description = input.description.trim().slice(0, 4000);
	}
	if (typeof input.lat === 'number' && typeof input.lng === 'number') {
		fields.lat = input.lat;
		fields.lng = input.lng;
	}

	return fields;
}

export interface ReviewDecision {
	status: Exclude<SubmissionStatus, 'pending'> | 'pending';
	fields?: CuratorFields;
	rejectionReason?: string;
}

/**
 * Records a curator's decision.
 *
 * Approving moves the file into the public prefix and makes it readable; sending an
 * approved photograph back to the queue moves it out again, so withdrawing something
 * published by mistake actually takes it off the website rather than only changing a flag.
 */
export async function review(
	id: string,
	decision: ReviewDecision,
	curator: AdminIdentity
): Promise<Submission> {
	const reference = firestore.collection(SUBMISSION_COLLECTION).doc(id);
	const snapshot = await reference.get();

	if (!snapshot.exists) throw new SubmissionError('Deze inzending bestaat niet.');

	const existing = snapshot.data() as Submission;

	if (!canTransition(existing.status, decision.status)) {
		throw new SubmissionError(
			`Deze inzending is al ${existing.status === 'approved' ? 'goedgekeurd' : 'afgewezen'}.`
		);
	}

	let storagePath = existing.storagePath;

	if (decision.status === 'approved' && existing.storagePath.startsWith(`${PENDING_PREFIX}/`)) {
		storagePath = existing.storagePath.replace(`${PENDING_PREFIX}/`, `${PUBLISHED_PREFIX}/`);
		await storage.file(existing.storagePath).move(storagePath);
		await storage.file(storagePath).setMetadata({ cacheControl: 'public, max-age=31536000' });
	}

	if (decision.status !== 'approved' && existing.storagePath.startsWith(`${PUBLISHED_PREFIX}/`)) {
		// Withdrawn: back behind the door, so it stops being served.
		storagePath = existing.storagePath.replace(`${PUBLISHED_PREFIX}/`, `${PENDING_PREFIX}/`);
		await storage.file(existing.storagePath).move(storagePath);
	}

	const updated: Submission = {
		...existing,
		...(decision.fields ?? {}),
		status: decision.status,
		storagePath,
		reviewedAt: new Date().toISOString(),
		reviewedBy: curator.email,
		...(decision.rejectionReason ? { rejectionReason: decision.rejectionReason.slice(0, 500) } : {})
	};

	await reference.set(updated);
	return updated;
}

/**
 * A short-lived link to a photograph that is not public yet.
 *
 * The queue has to be reviewable, and the bucket must not be readable by anyone who guesses
 * a path. A signed URL is the way to have both: it works for an hour, for whoever holds it,
 * and cannot be derived from the file's name.
 */
export async function previewUrl(storagePath: string): Promise<string> {
	if (storagePath.startsWith(`${PUBLISHED_PREFIX}/`)) return publicUrl(storagePath);

	const [url] = await storage.file(storagePath).getSignedUrl({
		action: 'read',
		expires: Date.now() + 60 * 60 * 1000
	});
	return url;
}

/** The public URL of a file in the bucket. */
export function publicUrl(storagePath: string): string {
	return `https://storage.googleapis.com/${storage.name}/${storagePath
		.split('/')
		.map(encodeURIComponent)
		.join('/')}`;
}

/** Everything approved, as the website may see it. */
export async function published(): Promise<PublishedPhoto[]> {
	const snapshot = await firestore
		.collection(SUBMISSION_COLLECTION)
		.where('status', '==', 'approved')
		.get();

	return snapshot.docs
		.map((doc) => doc.data() as Submission)
		.map((submission) => toPublished(submission, publicUrl(submission.storagePath)))
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
