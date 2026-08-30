import { donorSummary } from '$lib/page-data';

/**
 * One page per donor, prerendered.
 *
 * Everything the page shows comes from here rather than from the archive the browser
 * fetches, because this page is somebody's name: it is the one page in the archive a
 * person is likely to be sent a link to, and it has to say who they are and what they gave
 * before any JavaScript runs.
 */
export const prerender = true;

export async function load({ params, fetch }) {
	return { slug: params.slug, summary: await donorSummary(fetch, params.slug) };
}
