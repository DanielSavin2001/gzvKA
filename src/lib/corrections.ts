/**
 * Sending a reader's correction about a place.
 *
 * Seven maps now offer this - the front page's and the six built on `PlaceMap` - and the
 * request they make has to be the same one. A second copy of the fetch is a second place
 * for the endpoint's name, the field names and the error handling to drift, and the way
 * anybody would find out is a report that silently never arrived.
 *
 * The endpoint is public and unauthenticated on purpose: the people who know where Kasteel
 * Beaulieu stood are not the people with an account. Every report lands as `pending` and
 * moves nothing on its own.
 */

import type { CorrectionKind } from '../../sharedModels/correction';

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/** What the panel collected. `name` and `email` may both be empty; neither is required. */
export interface CorrectionDraft {
	kind: CorrectionKind;
	lat?: number;
	lng?: number;
	candidateLabel?: string;
	message: string;
	name: string;
	email: string;
}

export class CorrectionSendError extends Error {}

/**
 * Posts one correction, or throws with something a reader can act on.
 *
 * The server's own message is preferred over a generic one: it is written in Dutch, for
 * this reader, and says which part was wrong ("Er is geen plek aangeduid op de kaart").
 * Replacing that with "versturen is niet gelukt" would throw away the only useful thing in
 * the response.
 */
export async function sendPlaceCorrection(
	placeId: string,
	draft: CorrectionDraft,
	fetcher: typeof fetch = fetch
): Promise<void> {
	if (!FUNCTIONS_BASE) {
		// A fresh clone with no backend. Saying so is better than a fetch to a relative URL
		// that 404s into an unreadable error.
		throw new CorrectionSendError(
			'Meldingen kunnen hier niet verstuurd worden. Laat het weten via de contactpagina.'
		);
	}

	const response = await fetcher(`${FUNCTIONS_BASE}submitCorrection`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...draft, placeId })
	});

	if (!response.ok) {
		const said = (await response.text()).trim();
		throw new CorrectionSendError(said || 'Versturen is niet gelukt. Probeer het straks opnieuw.');
	}
}
