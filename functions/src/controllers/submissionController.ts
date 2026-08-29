import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { SubmissionError, readContributor } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as submissions from '../services/submissionService';
import { collectFiles, UploadValidationError } from '../services/upload/multipart';
import { validateCors } from '../utils/cors-helper';

/**
 * The endpoints behind contributing a photograph and deciding what happens to it.
 *
 * Two audiences with nothing in common: anyone at all may POST a photograph, and only a
 * curator may see the queue or act on it. Keeping them in one file makes the boundary
 * obvious - every handler either calls `requireAdmin` on its first line or is deliberately
 * public, and there is no third case.
 */

function fail(response: Response, error: unknown): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof SubmissionError || error instanceof UploadValidationError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	logger.error('Submission endpoint failed: ', error);
	return response.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
}

/**
 * Public. Accepts one or more photographs with an optional name, email and note.
 *
 * No account, no login: requiring one is how an archive of a village ends up with
 * photographs from six people. What arrives is stored out of sight until a curator has
 * looked at it, which is where the safety lives instead.
 */
export const submitPhoto: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const files = await collectFiles(request.headers, request.body);
			if (files.length === 0) return response.status(400).send('Geen foto ontvangen.');

			const contributor = readContributor({
				name: request.query.name,
				email: request.query.email,
				note: request.query.note
			});

			const stored = [];
			for (const file of files) {
				stored.push(
					await submissions.submit(
						{
							buffer: file.buffer,
							originalName: file.fields.filename,
							contentType: file.fields.mimeType
						},
						contributor
					)
				);
			}

			return response.status(201).json({ accepted: stored.length, ids: stored.map((s) => s.id) });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Public. What the website merges into the archive so approved photographs show at once. */
export const publishedPhotos: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			if (request.method !== 'GET') return response.status(405).send('Method Not Allowed');

			const photos = await submissions.published();

			// Short, not zero: a photograph approved a minute ago should appear without a
			// curator wondering whether it worked, but every visitor need not ask every time.
			response.setHeader('Cache-Control', 'public, max-age=60');
			return response.status(200).json({ version: 1, photos });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curators only. The queue. */
export const listSubmissions: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			await requireAdmin(request.headers.authorization);

			const status = String(request.query.status ?? 'pending');
			const allowed = ['pending', 'approved', 'rejected', 'all'];
			if (!allowed.includes(status)) return response.status(400).send('Onbekende status.');

			const found = await submissions.list(status as never);

			// Signed links, so a curator can see a photograph that is not public yet without
			// the bucket being readable by anyone who guesses a path.
			const withPreviews = await Promise.all(
				found.map(async (submission) => ({
					...submission,
					previewUrl: await submissions.previewUrl(submission.storagePath)
				}))
			);

			return response.status(200).json({ submissions: withPreviews });
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curators only. Approve, reject, or put something back in the queue. */
export const reviewSubmission: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);

			if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

			const body = (request.body ?? {}) as Record<string, unknown>;
			const id = typeof body.id === 'string' ? body.id : '';
			const status = String(body.status ?? '');

			if (!id) return response.status(400).send('Geen inzending opgegeven.');
			if (!['approved', 'rejected', 'pending'].includes(status)) {
				return response.status(400).send('Onbekende beslissing.');
			}

			const updated = await submissions.review(
				id,
				{
					status: status as never,
					fields: submissions.readCuratorFields(body),
					...(typeof body.rejectionReason === 'string'
						? { rejectionReason: body.rejectionReason }
						: {})
				},
				curator
			);

			return response.status(200).json(updated);
		} catch (error) {
			return fail(response, error);
		}
	}
);

/** Curators only. Confirms the caller is one, so the admin page knows to show itself. */
export const whoAmI: HttpsFunction = https.onRequest(
	async (request: Request, response: Response): Promise<any> => {
		response = validateCors(request, response);
		if (response.headersSent) return response;

		try {
			const curator = await requireAdmin(request.headers.authorization);
			return response.status(200).json(curator);
		} catch (error) {
			return fail(response, error);
		}
	}
);
