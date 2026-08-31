import { storyPlaces } from '$lib/page-data';
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
	const index = await loadStoryIndex(fetch);

	// The names of the places written about, so the map can be drawn from the prerendered
	// HTML. The story index is keyed by gazetteer id and knows no names; a map of a hundred
	// points labelled `kasteel-oude-gracht` is not a map.
	return { index, places: await storyPlaces(fetch, index.byPlace) };
}
