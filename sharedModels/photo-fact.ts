/**
 * Somebody telling the archive when a photograph was taken.
 *
 * 608 of the 4,504 photographs carry a year, and every one of those years was scraped out
 * of a filename by a regular expression. The other 3,896 are undated - which means the
 * timeline, the page the archive is proudest of, shows an eighth of it.
 *
 * Nothing in this repository can fix that. A year is not derivable from a photograph; it is
 * remembered. The people who remember are the ones who were there, or whose mother was, and
 * the moment they will say so is the moment they are looking at the picture and thinking
 * "that was the year of the flood".
 *
 * So this is a first-class record rather than a mailto link, reviewed exactly the way a
 * submitted photograph and a misplaced pin are reviewed. A stranger editing the archive's
 * dates unchecked is the same problem in the other direction: a date nobody can trace is
 * worse than no date, because the next reader cannot tell which it is.
 *
 * Accepting one writes the year through to the photo-edit overlay, which is the same place
 * a curator's own correction lands - so there is one answer to "what year is this
 * photograph", not two that can disagree.
 */

import type { Contributor } from './submission';

export type PhotoFactStatus = 'pending' | 'accepted' | 'rejected';

/** What somebody is telling us about a photograph. Only the year, for now. */
export interface PhotoFact {
	id: string;
	/** The archive id of the photograph this is about. */
	photoId: string;
	/** The photograph's title when the suggestion was made, so a queue reads as sentences. */
	photoTitle: string;
	status: PhotoFactStatus;

	/**
	 * The year, as text.
	 *
	 * Text rather than a number because "1935-1936" is a real and useful answer - somebody
	 * who knows it was the winter of that school year knows more than somebody who picks
	 * one of the two. The archive's own `y` field is text for the same reason.
	 */
	year: string;
	/** How they know. The most valuable field on the record, and the reason to trust it. */
	message: string;
	/** What the archive said at the time, so a reviewer can see what would change. */
	previousYear?: string;

	contributor: Contributor;

	submittedAt: string;
	reviewedAt?: string;
	reviewedBy?: string;
	rejectionReason?: string;
}

/** Raised when a suggestion cannot be accepted. The message is shown to the contributor. */
export class PhotoFactError extends Error {}

/**
 * The window a photograph of Kapellen can plausibly come from.
 *
 * The lower bound is photography itself; the archive's oldest dated item is an 1841 map,
 * and its oldest photograph is the station in 1854. The upper bound is filled in from the
 * current year at the call site rather than baked in here, so this file does not quietly
 * start rejecting next year's photographs on New Year's Day.
 */
export const EARLIEST_YEAR = 1830;

const LIMITS = { message: 2000, rejectionReason: 500 };

function clean(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, limit);
}

/**
 * Reads a year off the wire.
 *
 * Accepts a single year or a hyphenated range, and nothing else. A free-text date field
 * fills an archive with "rond 1950?", "jaren 60" and "zomer 1972" - each of which is real
 * knowledge, and none of which a timeline can place on an axis. That knowledge belongs in
 * `message`, where a curator reads it and decides; this field is the part a machine sorts
 * by, so it has to be a year.
 */
export function readYear(input: unknown, latestYear: number): string {
	const raw = clean(input, 32);
	if (!raw) throw new PhotoFactError('Vul een jaartal in.');

	const compact = raw.replace(/\s*[-–—]\s*/, '-');
	const match = /^(\d{4})(?:-(\d{4}))?$/.exec(compact);
	if (!match) {
		throw new PhotoFactError('Een jaartal ziet er uit als 1957, of 1957-1958 als je twijfelt.');
	}

	const [, from, to] = match;
	const inRange = (year: string) => Number(year) >= EARLIEST_YEAR && Number(year) <= latestYear;

	if (!inRange(from) || (to && !inRange(to))) {
		throw new PhotoFactError(`Een jaartal tussen ${EARLIEST_YEAR} en ${latestYear}, graag.`);
	}

	// A range that runs backwards is a typo rather than a claim about time.
	if (to && Number(to) < Number(from)) {
		throw new PhotoFactError('Het tweede jaartal ligt voor het eerste.');
	}

	// "1957-1957" is one year written twice.
	return to && to !== from ? `${from}-${to}` : from;
}

/** What a submission has to contain, read off an untrusted request body. */
export function readPhotoFact(
	input: Record<string, unknown>,
	latestYear: number
): { photoId: string; photoTitle: string; year: string; message: string } {
	const photoId = clean(input.photoId, 300);
	if (!photoId) throw new PhotoFactError('Geen foto opgegeven.');

	return {
		photoId,
		photoTitle: clean(input.photoTitle, 300) ?? photoId,
		year: readYear(input.year, latestYear),
		// Optional on purpose. Insisting on an explanation turns away the person who simply
		// knows, and a year from somebody who says nothing is still a year a curator can
		// weigh against the photograph in front of them.
		message: clean(input.message, LIMITS.message) ?? ''
	};
}

/** Whether a decision is one a curator may record. */
export function canDecide(status: unknown): status is PhotoFactStatus {
	return status === 'pending' || status === 'accepted' || status === 'rejected';
}

export function readRejectionReason(input: unknown): string | undefined {
	return clean(input, LIMITS.rejectionReason);
}
