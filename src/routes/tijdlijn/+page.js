import { decades } from '$lib/page-data';

/**
 * The archive by decade, prerendered.
 *
 * The whole page is the data, so it comes from `load`: a timeline that appears only after
 * a 1.1 MB index has downloaded is a blank screen with a heading on it, and a crawler
 * would never see the 608 photographs at all.
 */
export const prerender = true;

export async function load({ fetch }) {
	return await decades(fetch);
}
