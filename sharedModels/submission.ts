/**
 * A photograph somebody sent in, and what happens to it before it becomes part of the
 * archive.
 *
 * Anyone in Kapellen can contribute without an account - asking a seventy-year-old to
 * register before they can send a photograph of their own street is how an archive stays
 * empty. Nothing they send appears on the site until a curator has looked at it, which is
 * the other half of the same decision: an open door needs someone standing at it.
 *
 * These types are shared between the Cloud Functions that enforce the rules and the pages
 * that show them, so the two cannot disagree about what a submission is.
 */

/** Where a submission is in its life. */
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

/** What the contributor told us. All of it optional except the photograph itself. */
export interface Contributor {
	/** Who to credit. Shown on the photograph's page if it is approved. */
	name?: string;
	/** Only so a curator can ask a question. Never shown on the site. */
	email?: string;
	/** Anything they want to say about the batch as a whole. */
	note?: string;
}

/**
 * What the contributor suggested about one photograph in particular.
 *
 * A suggestion, not a decision: none of it reaches the website until a curator has read it
 * and made it their own. That is why these fields live apart from {@link CuratorFields} -
 * mixing them would let unreviewed text become a published title on approval.
 */
export interface PhotoSuggestion {
	/** What they would call it. */
	title?: string;
	/** When they think it was taken. Free text: "rond 1950" is an answer worth having. */
	year?: string;
	/** What is on it: the street, the people, the occasion. */
	description?: string;
}

/**
 * What a curator decided about a photograph, over and above what the filename said.
 *
 * Every field here is a person's judgement, which is why they are kept apart from the
 * things a machine worked out. A curator's answer always wins.
 */
export interface CuratorFields {
	/** The title shown on the site. */
	title?: string;
	/** Gazetteer ids this photograph belongs to. */
	places?: string[];
	houseNumber?: number;
	/** Year the photograph was taken, as text: it is often "1935" or "1935-1936". */
	year?: string;
	/** Who gave it to the archive. */
	donor?: string;
	/** What is on the photograph, as shown on the site. */
	description?: string;
	/** A coordinate a curator placed for this photograph alone. */
	lat?: number;
	lng?: number;
}

export interface Submission extends CuratorFields {
	id: string;
	status: SubmissionStatus;

	/** Path in Cloud Storage. Private while pending, public once approved. */
	storagePath: string;
	/** The name of the file as it was sent, kept because it often holds the only clue. */
	originalName: string;
	contentType: string;
	bytes: number;

	contributor: Contributor;
	/** What the contributor suggested about this photograph. Never published as-is. */
	suggestion?: PhotoSuggestion;

	/** ISO timestamps. */
	submittedAt: string;
	reviewedAt?: string;
	/** Email of the curator who decided. */
	reviewedBy?: string;
	/** Why it was turned down, so the decision can be explained or revisited. */
	rejectionReason?: string;
}

/** A submission as the public site sees it. The contributor's email never leaves the queue. */
export interface PublishedPhoto {
	id: string;
	/** Public URL of the image. */
	url: string;
	title: string;
	places: string[];
	houseNumber?: number;
	year?: string;
	donor?: string;
	/** The curator's description. A contributor's suggestion never appears here unedited. */
	description?: string;
	lat?: number;
	lng?: number;
	/** ISO date it was approved, so new arrivals can be shown first. */
	publishedAt: string;
}

/** The largest file a contributor may send. Bigger than any scan the archive holds. */
export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Trimmed to a length that cannot fill a screen or a database field. */
const LIMITS = { name: 120, email: 200, note: 2000, title: 200, year: 40, description: 4000 };

function clean(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, limit);
}

/**
 * Reads what a contributor typed into something safe to store.
 *
 * Everything is optional: a photograph with no name attached is still worth having, and
 * demanding an email address before accepting one loses more than it gains.
 */
export function readContributor(input: Record<string, unknown>): Contributor {
	const contributor: Contributor = {};

	const name = clean(input.name, LIMITS.name);
	if (name) contributor.name = name;

	const email = clean(input.email, LIMITS.email);
	// Only kept when it could actually be an address; a typo is worse than nothing.
	if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) contributor.email = email;

	const note = clean(input.note, LIMITS.note);
	if (note) contributor.note = note;

	return contributor;
}

/**
 * Reads what a contributor suggested about one photograph, with the same discipline as
 * {@link readContributor}: everything optional, everything trimmed and capped, nothing
 * trusted. Returns undefined when there is nothing in it, so an empty suggestion is not
 * stored as an empty object.
 */
export function readSuggestion(input: unknown): PhotoSuggestion | undefined {
	if (typeof input !== 'object' || input === null) return undefined;
	const record = input as Record<string, unknown>;
	const suggestion: PhotoSuggestion = {};

	const title = clean(record.title, LIMITS.title);
	if (title) suggestion.title = title;

	// Free text rather than a validated year: "rond 1950" or "jaren 30" is an answer worth
	// having, and the curator turns it into a real year while reviewing.
	const year = clean(record.year, LIMITS.year);
	if (year) suggestion.year = year;

	const description = clean(record.description, LIMITS.description);
	if (description) suggestion.description = description;

	return Object.keys(suggestion).length > 0 ? suggestion : undefined;
}

/** Raised when a submission cannot be accepted. The message is shown to the contributor. */
export class SubmissionError extends Error {}

export function validateFile(file: { contentType: string; bytes: number }): void {
	if (!ALLOWED_CONTENT_TYPES.includes(file.contentType)) {
		throw new SubmissionError("Alleen foto's kunnen worden ingestuurd (JPEG, PNG, GIF of WebP).");
	}

	if (file.bytes <= 0) {
		throw new SubmissionError('Het bestand is leeg.');
	}

	if (file.bytes > MAX_SUBMISSION_BYTES) {
		throw new SubmissionError(
			`Deze foto is te groot (max ${Math.round(MAX_SUBMISSION_BYTES / 1024 / 1024)} MB).`
		);
	}
}

/**
 * Whether a status change is allowed.
 *
 * A decision can be revisited - a curator who rejects the wrong photograph must be able to
 * put it back - but a submission cannot be decided twice in the same direction, which is
 * what stops two curators reviewing the same thing at once from both publishing it.
 */
export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
	if (from === to) return false;
	return to === 'approved' || to === 'rejected' || to === 'pending';
}

/**
 * What the public gets to see of an approved submission.
 *
 * Written as a projection rather than a filter so that a field added to `Submission` is
 * invisible by default: the contributor's email address must never reach the website, and
 * "remember to exclude it" is not a mechanism.
 */
export function toPublished(submission: Submission, url: string): PublishedPhoto {
	const published: PublishedPhoto = {
		id: submission.id,
		url,
		title: submission.title ?? submission.originalName.replace(/\.[^.]+$/, ''),
		places: submission.places ?? [],
		publishedAt: submission.reviewedAt ?? submission.submittedAt
	};

	if (submission.houseNumber != null) published.houseNumber = submission.houseNumber;
	if (submission.year) published.year = submission.year;
	if (submission.donor) published.donor = submission.donor;
	else if (submission.contributor.name) published.donor = submission.contributor.name;
	// The curator's description only. The contributor's suggestion stays in the queue: it is
	// prefilled into the curator's form, so publishing it is a decision, not a default.
	if (submission.description) published.description = submission.description;
	if (submission.lat != null && submission.lng != null) {
		published.lat = submission.lat;
		published.lng = submission.lng;
	}

	return published;
}
