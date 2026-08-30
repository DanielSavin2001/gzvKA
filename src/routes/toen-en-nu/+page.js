import { thenAndNow } from '$lib/page-data';

/**
 * Toen & nu, prerendered.
 *
 * The pairings come from `load` rather than the browser for the same reason every other
 * list here does: this page is a route into the archive, and a route that only appears
 * after a 1.1 MB download is not one.
 */
export const prerender = true;

export async function load({ fetch }) {
	return await thenAndNow(fetch);
}
