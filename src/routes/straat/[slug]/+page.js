import { placeSummary, registerStreetView } from '$lib/page-data';

/**
 * One page per place, prerendered.
 *
 * The archive itself is still fetched in the browser - it is one file the whole site
 * shares, and 121 copies of it inlined into 121 pages would be worse than one download.
 * What comes from here is only what the head needs before any JavaScript runs: the place's
 * real name and how many photographs it has. Without it the pages came out titled with
 * their own slug, which is what a crawler would then show.
 *
 * A slug the archive does not know may still be a real street: the official register holds
 * 277 of them that no photograph has ever been filed under. Those get `street` instead of
 * `summary`, and a page that says where the street is and which photographed streets are
 * nearest, rather than "Deze plaats kennen we niet".
 *
 * The slug list lives in `+page.server.js`, because `entries` runs outside any request and
 * cannot use a relative fetch.
 */
export const prerender = true;

export async function load({ params, fetch }) {
	const summary = await placeSummary(fetch, params.slug);
	if (summary) return { slug: params.slug, summary, street: null };

	return {
		slug: params.slug,
		summary: null,
		street: await registerStreetView(fetch, params.slug)
	};
}
