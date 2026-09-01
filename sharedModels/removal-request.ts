/**
 * Somebody asking for a photograph of themselves to be taken down.
 *
 * `/contact` has said this since the site went up: "Staat u ergens op en wilt u dat een foto
 * weggaat, zeg het dan - dat is geen discussie." It was a real commitment and there was no
 * way to act on it. The page named no address (deliberately - the archive has none of its
 * own), and the one route it pointed at, the comment box on `/upload`, cannot be sent
 * without attaching a photograph: `submitPhoto` answers "Geen foto ontvangen." So a person
 * who wanted out of the archive had to add something to it first.
 *
 * This is that route. It is deliberately the same shape as `photo-fact.ts` - a record about
 * one photograph, submitted by a member of the public, read by a curator, decided once -
 * because the archive already knows how to run that queue and a new kind of queue is a
 * queue somebody forgets to read.
 *
 * ## What accepting one can and cannot do
 *
 * Accepting hides the photograph immediately: the site builds its archive in the browser
 * from the generated index plus the curator overlay, so a hidden photograph leaves the
 * search, the lists, the maps, the donor pages and its own page as soon as the overlay is
 * fetched. That is the part that matters within the hour.
 *
 * What it does NOT do on its own is remove the prerendered HTML, which still carries the
 * old title, or the entry in `sitemap.xml`. Those are build artefacts, and they go at the
 * next deploy. The wording on `/contact` says so rather than implying the internet forgets
 * on a button press.
 *
 * The image file itself stays in git history either way. An archive cannot promise
 * otherwise without rewriting its own history, and promising it would be a lie.
 */

import type { Contributor } from './submission';

export type RemovalStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Why they are asking.
 *
 * Not free text alone, because the answer changes what a curator has to weigh. "I am in it"
 * is a request the archive has already promised to honour without argument; "I took it" is a
 * rights question; "something else" is a conversation. The reason a person gives is also the
 * thing they should not have to explain twice.
 */
export type RemovalGround = 'ikzelf' | 'familie' | 'rechten' | 'anders';

export const GROUNDS: RemovalGround[] = ['ikzelf', 'familie', 'rechten', 'anders'];

/** What each ground says, in the words shown to the person asking. */
export const GROUND_LABELS: Record<RemovalGround, string> = {
	ikzelf: 'Ik sta zelf op deze foto',
	familie: 'Er staat iemand op die ik vertegenwoordig',
	rechten: 'Ik heb deze foto gemaakt',
	anders: 'Iets anders'
};

export interface RemovalRequest {
	id: string;
	/** The archive id of the photograph this is about. */
	photoId: string;
	/** The title at the time of asking, so the queue reads as sentences. */
	photoTitle: string;
	status: RemovalStatus;

	ground: RemovalGround;
	/** Anything they want to add. Never required: nobody owes the archive an explanation. */
	message: string;

	contributor: Contributor;

	submittedAt: string;
	reviewedAt?: string;
	reviewedBy?: string;
	/** Recorded for the archive's own record, never shown to the person who asked. */
	note?: string;
}

/** Raised when a request cannot be stored. The message is shown to the person asking. */
export class RemovalRequestError extends Error {}

const LIMITS = { message: 2000, note: 500 };

function clean(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, limit);
}

export function isGround(value: unknown): value is RemovalGround {
	return typeof value === 'string' && (GROUNDS as string[]).includes(value);
}

/** What a request has to contain, read off an untrusted request body. */
export function readRemovalRequest(input: Record<string, unknown>): {
	photoId: string;
	photoTitle: string;
	ground: RemovalGround;
	message: string;
} {
	const photoId = clean(input.photoId, 300);
	if (!photoId) throw new RemovalRequestError('Geen foto opgegeven.');

	if (!isGround(input.ground)) throw new RemovalRequestError('Zeg er even bij wie u bent.');

	return {
		photoId,
		photoTitle: clean(input.photoTitle, 300) ?? photoId,
		ground: input.ground,
		// Optional, and that is the point. Somebody who is in a photograph and wants it gone
		// does not have to argue for it; the archive said as much before this existed.
		message: clean(input.message, LIMITS.message) ?? ''
	};
}

/** Whether a decision is one a curator may record. */
export function canDecide(status: unknown): status is RemovalStatus {
	return status === 'pending' || status === 'accepted' || status === 'rejected';
}

export function readNote(input: unknown): string | undefined {
	return clean(input, LIMITS.note);
}
