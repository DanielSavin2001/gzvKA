import { subjectIndex } from '$lib/page-data';

/**
 * The subject index, prerendered.
 *
 * The fourth way into the archive, beside straten, kastelen and wijken - and the only one
 * that reaches the photographs matching no place at all. The list comes from `load` so it is
 * in the HTML: a route into the archive that only appears after a 1.1 MB download is not one.
 */
export const prerender = true;

export async function load({ fetch }) {
	return { subjects: await subjectIndex(fetch) };
}
