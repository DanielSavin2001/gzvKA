import { redirect } from '@sveltejs/kit';

/**
 * The map used to be a page of its own. It is the front page now - looking for a
 * photograph of your street starts with the map, not with a link to it - so this only
 * exists to keep older links and bookmarks working.
 */
export const prerender = false;

export function load() {
	throw redirect(308, '/#kaart');
}
