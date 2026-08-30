import { archiveSummary } from '$lib/page-data';
import { loadStoryIndex } from '$lib/stories';

/**
 * The street and story lists, from `load`.
 *
 * The home page is where a crawler arrives and it is the only place the whole archive is
 * laid out, but both lists were built from data fetched after the HTML had been served -
 * so the response contained no link to any of the 121 places or 101 stories. Everything
 * below the front door was an orphan.
 *
 * Names and counts only, about 8 KB. The photographs, the map and the search stay in the
 * browser, which is where they belong.
 */
export const prerender = true;

export async function load({ fetch }) {
	const [summary, stories] = await Promise.all([
		archiveSummary(fetch),
		loadStoryIndex(fetch).catch(() => null)
	]);

	return { summary, stories };
}
