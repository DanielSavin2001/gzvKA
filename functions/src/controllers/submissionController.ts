import { Request, Response } from 'express';
import { https, HttpsFunction } from 'firebase-functions';
import * as logger from 'firebase-functions/logger';

import { SubmissionError, readContributor, readSuggestion } from '../../../sharedModels/submission';
import { NotAuthorised, requireAdmin } from '../services/admin-auth';
import * as submissions from '../services/submissionService';
import { collectUpload, UploadValidationError } from '../services/upload/multipart';
import { validateCors } from '../utils/cors-helper';
import { isMissingIndex, missingIndexMessage } from '../utils/firestore-errors';

/**
 * The endpoints behind contributing a photograph and deciding what happens to it.
 *
 * Two audiences with nothing in common: anyone at all may POST a photograph, and only a
 * curator may see the queue or act on it. Keeping them in one file makes the boundary
 * obvious - every handler either calls `requireAdmin` on its first line or is deliberately
 * public, and there is no third case.
 */

/**
 * Turns a thrown error into a response.
 *
 * `forCurator` may only be passed by a handler that has already got past `requireAdmin`.
 * A visitor gets the same unrevealing line as before - what broke inside the archive is
 * none of their business and might say more than it should - but a curator staring at
 * "Er ging iets mis" on their own queue has nothing to act on and no way to read the
 * function's logs. That is exactly the position the archive was left in when the signed
 * preview links started failing: a 500, a generic sentence, and three photographs that had
 * arrived safely but could not be seen.
 */
function fail(response: Response, error: unknown, forCurator = false): Response {
	if (error instanceof NotAuthorised) {
		logger.warn('Refused: ', error.message);
		return response.status(error.status).send(error.message);
	}

	if (error instanceof SubmissionError || error instanceof UploadValidationError) {
		logger.warn('Rejected: ', error.message);
		return response.status(400).send(error.message);
	}

	if (isMissingIndex(error)) {
		logger.error('Missing Firestore index: ', error);
		return response.status(500).send(missingIndexMessage(error));
	}

	logger.error('Submission endpoint failed: ', error);

	if (forCurator) {
		const reason = error instanceof Error ? error.message : String(error);
		return response.status(500).send(`Er ging iets mis: ${reason.slice(0, 500)}`);
	}

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

			const { files, fields } = await collectUpload(request.headers, request.body);
			if (files.length === 0) return response.status(400).send('Geen foto ontvangen.');

			// Name, email and the note about the batch still ride the query string, so a page
			// opened before this deploy keeps working; the multipart `meta` field carries what
			// the query string cannot: one suggestion per photograph, in file order.
			const contributor = readContributor({
				name: request.query.name,
				email: request.query.email,
				note: request.query.note
			});

			let meta: unknown[] = [];
			if (typeof fields.meta === 'string' && fields.meta !== '') {
				try {
					const parsed: unknown = JSON.parse(fields.meta);
					if (Array.isArray(parsed)) meta = parsed;
				} catch {
					// A malformed meta field loses the suggestions, not the photographs.
					logger.warn('Could not parse the meta field of an upload; storing files without it.');
				}
			}

			const stored = [];
			for (const [index, file] of files.entries()) {
				stored.push(
					await submissions.submit(
						{
							buffer: file.buffer,
							originalName: file.fields.filename,
							contentType: file.fields.mimeType
						},
						contributor,
						readSuggestion(meta[index])
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
			//
			// One link at a time, and a failure costs that link rather than the queue. Signing
			// is the one step here that depends on something outside this code - the runtime
			// service account needs iam.serviceAccounts.signBlob, and without it every call
			// throws. Inside a bare Promise.all that took the whole response down with it: a
			// curator with three photographs waiting saw a 500 and an empty queue, with no way
			// to approve the photographs the archive already had. A row without its thumbnail
			// can still be read, judged and approved; a row that does not exist cannot.
			const withPreviews = await Promise.all(
				found.map(async (submission) => {
					try {
						return {
							...submission,
							previewUrl: await submissions.previewUrl(submission.storagePath)
						};
					} catch (error) {
						logger.error('Preview link failed for ', submission.storagePath, error);
						return { ...submission, previewUrl: null };
					}
				})
			);

			return response.status(200).json({ submissions: withPreviews });
		} catch (error) {
			return fail(response, error, true);
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
			return fail(response, error, true);
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
			return fail(response, error, true);
		}
	}
);
