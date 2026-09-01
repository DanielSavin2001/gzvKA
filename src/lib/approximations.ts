/**
 * Loading the researched places in the browser.
 *
 * The types and every pure function live in `sharedModels/approximation.ts` so that the
 * jest suite in `functions/` can reach them - a circle drawn as an ellipse, or a place
 * silently dropped from the map, is exactly the kind of mistake that hides for months
 * without a test. Only the fetch is here.
 */

export * from '../../sharedModels/approximation';

import type { Approximation, ApproximationFile } from '../../sharedModels/approximation';
import { withApproximationRecords } from '../../sharedModels/place-overlay';
import { loadPlaceRecords } from './place-records';

let cache: Record<string, Approximation> | null = null;

/**
 * Loads the researched places. Missing means "none researched", never an error: the map
 * worked from the register alone before this file existed and must keep doing so.
 *
 * Two layers, the same way the coordinates are two layers: the shipped research, and the
 * judgements a curator has recorded since the last deploy. The overlay is what makes a
 * wrong radius a thirty-second fix rather than an edit, an index run and a deploy - and the
 * places this file describes are the archive's least certain, so they are the ones a reader
 * is most likely to be able to correct.
 *
 * A failed half is never cached, so the next call retries rather than freezing today's
 * answer for the rest of the session.
 */
export async function loadApproximations(
	fetcher: typeof fetch = fetch
): Promise<Record<string, Approximation>> {
	if (cache) return cache;

	let shipped: Record<string, Approximation> | null = null;
	try {
		const response = await fetcher('/data/place-approximations.json');
		if (response.ok) {
			const parsed = (await response.json()) as Partial<ApproximationFile>;
			shipped = parsed.places ?? {};
		}
	} catch {
		shipped = null;
	}

	const records = await loadPlaceRecords(fetcher);
	const merged = withApproximationRecords(shipped ?? {}, records ?? {});

	if (shipped !== null && records !== null) cache = merged;
	return merged;
}

/** Forgets what was fetched, so a curator sees their own edit without a reload. */
export function forgetApproximations(): void {
	cache = null;
}
