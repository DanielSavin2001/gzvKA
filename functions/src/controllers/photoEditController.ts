import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { PhotoEditError, readPhotoFields } from '../../../sharedModels/photo-edit';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as edits from '../services/photoEditService';
import { validateCors } from '../utils/cors-helper';
import { isMissingIndex, missingIndexMessage } from '../utils/firestore-errors';

/**
 * Correcting the photographs that are already in the archive.
 *
 * Reading is public and writing is not, which is the same split as everywhere else here: an
 * edit is site content the moment it is made, and only a curator may make one.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof PhotoEditError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	if (isMissingIndex(error)) {
		logger.error('Missing Firestore index: ', error);
		return response.status(500).send(missingIndexMessage(error));
	}

	logger.error('Photo edit endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/**
 * Public. Every correction, so the site can lay them over the generated index.
 *
 * Cached for a few minutes: a visitor seeing a five-minute-old title is fine, and 4,504
 * photographs' worth of page loads asking Firestore directly is not.
 *
 * `s-maxage` is deliberately gone. It invited a shared cache to hold this body, and a
 * shared cache is the one thing a curator cannot flush: `cache: 'reload'` in the browser
 * only sets request headers, which intermediaries are free to ignore. The curator's page
 * now asks with a cache-busting URL instead, which no cache can answer from a stored
 * entry - but there is no reason for an intermediary to be holding this at all, so it is
 * not asked to.
 */
export const photoEdits: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			response.set('Cache-Control', 'public, max-age=300');
			return response.status(200).json({ version: 1, edits: await edits.all() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. Stores a patch for one photograph. */
export const savePhotoEdit: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const photoId = typeof body.photoId === 'string' ? body.photoId : '';

			const saved = await edits.save(photoId, readPhotoFields(body), curator);

			logger.info(`${curator.email} edited ${photoId}.`);
			return response.status(200).json(saved);
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Writes one donor's name onto many photographs - a rename, or a merge.
 *
 * The photo ids come from the request because the archive index is a static file the site
 * fetches and the functions never read; the curator's page is already holding it. The name
 * is validated in the service, which also merges rather than replacing, so a rename cannot
 * undo a title or a place somebody corrected earlier.
 */
export const renameDonor: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const donor = typeof body.donor === 'string' ? body.donor : '';
			const photoIds = Array.isArray(body.photoIds)
				? body.photoIds.filter((id): id is string => typeof id === 'string')
				: [];

			const changed = await edits.renameDonor(photoIds, donor, curator);

			logger.info(`${curator.email} renamed a donor across ${changed} photographs.`);
			return response.status(200).json({ changed, donor: donor.trim() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. Drops the patch, so the photograph reverts to the generated index. */
export const deletePhotoEdit: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const photoId = typeof body.photoId === 'string' ? body.photoId : '';
			if (!photoId) return response.status(400).send('Geen foto opgegeven.');

			await edits.remove(photoId);
			return response.status(200).json({ id: photoId, reverted: true });
		} catch (error) {
			return fail(response, error);
		}
	}
);
