/**
 * Which of the three browse lists a place belongs in.
 *
 * This rule decides the header menus, the `/straten`, `/kastelen` and `/wijken` index
 * pages, and - since the menu is generated at build time rather than worked out in the
 * browser - the menu manifest too. Those have to agree: a place that the menu files under
 * "Kastelen" and the page files under "Wijken" is reachable from one and missing from the
 * other, and nobody notices for months.
 *
 * It lives here, in the shared models, precisely because the two sides that need it cannot
 * see each other's code. `src/lib/archive.ts` runs in the browser and imports things that
 * only exist under Vite; `functions/scripts/build-archive-index.ts` runs under plain tsc in
 * node. A copy on each side is exactly how the two would drift.
 */

/** The three lists every place with photographs falls into. */
export type PlaceFamily = 'straten' | 'kastelen' | 'wijken';

/** Kinds shown under "Kastelen". A fort is not a castle, but it is what people look for. */
const CASTLE_KINDS = new Set(['castle-estate', 'fort']);

/** The little of a place this rule actually reads. */
export interface Classifiable {
	kind: string;
	isStreet: boolean;
}

/**
 * Someone the archive photographed, filed under the name people knew them by.
 *
 * "Tajje de Kotter" was Matheus Janssens, and the photographs under that name are of the
 * procession through Kapellen for his hundredth birthday. He was listed among the
 * buildings, so he appeared in the browse lists as somewhere you could go and on the map as
 * a single point - which put a parade that ran from the Akkerstraat down the Hoevensebaan
 * to the centre on one house number.
 *
 * The entry stays, because the photographs have to be findable under his name. He is simply
 * not a place, so he is not offered as one.
 */
export function isPersonKind(place: Classifiable): boolean {
	return place.kind === 'person';
}

/** Which browse list a place belongs in, or null for anything that is not a place. */
export function familyOfPlace(place: Classifiable): PlaceFamily | null {
	if (isPersonKind(place)) return null;
	if (place.isStreet) return 'straten';
	if (CASTLE_KINDS.has(place.kind)) return 'kastelen';
	return 'wijken';
}
