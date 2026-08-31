/**
 * Coordinates a curator placed for whole places, fetched live.
 *
 * The committed `static/data/place-coordinates.json` is the durable record; this overlay is
 * what makes placing a castle a click instead of a deploy. Everything here fails soft, the
 * same way the photo-edit overlay does: no backend, no network, or a nonsense answer all
 * mean "no pins", and the map draws what the committed files say.
 */

import type { PlacePin, PlacePinFile } from '../../sharedModels/place-pin';

export type { PlacePin } from '../../sharedModels/place-pin';

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/** Same reasoning as the photo-edit overlay: bounded, because a visitor is waiting on it. */
const TIMEOUT_MS = 3_000;

let cache: Record<string, PlacePin> | null = null;

/**
 * The pins, or null when they could not be fetched - callers that only draw treat null as
 * "none" (`?? {}`), while a caller that caches must not freeze a failure as an answer.
 *
 * `fresh: true` bypasses the endpoint's 60-second HTTP cache as well as this module's,
 * which is what a curator needs right after saving or removing a pin: the browser would
 * otherwise happily serve the pre-change response for up to a minute.
 */
export async function loadPlacePins(
	fetcher: typeof fetch = fetch,
	options: { fresh?: boolean } = {}
): Promise<Record<string, PlacePin> | null> {
	if (cache && !options.fresh) return cache;

	// No backend configured: the normal state for a fresh clone; the map works without it.
	if (!FUNCTIONS_BASE) return {};

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}placePins`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			...(options.fresh ? { cache: 'reload' as RequestCache } : {})
		});
		if (!response.ok) return null;

		const parsed = (await response.json()) as Partial<PlacePinFile>;
		cache = parsed.pins ?? {};
		return cache;
	} catch {
		return null;
	}
}

/** Forgets what was fetched, so a curator sees their own pin without a reload. */
export function forgetPlacePins(): void {
	cache = null;
}
