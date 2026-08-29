/**
 * Somebody telling us a place is in the wrong spot.
 *
 * 615 photographs sit on points that were worked out from sentences rather than looked up
 * in a register - "on the north side of the Kalmthoutsesteenweg", a street 1.7 km long. The
 * archive cannot resolve those from the inside; the only people who can are the ones who
 * grew up on that street, and the only moment they will do it is the moment they see the
 * pin and think "that's not right".
 *
 * So a correction is a first-class record rather than a mailto link. It is reviewed like a
 * photograph is reviewed, because a stranger moving a pin unchecked is the same problem in
 * the other direction.
 *
 * The important rule lives in `applyCorrection`: a point never moves on its own. The grade,
 * the radius, the display mode, the doubt text and the provenance all move with it. A
 * dragged pin still labelled "approximate, ± 600 m, we are unsure because..." is worse than
 * no correction at all, because the next reader cannot tell which half of the record is
 * still true.
 */

import type { Approximation } from './approximation';
import type { Contributor } from './submission';

/** What kind of thing the person is telling us. */
export type CorrectionKind = 'coordinate' | 'candidate' | 'not-a-place' | 'still-unknown';

export type CorrectionStatus = 'pending' | 'accepted' | 'rejected';

/** What the record said when the correction was made, so a reviewer can see the change. */
export interface PreviousState {
	grade: string;
	display: string;
	lat?: number;
	lng?: number;
	radius?: number;
	doubt?: string;
}

export interface PlaceCorrection {
	id: string;
	placeId: string;
	placeName: string;
	kind: CorrectionKind;
	status: CorrectionStatus;

	/** Where they say it is. Absent for 'not-a-place' and 'still-unknown'. */
	lat?: number;
	lng?: number;
	/** Which of the offered candidates they picked. */
	candidateLabel?: string;
	/** How they know. The most valuable field on the record. */
	message: string;

	contributor: Contributor;
	previous: PreviousState;

	submittedAt: string;
	reviewedAt?: string;
	reviewedBy?: string;
	rejectionReason?: string;
}

export class CorrectionError extends Error {}

const LIMITS = { message: 2000, label: 200 };

function clean(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, limit);
}

export const CORRECTION_KINDS: CorrectionKind[] = [
	'coordinate',
	'candidate',
	'not-a-place',
	'still-unknown'
];

/**
 * Reads a correction off the wire.
 *
 * A coordinate correction without a coordinate is the one thing that must be refused: it
 * would be stored as an accepted-looking record that moves nothing, and a reviewer would
 * approve it without noticing there was nothing to apply.
 */
export function readCorrection(input: Record<string, unknown>): {
	kind: CorrectionKind;
	lat?: number;
	lng?: number;
	candidateLabel?: string;
	message: string;
} {
	const kind = input.kind as CorrectionKind;
	if (!CORRECTION_KINDS.includes(kind)) {
		throw new CorrectionError('Onbekend soort correctie.');
	}

	const message = clean(input.message, LIMITS.message);

	// Someone saying "this is not a place" or "I do not know where it is" is telling us
	// something we cannot get anywhere else, and the sentence IS the correction.
	if (!message && (kind === 'not-a-place' || kind === 'still-unknown')) {
		throw new CorrectionError('Schrijf er even bij wat u weet.');
	}

	const result: {
		kind: CorrectionKind;
		lat?: number;
		lng?: number;
		candidateLabel?: string;
		message: string;
	} = { kind, message: message ?? '' };

	if (kind === 'coordinate' || kind === 'candidate') {
		const lat = Number(input.lat);
		const lng = Number(input.lng);

		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			throw new CorrectionError('Er is geen plek aangeduid op de kaart.');
		}
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
			throw new CorrectionError('Die coördinaten kunnen niet kloppen.');
		}

		result.lat = lat;
		result.lng = lng;
	}

	if (kind === 'candidate') {
		const label = clean(input.candidateLabel, LIMITS.label);
		if (!label) throw new CorrectionError('Geen van de mogelijkheden is gekozen.');
		result.candidateLabel = label;
	}

	return result;
}

/** What the record looked like before, captured at submission rather than at review. */
export function snapshot(approximation: Approximation): PreviousState {
	const previous: PreviousState = {
		grade: approximation.grade,
		display: approximation.display
	};

	if (approximation.lat != null) previous.lat = approximation.lat;
	if (approximation.lng != null) previous.lng = approximation.lng;
	if (approximation.radius != null) previous.radius = approximation.radius;
	if (approximation.doubt) previous.doubt = approximation.doubt;

	return previous;
}

/** A curator confirming a location is as good as a geocoded address, so it is graded so. */
const CONFIRMED_GRADE = 'A';
const CONFIRMED_RADIUS = 25;

/**
 * The record after a correction is accepted.
 *
 * Written as a whole new object rather than a patch, so that no field of the old
 * uncertainty can survive by being forgotten. That is the entire reason this function
 * exists: `entry.lat = correction.lat` is one line and leaves the grade, the radius, the
 * red circle and the doubt text all saying the point is a guess.
 */
export function applyCorrection(
	approximation: Approximation,
	correction: PlaceCorrection,
	on: string
): Approximation {
	const by = correction.contributor.name?.trim() || 'iemand uit Kapellen';

	if (correction.kind === 'not-a-place') {
		// Tajje de Kotter is a person - the 58 photographs are of a parade through the whole
		// municipality. No coordinate can be right, so the record stops claiming one.
		return {
			...approximation,
			lat: undefined,
			lng: undefined,
			radius: undefined,
			candidates: undefined,
			grade: '?',
			display: 'niet_geplaatst',
			kind: 'geen_plaats',
			correctable: false,
			doubt: undefined,
			note: `Gemeld door ${by} op ${on}: dit is geen plaats. ${correction.message}`.trim()
		};
	}

	if (correction.kind === 'still-unknown') {
		// Not a failure. "None of these, and I do not know either" removes two wrong answers.
		return {
			...approximation,
			lat: undefined,
			lng: undefined,
			radius: undefined,
			candidates: undefined,
			grade: '?',
			display: 'niet_geplaatst',
			correctable: true,
			doubt: `${approximation.doubt ?? ''}\n\n${by} (${on}): ${correction.message}`.trim(),
			note: approximation.note
		};
	}

	const where =
		correction.kind === 'candidate' && correction.candidateLabel
			? `: ${correction.candidateLabel}`
			: '';

	return {
		...approximation,
		lat: correction.lat,
		lng: correction.lng,
		grade: CONFIRMED_GRADE,
		display: 'punt',
		radius: CONFIRMED_RADIUS,
		candidates: undefined,
		correctable: false,
		doubt: undefined,
		note:
			`Gecorrigeerd door ${by} op ${on}${where}. ${correction.message}`.trim() || approximation.note
	};
}

/** Whether a status change is allowed. A decision can be revisited, never repeated. */
export function canDecide(from: CorrectionStatus, to: CorrectionStatus): boolean {
	return from !== to;
}
