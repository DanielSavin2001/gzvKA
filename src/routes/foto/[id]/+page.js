import { photoSummary } from '$lib/page-data';

/**
 * One page per photograph, prerendered.
 *
 * This is where prerendering matters most. A photograph is the thing people search for and
 * the thing they paste into a WhatsApp group - and WhatsApp, Facebook and every other link
 * preview fetch the HTML without running any JavaScript. Rendered on the client, all 4,504
 * of these shared one title and no image, so every share showed a bare URL.
 *
 * Only the record for this one photograph is returned. The archive index is still fetched
 * in the browser for the neighbours and the rest of the page; inlining it here would add it
 * to 4,504 pages to save a request the browser makes anyway.
 */
export const prerender = true;

export async function load({ params, fetch }) {
	return { id: params.id, summary: await photoSummary(fetch, params.id) };
}
