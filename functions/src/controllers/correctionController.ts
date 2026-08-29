import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import type { Approximation } from '../../../sharedModels/approximation';
import { CorrectionError } from '../../../sharedModels/correction';
import { readContributor } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as corrections from '../services/correctionService';
import { callerKey, countRequest, TooMany } from '../services/throttle';
import { validateCors } from '../utils/cors-helper';
import * as researched from '../data/place-approximations.json';

/**
 * The endpoints behind "this pin is in the wrong place".
 *
 * Anyone may say so - the people who know where Kasteel Beaulieu stood are not the people
 * with an account - and only a curator may see the reports or act on them. As with the
 * photograph queue, every handler here either calls `requireAdmin` on its first line or is
 * deliberately public, and there is no third case.
 */

const PLACES = (researched as { places: Record<string, Approximation> }).places;

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof TooMany) {
		logger.warn('Throttled: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof CorrectionError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	logger.error('Correction endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/**
 * Public. Records that somebody thinks a place is in the wrong spot.
 *
 * The place is looked up here rather than taken from the request, so that what gets stored
 * as "what the map was claiming" is what the map actually claims - a curator reading the
 * report needs that to be the archive's own account, not the browser's.
 */
export const submitCorrection: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			// Before any work, and before the write. No account is needed to report a
			// misplaced pin, so this is the only thing standing between the curator's queue
			// and a script.
			await countRequest(callerKey(request.headers as Record<string, unknown>));

			const body = (request.body ?? {}) as Record<string, unknown>;
			const placeId = typeof body.placeId === 'string' ? body.placeId : '';
			const place = PLACES[placeId];

			if (!place) return response.status(404).send('Die plaats kennen we niet.');

			// Only places the map itself flags as uncertain can be corrected. Without this,
			// the panel's absence would be the only thing stopping a report about a geocoded
			// address, and an absent button stops nobody.
			if (!place.correctable) {
				return response.status(400).send('Voor deze plaats staat geen correctie open.');
			}

			const correction = await corrections.submit(body, readContributor(body), place);

			logger.info(`Correction for ${place.name} (${correction.kind}) received.`);
			return response.status(201).json({ id: correction.id });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. The reports waiting to be judged. */
export const listCorrections: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);

			const status = String(request.query.status ?? 'pending');
			if (status !== 'pending' && status !== 'accepted' && status !== 'rejected') {
				return response.status(400).send('Onbekende status.');
			}

			return response.status(200).json({ corrections: await corrections.list(status) });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Accepts or rejects a report.
 *
 * Accepting marks the report as good; it does not move the pin. The map is built from
 * `plaatsen.geojson` in the repository, so applying a correction is a commit somebody can
 * read - which is exactly the property that stops a pin relocating quietly while the
 * warning beside it still says the location is a guess.
 */
export const reviewCorrection: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const id = typeof body.id === 'string' ? body.id : '';
			const status = body.status as 'pending' | 'accepted' | 'rejected';

			if (!id) return response.status(400).send('Geen melding opgegeven.');
			if (status !== 'pending' && status !== 'accepted' && status !== 'rejected') {
				return response.status(400).send('Onbekende status.');
			}

			const reason = typeof body.rejectionReason === 'string' ? body.rejectionReason : undefined;
			const decided = await corrections.decide(id, status, curator, reason);

			return response.status(200).json(decided);
		} catch (error) {
			return fail(response, error);
		}
	}
);
