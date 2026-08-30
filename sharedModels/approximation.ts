/**
 * Places the archive knows roughly rather than exactly.
 *
 * Most of this archive's map is built from things that can be looked up: a street in the
 * official register, a coordinate a person clicked. The castles, hamlets, chapels and
 * demolished cafés are not in any register, and 3,644 photographs are filed under them.
 * They were researched by hand instead, and the research came back with a confidence grade
 * per place rather than a coordinate per place.
 *
 * The grade is the part that matters here. A point derived from a geocoded address and a
 * point derived from someone's reading of "on the north side of the Kalmthoutsesteenweg" -
 * a street 1.7 km long - are both a latitude and a longitude, and a map that draws them
 * identically asserts a precision the second one does not have. Nobody ever finds out which
 * pins to distrust, so nobody ever corrects them.
 *
 * So `display` travels with the coordinate and decides how it is drawn, and `doubt` travels
 * with it too and is shown to the reader in the researcher's own words. A local who reads
 * "the point comes from the street name Bunderbeeklaan, because 'Bunder' appears in both"
 * knows in one second whether that reasoning is wrong. "Location approximate" tells them
 * nothing and invites nothing.
 */

/** How a place should be drawn. Decided by the research, not by the component. */
export type Display = 'punt' | 'punt_met_twijfel' | 'benadering' | 'kandidaten' | 'niet_geplaatst';

/** One of two or more genuinely different possible locations. */
export interface Candidate {
	lat: number;
	lng: number;
	/** What this candidate rests on, so a reader can judge between them. */
	label: string;
}

export interface Approximation {
	id: string;
	name: string;
	lat?: number;
	lng?: number;
	/** A geocoded, B street-certain, C inferred from a description, ? not found. */
	grade: string;
	display: Display;
	/** Metres the point could be out by. */
	radius?: number;
	note: string;
	/** Why we are unsure. Shown verbatim - it is the most useful thing on the panel. */
	doubt?: string;
	/** Longer reasoning, for a curator rather than a passer-by. */
	research?: string;
	candidates?: Candidate[];
	correctable: boolean;
	/** Photographs riding on this place, so the queue can be ranked by what is at stake. */
	priority: number;
	/** 'plaats', 'persoon' or 'hernoemde_straat'. */
	kind: string;
	aliasOf?: string;
	outsideKapellen: boolean;
}

export interface ApproximationFile {
	version: number;
	attribution: string[];
	places: Record<string, Approximation>;
}

/**
 * Whether this place should appear on the map at all.
 *
 * A place just over the municipal boundary is still drawn. Kasteel Ravenhof is in
 * Putte-Stabroek and the Moretusbos around it runs into Kapellen; the archive holds eleven
 * photographs of it, and leaving it off the map made it read as a place nobody had bothered
 * to locate. `outsideKapellen` stays on the record and the panel says where it really is -
 * it is a fact about the place, not a reason to hide it.
 */
export function isDrawable(approximation: Approximation): boolean {
	// A person is not a location. "Tajje de Kotter" carried a point in the Akkerstraat,
	// where Matheus Janssens was collected on his hundredth birthday - but the photographs
	// are of a procession that ran from there down the Hoevensebaan to the centre, and
	// pinning it to one house number says something none of them do.
	if (approximation.kind === 'persoon') return false;
	if (approximation.display === 'niet_geplaatst') return false;
	if (approximation.display === 'kandidaten') return (approximation.candidates ?? []).length > 0;
	return approximation.lat != null && approximation.lng != null;
}

/** True when the place is drawn with a radius of doubt around it. */
export function hasCircle(approximation: Approximation): boolean {
	return approximation.display === 'benadering' && (approximation.radius ?? 0) > 0;
}

const EARTH_RADIUS_METRES = 6378137;
const CIRCLE_POINTS = 64;

/**
 * A circle of `radius` metres around a point, as a GeoJSON polygon ring.
 *
 * MapLibre can draw a circle in screen pixels, but a doubt measured in metres has to stay
 * the same size on the ground as the reader zooms - a 600 m circle that shrinks to a dot
 * when you zoom out stops saying anything about 600 m. So the circle is real geometry.
 *
 * The longitude step is divided by the cosine of the latitude because a degree of longitude
 * is shorter the further you are from the equator; without it the circle is drawn as an
 * ellipse, noticeably squashed at Kapellen's latitude.
 */
export function circlePolygon(
	lat: number,
	lng: number,
	radiusMetres: number,
	points = CIRCLE_POINTS
): [number, number][] {
	const ring: [number, number][] = [];
	const latitudeRadians = (lat * Math.PI) / 180;

	for (let index = 0; index <= points; index += 1) {
		const angle = (2 * Math.PI * index) / points;
		const deltaLat = ((radiusMetres * Math.cos(angle)) / EARTH_RADIUS_METRES) * (180 / Math.PI);
		const deltaLng =
			((radiusMetres * Math.sin(angle)) / (EARTH_RADIUS_METRES * Math.cos(latitudeRadians))) *
			(180 / Math.PI);

		ring.push([lng + deltaLng, lat + deltaLat]);
	}

	return ring;
}

/** The circles to draw, as one FeatureCollection so the map needs a single source. */
export function circleCollection(approximations: Approximation[]) {
	return {
		type: 'FeatureCollection' as const,
		features: approximations.filter(hasCircle).map((approximation) => ({
			type: 'Feature' as const,
			properties: { id: approximation.id, name: approximation.name },
			geometry: {
				type: 'Polygon' as const,
				coordinates: [circlePolygon(approximation.lat!, approximation.lng!, approximation.radius!)]
			}
		}))
	};
}

/** Correctable places, most photographs first - the most valuable question to answer. */
export function correctionQueue(approximations: Record<string, Approximation>): Approximation[] {
	return Object.values(approximations)
		.filter((approximation) => approximation.correctable)
		.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}
