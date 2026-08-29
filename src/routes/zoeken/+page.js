import { redirect } from '@sveltejs/kit';

/**
 * Search lives on the home page now, with the results under the box that asked the
 * question. This keeps every link and bookmark to the old page working, query and all.
 */
export const prerender = false;

export function load({ url }) {
	const query = url.searchParams.get('q');
	throw redirect(308, query ? `/?q=${encodeURIComponent(query)}` : '/');
}
