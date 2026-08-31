import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import {
	PlacePinError,
	readPlacePin,
	readPlacePinRemoval
} from '../../../sharedModels/place-pin';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as pins from '../services/placePinService';
import { validateCors } from '../utils/cors-helper';

/**
 * Placing whole places on the map from the beheer page.
 *
 * Reading is public and writing is not - a pin is site content the moment it is placed,
 * exactly like a photo edit.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof PlacePinError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	logger.error('Place pin endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/** Public. Every curator-placed pin, so the site can lay them over the committed file. */
export const placePins: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			// Short, like publishedPhotos: a pin placed a minute ago should show without the
			// curator wondering whether it worked.
			response.set('Cache-Control', 'public, max-age=60');
			return response.status(200).json({ version: 1, pins: await pins.all() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. Places a pin, or removes one when the body says `remove`. */
export const savePlacePin: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;

			if (body.remove === true) {
				const placeId = readPlacePinRemoval(body);
				await pins.remove(placeId);
				logger.info(`${curator.email} removed the pin for ${placeId}.`);
				return response.status(200).json({ id: placeId, removed: true });
			}

			const parsed = readPlacePin(body);
			const saved = await pins.save(parsed, curator);
			logger.info(`${curator.email} pinned ${parsed.placeId} at ${saved.lat}, ${saved.lng}.`);
			return response.status(200).json({ id: parsed.placeId, pin: saved });
		} catch (error) {
			return fail(response, error);
		}
	}
);
