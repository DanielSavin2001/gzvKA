import { Request, Response } from 'express';

/**
 * Which browsers may talk to these functions.
 *
 * The list used to be two literal origins: localhost and `https://gzvka.com`. That is
 * every origin the site is served from except the ones it is actually tested on - Firebase
 * Hosting serves the project at `<project>.web.app` and gives every pull request a preview
 * channel at `<project>--<channel>.web.app`. A call from either was answered without
 * `Access-Control-Allow-Origin`, so the browser threw the response away and the upload page
 * looked broken on the one URL anybody would try it on first.
 *
 * The project's own hosting domains are therefore allowed by pattern. This is not a
 * loosening: a preview channel of this project is this project, deployed from a branch of
 * this repository. Nothing else matches - the pattern is anchored, and an origin is only
 * ever a scheme, host and port, so there is no path for `evil.com` to end up inside it.
 *
 * CORS is not an access control anyway. It decides which *pages* a browser will hand a
 * response to; it decides nothing about who may call. What protects the queue is the ID
 * token check in `admin-auth.ts`, which runs on every curator request regardless of where
 * it came from.
 */

/** Cloud Functions sets this; the fallback is only for tests and the emulator. */
function projectId(): string {
	return process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'gzvka-12a9f';
}

const EXACT = ['http://localhost:5173', 'https://gzvka.com', 'https://www.gzvka.com'];

function escapeForRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `<project>.web.app`, `<project>.firebaseapp.com`, and preview channels, which Firebase
 * names `<project>--<channel>-<hash>.web.app`.
 */
function hostingPattern(): RegExp {
	return new RegExp(
		`^https://${escapeForRegExp(projectId())}(--[a-z0-9-]+)?\\.(web\\.app|firebaseapp\\.com)$`
	);
}

/** Anything else the deployment needs, comma-separated. Empty by default. */
function extraOrigins(): string[] {
	return (process.env.GZVKA_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter((origin) => origin !== '');
}

export function isAllowedOrigin(origin: string): boolean {
	if (EXACT.includes(origin) || extraOrigins().includes(origin)) return true;
	return hostingPattern().test(origin);
}

export const validateCors = (request: Request, response: Response) => {
	const origin = request.headers.origin;

	if (origin != null) {
		if (isAllowedOrigin(origin)) {
			response.setHeader('Access-Control-Allow-Origin', origin);
			response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PATCH');
			// The curator's calls carry a bearer token, so the header has to be allowed too.
			response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			response.setHeader('Access-Control-Max-Age', '3600');
			// Responses differ by origin; without this a shared cache could serve one site's
			// headers to another.
			response.setHeader('Vary', 'Origin');
		}

		if (request.method === 'OPTIONS') {
			response.status(204).send();
		}
	}

	return response;
};
