import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { PhotoFactError } from '../../../sharedModels/photo-fact';
import { canDecide, readRejectionReason } from '../../../sharedModels/photo-fact';
import { readContributor } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as facts from '../services/photoFactService';
import { callerKey, countRequest, TooMany } from '../services/throttle';
import { validateCors } from '../utils/cors-helper';
import { isMissingIndex, missingIndexMessage } from '../utils/firestore-errors';

/**
 * The endpoints behind "I know when this was".
 *
 * Anyone may say so - the people who remember the winter of 1963 in the Dorpsstraat are not
 * the people with an account - and only a curator may see the suggestions or act on them.
 * As with the photograph queue and the pin corrections, every handler here either calls
 * `requireAdmin` on its first line or is deliberately public, and there is no third case.
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

	if (error instanceof PhotoFactError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	if (isMissingIndex(error)) {
		logger.error('Missing Firestore index: ', error);
		return response.status(500).send(missingIndexMessage(error));
	}

	logger.error('Photo fact endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/** Public. Records that somebody knows when a photograph was taken. */
export const submitPhotoFact: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			// Before any work, and before the write. No account is needed to date a
			// photograph, so this is the only thing standing between the curator's queue and
			// a script.
			await countRequest(callerKey(request.headers as Record<string, unknown>));

			const body = (request.body ?? {}) as Record<string, unknown>;
			const fact = await facts.submit(body, readContributor(body));

			logger.info(`Year ${fact.year} suggested for ${fact.photoId}.`);
			return response.status(201).json({ id: fact.id });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. The suggestions waiting to be judged. */
export const listPhotoFacts: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);

			const status = String(request.query.status ?? 'pending');
			if (!canDecide(status)) return response.status(400).send('Onbekende status.');

			return response.status(200).json({ facts: await facts.list(status) });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Accepts or rejects a suggestion.
 *
 * Accepting writes the year straight into the photo-edit overlay, so it is on the site
 * immediately. That is deliberate and it is the difference from a pin correction: a year
 * has no radius, grade or doubt text that could fall out of step with it, so there is
 * nothing for a human to carry across in a commit.
 */
export const reviewPhotoFact: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const id = typeof body.id === 'string' ? body.id : '';
			const status = body.status;

			if (!id) return response.status(400).send('Geen melding opgegeven.');
			if (!canDecide(status)) return response.status(400).send('Onbekende status.');

			const decided = await facts.decide(id, status, curator, readRejectionReason(body.reason));

			return response.status(200).json(decided);
		} catch (error) {
			return fail(response, error);
		}
	}
);
