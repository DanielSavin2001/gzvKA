import { donorIndex } from '$lib/page-data';

/**
 * Everyone who gave the archive a photograph, prerendered.
 *
 * The only route to 298 donor pages, so the list has to be in the HTML rather than appear
 * once the archive has downloaded - a crawler that receives a heading and the word "Bezig
 * met laden ..." finds none of them.
 */
export const prerender = true;

export async function load({ fetch }) {
	return { donors: await donorIndex(fetch) };
}
