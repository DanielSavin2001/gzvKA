/**
 * The streets of Kapellen the archive has no photograph of.
 *
 * The most common visit to this site is somebody typing the street they grew up in, and
 * until now that mostly failed. The archive holds photographs of 45 streets; the official
 * register that already ships in `functions/src/data/streets/` knows 313. So for 277 streets
 * there was no page, no map, no suggestion and no invitation - just a search box replying
 * "Probeer een straatnaam, een deel van een naam, of een jaartal".
 *
 * The site even contradicted itself about it: `/straten` advertises its index as running
 * "van de Antwerpsesteenweg tot de Zilverenhoeklaan", and the Zilverenhoeklaan had no page.
 *
 * A register street's page cannot show photographs, because there are none. What it can do
 * is confirm the street exists, put it on the map, point at the nearest streets that do have
 * photographs, and ask. Somebody who came looking for the Berkenlaan leaves having seen the
 * Hoevensebaan, which is a better outcome than a shrug.
 */

import { normalizeText } from './text';

/** One street from the official register, with no photographs in the archive. */
export interface RegisterStreet {
	/** `slugify(name)`, the same key a gazetteer place would have. */
	slug: string;
	name: string;
	lat: number;
	lng: number;
	/** Metres, from the register. */
	length?: number;
}

export interface StreetRegisterFile {
	version: number;
	streets: RegisterStreet[];
}

const EARTH_RADIUS_METRES = 6378137;

/**
 * Metres between two points, flat-earth style.
 *
 * Over a municipality six kilometres across the error is centimetres, and this runs 277
 * times against every photographed place on every one of those pages.
 */
export function metresBetween(
	one: { lat: number; lng: number },
	two: { lat: number; lng: number }
): number {
	const toRadians = Math.PI / 180;
	const meanLat = ((one.lat + two.lat) / 2) * toRadians;
	const deltaLat = (two.lat - one.lat) * toRadians;
	const deltaLng = (two.lng - one.lng) * toRadians * Math.cos(meanLat);

	return Math.round(Math.hypot(deltaLat, deltaLng) * EARTH_RADIUS_METRES);
}

/** Somewhere with photographs, near enough to be worth offering. */
export interface NearbyPlace {
	id: string;
	name: string;
	count: number;
	lat: number;
	lng: number;
}

/**
 * The nearest places that actually hold photographs.
 *
 * Sorted by distance and nothing else. Weighting by photograph count was the obvious
 * alternative and it is wrong for this page: somebody looking at the Berkenlaan wants the
 * street round the corner, not the busiest street in the village - they already know where
 * the Dorpsstraat is.
 */
export function nearestWithPhotos(
	from: { lat: number; lng: number },
	places: NearbyPlace[],
	limit = 5
): (NearbyPlace & { metres: number })[] {
	return places
		.filter((place) => place.count > 0)
		.map((place) => ({ ...place, metres: metresBetween(from, place) }))
		.sort((one, two) => one.metres - two.metres || one.name.localeCompare(two.name, 'nl'))
		.slice(0, limit);
}

/**
 * Register streets matching what somebody typed, for the search box.
 *
 * The suggestion list only ever offered places with photographs, which is exactly backwards
 * for the commonest search on the site: somebody types their own street, and 277 of the 313
 * streets in Kapellen produced nothing at all. They belong under the photographed ones - a
 * street with pictures is the better answer - but above nothing.
 *
 * `exclude` is the set the archive already answered with, so a street never appears twice.
 */
export function suggestRegisterStreets(
	streets: RegisterStreet[],
	query: string,
	exclude: ReadonlySet<string> = new Set(),
	limit = 4
): RegisterStreet[] {
	const normalized = normalizeText(query);
	if (normalized === '') return [];

	return streets
		.filter(
			(street) => !exclude.has(street.slug) && normalizeText(street.name).includes(normalized)
		)
		.sort((one, two) => {
			const oneStarts = normalizeText(one.name).startsWith(normalized) ? 1 : 0;
			const twoStarts = normalizeText(two.name).startsWith(normalized) ? 1 : 0;
			return twoStarts - oneStarts || one.name.localeCompare(two.name, 'nl');
		})
		.slice(0, limit);
}
