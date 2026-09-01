import { placeFamily, registerStreets } from '$lib/page-data';

/**
 * The straten index, prerendered.
 *
 * One of the three places the whole archive can be browsed from, and where the menu's
 * "Alle straten" points. The list comes from `load` so it is in the HTML: these pages exist to
 * be a route into the archive, and a route that only appears after a 1.1 MB download is
 * not one.
 *
 * The register streets come along too. The page used to promise an index running "van de
 * Antwerpsesteenweg tot de Zilverenhoeklaan" while the Zilverenhoeklaan had no page at all,
 * because it has no photographs - and 277 of the 313 streets in Kapellen are in that
 * position. They are listed apart from the photographed ones, under what they are: the
 * streets still missing.
 */
export const prerender = true;

export async function load({ fetch }) {
	const [places, register] = await Promise.all([
		placeFamily(fetch, 'straten'),
		registerStreets(fetch)
	]);
	const known = new Set(places.map((place) => place.id));

	return { places, missing: register.filter((street) => !known.has(street.slug)) };
}
