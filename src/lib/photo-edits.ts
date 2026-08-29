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

let cache: Record<string, PhotoEdit> | null = null;

export async function loadPhotoEdits(
	fetcher: typeof fetch = fetch
): Promise<Record<string, PhotoEdit>> {
	if (cache) return cache;

	// No backend configured: this is the normal state for a fresh clone, and the archive
	// works completely without it.
	if (!FUNCTIONS_BASE) return {};

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}photoEdits`);
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
