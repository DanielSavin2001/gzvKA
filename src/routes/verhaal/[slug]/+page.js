import { storyImage } from '$lib/page-data';
import { loadStory } from '$lib/stories';

/**
 * One story per slug, prerendered.
 *
 * These used to render on the client, which meant a search engine and every link preview
 * received the same 2 KB shell for all 101 of them: one generic title, no heading, no text.
 * The whole point of migrating 290,000 characters of writing off the old site was that
 * people could find it, and nobody could.
 *
 * Prerendering needs the story at build time rather than in `onMount`, so it is fetched
 * here. The list of slugs lives in `+page.server.js`: `entries` runs outside any request
 * and cannot use a relative fetch, so it reads the generated index from disk instead.
 */
export const prerender = true;

export async function load({ params, fetch }) {
	// A missing story is a 404 from `getJson`, which SvelteKit turns into the error page.
	const story = await loadStory(params.slug, fetch);

	// The opening photograph, for the link preview. It has to be resolved here rather than
	// on the page: the page gets its pictures from the archive, which the browser fetches,
	// so at prerender time there is nothing to point a preview at.
	const photoIds = story.sections
		.flatMap((section) => section.parts)
		.flatMap((part) => (part.k === 'i' && part.id ? [part.id] : []));

	return { slug: params.slug, story, image: await storyImage(fetch, photoIds) };
}
