import { placeFamily } from '$lib/page-data';

/**
 * The wijken index, prerendered.
 *
 * One of the three places the whole archive can be browsed from, and where the menu's
 * "Alle wijken" points. The list comes from `load` so it is in the HTML: these pages exist to
 * be a route into the archive, and a route that only appears after a 1.1 MB download is
 * not one.
 */
export const prerender = true;

export async function load({ fetch }) {
	return { places: await placeFamily(fetch, 'wijken') };
}
