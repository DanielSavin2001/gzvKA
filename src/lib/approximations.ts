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

let cache: Record<string, Approximation> | null = null;

/**
 * Loads the researched places. Missing means "none researched", never an error: the map
 * worked from the register alone before this file existed and must keep doing so.
 */
export async function loadApproximations(
	fetcher: typeof fetch = fetch
): Promise<Record<string, Approximation>> {
	if (cache) return cache;

	try {
		const response = await fetcher('/data/place-approximations.json');
		if (!response.ok) return {};

		const parsed = (await response.json()) as Partial<ApproximationFile>;
		cache = parsed.places ?? {};
		return cache;
	} catch {
		return {};
	}
}
