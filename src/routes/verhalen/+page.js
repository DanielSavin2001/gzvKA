import { loadStoryIndex } from '$lib/stories';

/**
 * The list of stories, from `load` rather than from `onMount`.
 *
 * This page is the only crawlable route to 101 stories, and it was fetching them after the
 * HTML had already been served - so what a search engine received was a heading, a
 * paragraph of introduction, and the words "Bezig met laden ...". Every story was an orphan
 * reachable only through the sitemap, which is a hint rather than a link: nothing on the
 * site pointed at any of them.
 *
 * The index is 16 KB and this is one page, so it is inlined here rather than fetched.
 */
export const prerender = true;

export async function load({ fetch }) {
	return { index: await loadStoryIndex(fetch) };
}
