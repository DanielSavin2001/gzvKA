import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { RemovalRequestError, canDecide, readNote } from '../../../sharedModels/removal-request';
import { readContributor } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as removals from '../services/removalRequestService';
import { callerKey, countRequest, TooMany } from '../services/throttle';
import { validateCors } from '../utils/cors-helper';
import { isMissingIndex, missingIndexMessage } from '../utils/firestore-errors';

/**
 * The endpoints behind "ik sta hierop".
 *
 * Anyone may ask - the person in a photograph from 1968 is not the person with an account -
 * and only a curator may read the queue or act on it. Same split as the dating queue, and
 * for a stronger reason: what arrives here names a living person and says where they are in
 * a picture, so the list itself is the sensitive thing, not just the decision.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof TooMany) {
		logger.warn('Throttled: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof RemovalRequestError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	if (isMissingIndex(error)) {
		logger.error('Missing Firestore index: ', error);
		return response.status(500).send(missingIndexMessage(error));
	}

	logger.error('Removal request endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/** Public. Records that somebody wants a photograph of themselves taken down. */
export const submitRemovalRequest: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			await countRequest(callerKey(request.headers as Record<string, unknown>));

			const body = (request.body ?? {}) as Record<string, unknown>;
			const stored = await removals.submit(body, readContributor(body));

			// The photograph's id, never the ground and never the message: this log line is
			// about a named living person, and a log is the one place nobody thinks to look
			// before sharing a screenshot.
			logger.info(`Removal requested for ${stored.photoId}.`);
			return response.status(201).json({ id: stored.id });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. The requests waiting to be acted on. */
export const listRemovalRequests: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);

			const status = String(request.query.status ?? 'pending');
			if (!canDecide(status)) return response.status(400).send('Onbekende status.');

			return response.status(200).json({ requests: await removals.list(status) });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Honours a request, or declines it.
 *
 * Accepting hides the photograph through the photo-edit overlay, so it is off the site as
 * soon as the next visitor's browser fetches that overlay - out of the search, the street
 * pages, the maps, the donor pages and its own page. The prerendered HTML and the sitemap
 * entry go at the next deploy, which is what `/contact` now says rather than implying the
 * internet forgets on a button press.
 *
 * Rejecting restores, so a request accepted in error is a second click.
 */
export const reviewRemovalRequest: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const id = typeof body.id === 'string' ? body.id : '';
			const status = body.status;

			if (!id) return response.status(400).send('Geen verzoek opgegeven.');
			if (!canDecide(status)) return response.status(400).send('Onbekende status.');

			const decided = await removals.decide(id, status, curator, readNote(body.note));

			return response.status(200).json(decided);
		} catch (error) {
			return fail(response, error);
		}
	}
);
