import { placeSummary } from '$lib/page-data';

/**
 * One page per place, prerendered.
 *
 * The archive itself is still fetched in the browser - it is one file the whole site
 * shares, and 121 copies of it inlined into 121 pages would be worse than one download.
 * What comes from here is only what the head needs before any JavaScript runs: the place's
 * real name and how many photographs it has. Without it the pages came out titled with
 * their own slug, which is what a crawler would then show.
 *
 * The slug list lives in `+page.server.js`, because `entries` runs outside any request and
 * cannot use a relative fetch.
 */
export const prerender = true;

export async function load({ params, fetch }) {
	return { slug: params.slug, summary: await placeSummary(fetch, params.slug) };
}
