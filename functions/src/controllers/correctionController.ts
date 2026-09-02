import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import type { Approximation } from '../../../sharedModels/approximation';
import { CorrectionError } from '../../../sharedModels/correction';
import { readContributor } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as corrections from '../services/correctionService';
import type { KnownPlace } from '../services/correctionService';
import * as placeRecords from '../services/placeRecordService';
import { callerKey, countRequest, TooMany } from '../services/throttle';
import { validateCors } from '../utils/cors-helper';
import { isMissingIndex, missingIndexMessage } from '../utils/firestore-errors';
import * as researched from '../data/place-approximations.json';
import * as gazetteer from '../data/kapellen-gazetteer.json';

/**
 * The endpoints behind "this pin is in the wrong place".
 *
 * Anyone may say so - the people who know where Kasteel Beaulieu stood are not the people
 * with an account - and only a curator may see the reports or act on them. As with the
 * photograph queue, every handler here either calls `requireAdmin` on its first line or is
 * deliberately public, and there is no third case.
 */

const PLACES = (researched as { places: Record<string, Approximation> }).places;

/**
 * Every place in the gazetteer, by id, so a report can be about any of them.
 *
 * Built once at module load. It is 131 entries out of a file that is already bundled with
 * the functions, and a lookup per submission is the whole cost.
 */
const GAZETTEER: Record<string, string> = Object.fromEntries(
	(gazetteer as { entries: { id: string; name: string }[] }).entries.map((entry) => [
		entry.id,
		entry.name
	])
);

/**
 * The place a report is about, or null when the archive has never heard of it.
 *
 * Three sources, because the archive has three kinds of place and a reader on a map cannot
 * tell them apart: the researched ones, the gazetteer the site is built from, and the ones
 * curators have made since. Only the first of those used to be reportable - and only the 27
 * of them flagged `correctable`, which is 27 places out of every marker on every map.
 *
 * That gate is gone. It was defensible when the front page's panel was the only way in and
 * the panel appeared exactly where a report was invited; it was never defensible from the
 * reader's side, where a red circle around a pin is an invitation whatever the record says.
 * Somebody who knows a geocoded address is on the wrong side of the street is the person
 * this queue exists for. Every report still lands as `pending` and moves nothing on its own.
 */
async function knownPlace(placeId: string): Promise<KnownPlace | null> {
	if (!placeId) return null;

	const approximation = PLACES[placeId];
	if (approximation) return { id: placeId, name: approximation.name, approximation };

	const fromGazetteer = GAZETTEER[placeId];
	if (fromGazetteer) return { id: placeId, name: fromGazetteer };

	// Last, because it is the only one that costs a read. A curator-made place is a place
	// like any other and has to be reportable, or the newest half of the gazetteer is the
	// half nobody can correct.
	const record = (await placeRecords.all())[placeId];
	if (record) return { id: placeId, name: record.name };

	return null;
}

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

	if (isMissingIndex(error)) {
		logger.error('Missing Firestore index: ', error);
		return response.status(500).send(missingIndexMessage(error));
	}

	logger.error('Correction endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/**
 * Public. Records that somebody thinks a place is in the wrong spot.
 *
 * The place is looked up here rather than taken from the request, so that what gets stored
 * as "what the map was claiming" is what the map actually claims - a curator reading the
 * report needs that to be the archive's own account, not the browser's. That is also the
 * only check left: any place the archive knows can be reported, researched or not.
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
			const place = await knownPlace(placeId);

			if (!place) return response.status(404).send('Die plaats kennen we niet.');

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
