import { error } from '@sveltejs/kit';
import { subjectSummary } from '$lib/page-data';

export const prerender = true;

export async function load({ fetch, params }) {
	const summary = await subjectSummary(fetch, params.slug);
	if (!summary) throw error(404, 'Dit onderwerp kennen we niet.');

	return { slug: params.slug, summary };
}
