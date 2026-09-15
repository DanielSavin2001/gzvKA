import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { readCopyText, slotFor } from '../../../sharedModels/site-copy';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as copy from '../services/siteCopyService';
import { validateCors } from '../utils/cors-helper';

/**
 * Rewriting the site's own words.
 *
 * Reading is public and writing is not, which is the split every other overlay here uses: a
 * rewritten introduction is site content the moment it is saved, and only a curator may
 * write one.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	logger.error('Site copy endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/**
 * Public. Every rewritten sentence, so the pages can lay them over what they shipped with.
 *
 * Cached for a few minutes like the photo edits, and for the same reason: this is fetched on
 * page loads across the whole site, and a visitor reading a five-minute-old sentence is
 * fine. The curator's own page asks with a cache-busting URL, so their save is visible to
 * them immediately.
 */
export const siteCopy: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			response.set('Cache-Control', 'public, max-age=300');
			return response.status(200).json({ version: 1, copy: await copy.all() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. The same, with who last changed each one and what it said before. */
export const listSiteCopy: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);
			return response.status(200).json({ version: 1, copy: await copy.allStored() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Rewrites one sentence.
 *
 * The id is checked against the registry rather than trusted, which is what stops a crafted
 * request from filling the public document with text no page renders - rows nobody would
 * ever see and nobody could find to delete.
 */
export const saveSiteCopy: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const id = typeof body.id === 'string' ? body.id : '';

			if (!slotFor(id)) return response.status(400).send('Die tekst staat niet op de site.');

			const text = readCopyText(id, body.text);
			if (text === undefined) {
				// Both halves of this are ordinary curator actions rather than errors, so they
				// are answered as a revert rather than refused: clearing the box means "use the
				// original", and typing the original back means the same thing.
				await copy.remove(id);
				logger.info(`${curator.email} reverted ${id}.`);
				return response.status(200).json({ id, reverted: true });
			}

			const saved = await copy.save(id, text, curator);
			logger.info(`${curator.email} rewrote ${id}.`);
			return response.status(200).json(saved);
		} catch (error) {
			return fail(response, error);
		}
	}
);
