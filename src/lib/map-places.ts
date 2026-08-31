/**
 * Which places end up on a map, and which cannot.
 *
 * The rule is small and six maps ask it: the front page's, and now the castles, streets,
 * districts, stories and donor pages, each of which draws a subset. It reads a curator's pin,
 * the street register and the research together, and getting it slightly different in one of
 * them would mean a place that is on one map and missing from another with nothing to explain
 * the difference.
 *
 * Every function here takes the two records as arguments rather than reading them from a
 * module-level cache, and that is deliberate: a Svelte reactive statement re-runs only when
 * an identifier written *in the statement* changes, so a helper that reached for `placed`
 * internally would freeze every list that calls it at whatever the first render held.
 */

import type { ArchivePlace } from './archive';
import type { PlacedCoordinate, StreetGeometry } from './coordinates';
import { locate } from './coordinates';
import type { Approximation } from './approximations';
import { isDrawable } from './approximations';

/**
 * The research behind a place, unless a curator has overruled it with a pin.
 *
 * A pin is the newer judgement of the same kind of person, so when there is one the
 * approximation is dropped along with its circle and its warning badge. That is the whole
 * point of a correction: it replaces the guess rather than sitting next to it.
 */
export function researchFor(
	approximations: Record<string, Approximation>,
	placed: Record<string, PlacedCoordinate>,
	placeId: string
): Approximation | undefined {
	if (placed[placeId]) return undefined;
	return approximations[placeId];
}

/**
 * Whether the research says this place belongs on a map of Kapellen at all.
 *
 * Blokjesweg was never found; three places sit outside the municipality on purpose. A place
 * nobody researched is not excluded - most streets come straight from the register and have
 * no approximation record at all.
 */
export function belongsOnMap(
	approximations: Record<string, Approximation>,
	placed: Record<string, PlacedCoordinate>,
	place: ArchivePlace
): boolean {
	const found = researchFor(approximations, placed, place.id);
	return found ? isDrawable(found) : true;
}

/** True when this place has something to draw: a point, or a pair of candidates. */
export function isOnMap(
	place: ArchivePlace,
	placed: Record<string, PlacedCoordinate>,
	geometry: Record<string, StreetGeometry>,
	approximations: Record<string, Approximation>
): boolean {
	if (!belongsOnMap(approximations, placed, place)) return false;

	const found = researchFor(approximations, placed, place.id);
	if (found?.display === 'kandidaten') return (found.candidates ?? []).length > 0;

	return locate(place.id, placed, geometry, approximations) !== null;
}

/**
 * The places a map can draw, and the ones it cannot, split.
 *
 * Both halves are returned because a page that shows only the first half quietly loses the
 * rest. Every one of the 30 castles happens to be placed today, so the caption reads "Alle 30
 * kastelen staan op de kaart" - but the moment one is not, "29 van de 30" above a list naming
 * the odd one out is the only honest thing to print, and it is what invites the person who
 * knows where it stood to say so.
 */
export function splitPlaces(
	places: ArchivePlace[],
	placed: Record<string, PlacedCoordinate>,
	geometry: Record<string, StreetGeometry>,
	approximations: Record<string, Approximation>
): { on: ArchivePlace[]; off: ArchivePlace[] } {
	const on: ArchivePlace[] = [];
	const off: ArchivePlace[] = [];

	for (const place of places) {
		if (isOnMap(place, placed, geometry, approximations)) on.push(place);
		else off.push(place);
	}

	return { on, off };
}
