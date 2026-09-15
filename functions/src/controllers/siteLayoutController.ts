import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { blocksOf, readPageLayout } from '../../../sharedModels/site-layout';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as layout from '../services/siteLayoutService';
import { validateCors } from '../utils/cors-helper';

/**
 * Rearranging the blocks of a page.
 *
 * Reading is public and writing is not, the same split as every other overlay here. What is
 * stored is only ever an order and a list of hidden ids, both drawn from a registry the
 * pages themselves declare - so no request, however crafted, can put something on a page
 * that the page does not already know how to render.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	logger.error('Site layout endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/** Public. Every rearranged page, so the site can draw them as the curators left them. */
export const siteLayout: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			response.set('Cache-Control', 'public, max-age=300');
			return response.status(200).json({ version: 1, layout: await layout.all() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curator only. The same, with who last rearranged each page. */
export const listSiteLayout: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);
			return response.status(200).json({ version: 1, layout: await layout.allStored() });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/**
 * Curator only. Stores one page's arrangement, or puts it back to the shipped one.
 *
 * An arrangement that says nothing - no order, nothing hidden - is a delete rather than a
 * row, for the reason a rewritten sentence identical to the default is: a row meaning "the
 * same as shipped" is a thing to reason about for ever with nothing to show for it.
 */
export const saveSiteLayout: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const page = typeof body.page === 'string' ? body.page : '';

			if (blocksOf(page).length === 0) {
				return response.status(400).send('Die pagina kan niet herschikt worden.');
			}

			const read = readPageLayout(page, body);
			if (read.order.length === 0 && read.hidden.length === 0) {
				await layout.remove(page);
				logger.info(`${curator.email} reset the layout of ${page}.`);
				return response.status(200).json({ page, reverted: true });
			}

			const saved = await layout.save(page, read, curator);
			logger.info(`${curator.email} rearranged ${page}.`);
			return response.status(200).json(saved);
		} catch (error) {
			return fail(response, error);
		}
	}
);
