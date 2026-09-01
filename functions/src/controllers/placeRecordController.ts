import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { PlaceOverlayError } from '../../../sharedModels/place-overlay';
import { PlaceRecordError, readPlaceRecord } from '../../../sharedModels/place-record';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as places from '../services/placeRecordService';
import { validateCors } from '../utils/cors-helper';

/**
 * Creating and correcting places without a deploy.
 *
 * Reading is public and writing is not, the same split as every other overlay here: a place
 * IS site content the moment it is made - the maps and the browse lists need it - and only a
 * curator may make one.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	// Both carry a sentence written for the curator - "Kies een straal, of toon de plaats als
	// punt" - so both are shown rather than swallowed into a generic 400.
	if (error instanceof PlaceRecordError || error instanceof PlaceOverlayError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	logger.error('Place record endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/** Public. Every curator-made place, so the site can lay them over the generated index. */
export const placeRecords: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'GET') return response.status(405).send('Method Not Allowed');

			const found = await places.all();

			// Short, not zero, for the reason publishedPhotos gives: a place made a minute ago
			// should appear without a curator wondering, and every visitor need not ask.
			response.setHeader('Cache-Control', 'public, max-age=60');
			return response.status(200).json({ version: 1, places: found });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. Creates a place, or corrects what the gazetteer says about one. */
export const savePlaceRecord: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const saved = await places.save(
				readPlaceRecord((request.body ?? {}) as Record<string, unknown>),
				curator
			);

			logger.info(`${curator.email} saved the place ${saved.id}.`);
			return response.status(200).json(saved);
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. Drops the overlay, so the place reverts to the gazetteer or disappears. */
export const deletePlaceRecord: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
			if (!placeId) return response.status(400).send('Geen plaats opgegeven.');

			await places.remove(placeId);
			return response.status(200).json({ id: placeId, reverted: true });
		} catch (error) {
			return fail(response, error);
		}
	}
);
