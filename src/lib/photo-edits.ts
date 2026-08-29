/**
 * Corrections a curator made to photographs already in the archive.
 *
 * Fetched from the deployed function rather than shipped with the build, because the point
 * of the editor is that a wrong street is right again immediately - not after somebody
 * remembers to rebuild and deploy.
 *
 * Everything here fails soft. If the functions are not deployed, or the network is down, or
 * the response is nonsense, the site shows the generated index exactly as it did before
 * this existed. An archive that will not open because an overlay is unreachable is worse
 * than one showing a title somebody meant to fix.
 */

import type { PhotoEdit, PhotoEditFile } from '../../sharedModels/photo-edit';

export type { PhotoEdit, PhotoFields } from '../../sharedModels/photo-edit';
export { applyPhotoEdit } from '../../sharedModels/photo-edit';

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/**
 * How long to wait for the overlay before going without it.
 *
 * This is fetched during the build now, not only in a browser: the photo pages are
 * prerendered, and their titles come from the archive, which is the archive a curator has
 * corrected. A build that reaches for a service is a build that can hang on one, and
 * `fetch` waits on a blackholed host until the operating system gives up - which on a CI
 * runner means the job burns its whole allowance and then fails with a timeout that says
 * nothing about why.
 *
 * Three seconds, because the same wait is also a visitor's. `loadArchive` does not resolve
 * until this does, and the header menus, the browse grids and the search all wait on that -
 * so a cold function held the whole site behind a third party. The prerendered pages carry
 * their own heading, picture and links, so what is actually delayed is the layer on top;
 * three seconds bounds it to something nobody sits through.
 *
 * Past it the archive is exactly what the generated index says, which is what it was before
 * the editor existed. A curator's correction then waits for the next visit rather than the
 * visitor waiting for it - and the prerendered HTML already carries whatever the build saw.
 *
 * The real fix is for the archive not to wait on this at all: resolve on the generated
 * index and lay the corrections over it when they arrive. That needs `loadArchive` to hand
 * back a second answer, which every caller would have to expect, so it is deliberately not
 * bundled into a change about search engines.
 */
const TIMEOUT_MS = 3_000;

let cache: Record<string, PhotoEdit> | null = null;

export async function loadPhotoEdits(
	fetcher: typeof fetch = fetch
): Promise<Record<string, PhotoEdit>> {
	if (cache) return cache;

	// No backend configured: this is the normal state for a fresh clone, and the archive
	// works completely without it.
	if (!FUNCTIONS_BASE) return {};

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}photoEdits`, {
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) return {};

		const parsed = (await response.json()) as Partial<PhotoEditFile>;
		cache = parsed.edits ?? {};
		return cache;
	} catch {
		return {};
	}
}

/** Forgets what was fetched, so a curator sees their own change without a reload. */
export function forgetPhotoEdits(): void {
	cache = null;
}
