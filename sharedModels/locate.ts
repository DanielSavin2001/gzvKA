/**
 * Where a place is, decided once for the whole site.
 *
 * Every pin on every map comes out of `locate`, and it is a pure function over three
 * records - which is exactly why it lives here rather than beside the fetch that loads
 * them. It used to sit in `src/lib/coordinates.ts`, where the jest suite in `functions/`
 * cannot reach it, so the one function that decides where 131 places are drawn had no test
 * at all. The same reasoning is written at the top of `approximation.ts`: a place quietly
 * drawn in the wrong spot is the kind of mistake that survives for months because the map
 * still looks fine.
 */

/** One placed coordinate, with who placed it and when. */
export interface PlacedCoordinate {
	lat: number;
	lng: number;
	/** Who placed it, so a doubtful pin can be asked about. */
	by?: string;
	/** ISO date it was placed. */
	on?: string;
}

/** A street's real centreline, from the official register. */
export interface StreetGeometry {
	name: string;
	municipality: string;
	lat: number;
	lng: number;
	/** Simplified centreline(s) as [lng, lat] pairs, ready to draw. */
	lines: [number, number][][];
	/** Metres. */
	length?: number;
}

import type { Approximation } from './approximation';
import { hasCircle } from './approximation';

/** Where a coordinate came from, worst case last. */
export type CoordinateSource = 'placed' | 'register' | 'onderzoek';

/**
 * Where a place is, best source first.
 *
 * A coordinate a person clicked always beats one derived from the register. The register is
 * authoritative about where the Dorpsstraat runs, but a curator who moved a place did so
 * for a reason - the castle sits back from the road, the photograph is of the far end - and
 * that judgement is worth more than a centreline midpoint.
 *
 * Researched places come last, and deliberately so: they are the only tier that can be
 * wrong by hundreds of metres. `source` is returned rather than discarded precisely so a
 * caller can tell the three apart - a map that cannot distinguish a clicked pin from a
 * reading of a sentence will draw them the same, and then nobody knows which to trust.
 *
 * With one exception, in the middle: research that carries a radius of doubt beats the
 * register. The register is authoritative about where the Dorpsstraat runs, and that is the
 * whole of what it is authoritative about - a match on a name is not knowledge about the
 * thing that bears the name. "Kasteel Oude Gracht" carries the alias "Oude Gracht", which is
 * also a 2.3 km road in the register, so the castle was drawn at the road's midpoint, 761 m
 * from where the archive's own 1892 map puts it - and its circle stayed behind at the
 * researched point, because a circle is drawn from the research and a marker from here. The
 * map then said two contradictory things about one castle: it is here, and it is somewhere
 * in that ring over there. That is the exact failure the circle exists to prevent.
 *
 * Scoped to research with a circle, because that is the case where the research has staked a
 * claim precise enough to be contradicted: it names a point and how far out it might be, and
 * the register's answer fell outside it. A researched place with no radius keeps the old
 * order, so the three non-street places the register does legitimately position - Driehoek,
 * Nieuwe Wijk and Villa Heirust, none of which has any research - are untouched.
 *
 * This answers "where is it", not "should it be drawn". A place outside Kapellen has a
 * perfectly good coordinate and still does not belong on a map of Kapellen; that is
 * `isDrawable`'s decision, not this one.
 */
export function locate(
	placeId: string,
	placedCoordinates: Record<string, PlacedCoordinate>,
	geometry: Record<string, StreetGeometry>,
	approximations: Record<string, Approximation> = {}
): { lat: number; lng: number; source: CoordinateSource } | null {
	const byHand = placedCoordinates[placeId];
	if (byHand) return { lat: byHand.lat, lng: byHand.lng, source: 'placed' };

	const researched = approximations[placeId];

	// Before the register, not after it: wherever a circle is drawn, the marker has to sit at
	// its centre, or the two are telling the reader different stories about one place.
	//
	// The coordinates are checked as well as the circle, and not defensively: `hasCircle`
	// reads `display` and `radius` and nothing else, so a `benadering` record that names a
	// radius but no point satisfies it. Trusting it alone returned `{lat: undefined, lng:
	// undefined}` from the one function that must never hand back a position that is not one.
	if (researched && hasCircle(researched) && researched.lat != null && researched.lng != null) {
		return { lat: researched.lat, lng: researched.lng, source: 'onderzoek' };
	}

	const derived = geometry[placeId];
	if (derived) return { lat: derived.lat, lng: derived.lng, source: 'register' };

	if (researched && researched.lat != null && researched.lng != null) {
		return { lat: researched.lat, lng: researched.lng, source: 'onderzoek' };
	}

	return null;
}
