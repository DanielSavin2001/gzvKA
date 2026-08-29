import * as fs from 'fs';
import * as path from 'path';

import type { Approximation } from '../../../sharedModels/approximation';
import {
	circleCollection,
	circlePolygon,
	correctionQueue,
	hasCircle,
	isDrawable
} from '../../../sharedModels/approximation';

/**
 * The researched places carry their own uncertainty, and every function here exists to keep
 * that uncertainty visible. A circle drawn as an ellipse, or a place quietly dropped from
 * the map, is the kind of mistake that survives for months because the map still looks
 * fine.
 */

const KAPELLEN_LAT = 51.3125;
const KAPELLEN_LNG = 4.4295;

/** Metres between two coordinates, by the haversine formula. */
function metresApart(aLat: number, aLng: number, bLat: number, bLng: number): number {
	const R = 6378137;
	const toRad = (degrees: number) => (degrees * Math.PI) / 180;
	const dLat = toRad(bLat - aLat);
	const dLng = toRad(bLng - aLng);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

function place(overrides: Partial<Approximation> = {}): Approximation {
	return {
		id: 'test',
		name: 'Test',
		grade: 'C',
		display: 'benadering',
		note: '',
		correctable: true,
		priority: 0,
		kind: 'plaats',
		outsideKapellen: false,
		lat: KAPELLEN_LAT,
		lng: KAPELLEN_LNG,
		radius: 500,
		...overrides
	};
}

describe('circlePolygon', () => {
	it('closes the ring', () => {
		const ring = circlePolygon(KAPELLEN_LAT, KAPELLEN_LNG, 500);
		expect(ring[0]).toEqual(ring[ring.length - 1]);
	});

	it('puts every point at the requested distance', () => {
		// The reason this matters: a degree of longitude is shorter at 51 degrees north than
		// at the equator. Divide by cos(latitude) and the circle is round; forget to, and it
		// is an ellipse squashed by about 37% - which reads as a smaller doubt than there is.
		const ring = circlePolygon(KAPELLEN_LAT, KAPELLEN_LNG, 500);

		for (const [lng, lat] of ring) {
			const distance = metresApart(KAPELLEN_LAT, KAPELLEN_LNG, lat, lng);
			expect(distance).toBeGreaterThan(495);
			expect(distance).toBeLessThan(505);
		}
	});

	it('is round rather than an ellipse', () => {
		const ring = circlePolygon(KAPELLEN_LAT, KAPELLEN_LNG, 600);
		const distances = ring.map(([lng, lat]) => metresApart(KAPELLEN_LAT, KAPELLEN_LNG, lat, lng));
		const spread = Math.max(...distances) - Math.min(...distances);
		expect(spread).toBeLessThan(5);
	});

	it('scales with the radius', () => {
		const small = circlePolygon(KAPELLEN_LAT, KAPELLEN_LNG, 150);
		const large = circlePolygon(KAPELLEN_LAT, KAPELLEN_LNG, 850);
		const reach = (ring: [number, number][]) =>
			Math.max(...ring.map(([lng, lat]) => metresApart(KAPELLEN_LAT, KAPELLEN_LNG, lat, lng)));

		expect(reach(small)).toBeLessThan(160);
		expect(reach(large)).toBeGreaterThan(840);
	});
});

describe('isDrawable', () => {
	it('draws an ordinary point', () => {
		expect(isDrawable(place({ display: 'punt' }))).toBe(true);
	});

	it('never draws a place deliberately outside Kapellen', () => {
		// Kasteel Ravenhof is in Stabroek on purpose. Searchable, but not on this map, and
		// not to be "fixed" by nudging it inside the boundary.
		expect(isDrawable(place({ display: 'punt', outsideKapellen: true }))).toBe(false);
	});

	it('never draws a place that was not found', () => {
		expect(isDrawable(place({ display: 'niet_geplaatst', lat: undefined, lng: undefined }))).toBe(
			false
		);
	});

	it('draws candidates even when the feature itself has no point', () => {
		// Two of the five candidate places have no top-level geometry at all - the whole
		// point is that there is no single coordinate. Reading only the geometry would drop
		// them from the map silently.
		expect(
			isDrawable(
				place({
					display: 'kandidaten',
					lat: undefined,
					lng: undefined,
					candidates: [
						{ lat: 51.35, lng: 4.41, label: 'one' },
						{ lat: 51.32, lng: 4.41, label: 'two' }
					]
				})
			)
		).toBe(true);
	});

	it('does not draw a candidates row with no candidates', () => {
		expect(isDrawable(place({ display: 'kandidaten', lat: undefined, lng: undefined }))).toBe(
			false
		);
	});
});

describe('hasCircle', () => {
	it('is true only for an approximation', () => {
		expect(hasCircle(place({ display: 'benadering', radius: 500 }))).toBe(true);
		expect(hasCircle(place({ display: 'punt', radius: 25 }))).toBe(false);
	});

	it('is false for a doubted point, which gets the panel but no circle', () => {
		// Duitse Wijk is grade B with a real reservation. A 600 m circle would overstate it.
		expect(hasCircle(place({ display: 'punt_met_twijfel', radius: 600 }))).toBe(false);
	});
});

describe('circleCollection', () => {
	it('includes only the approximations', () => {
		const collection = circleCollection([
			place({ id: 'a', display: 'benadering', radius: 500 }),
			place({ id: 'b', display: 'punt', radius: 25 }),
			place({ id: 'c', display: 'punt_met_twijfel', radius: 600 })
		]);

		expect(collection.features).toHaveLength(1);
		expect(collection.features[0].properties.id).toBe('a');
	});
});

describe('correctionQueue', () => {
	it('puts the most photographs first', () => {
		const queue = correctionQueue({
			a: place({ id: 'a', name: 'A', priority: 28 }),
			b: place({ id: 'b', name: 'B', priority: 216 }),
			c: place({ id: 'c', name: 'C', correctable: false, priority: 999 })
		});

		expect(queue.map((entry) => entry.id)).toEqual(['b', 'a']);
	});
});

describe('the generated file', () => {
	const generated = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'static',
		'data',
		'place-approximations.json'
	);

	it('matches the research it was built from', () => {
		const file = JSON.parse(fs.readFileSync(generated, 'utf8')) as {
			places: Record<string, Approximation>;
		};
		const places = Object.values(file.places);

		expect(places).toHaveLength(82);

		const byDisplay = (display: string) =>
			places.filter((entry) => entry.display === display).length;

		expect(byDisplay('punt')).toBe(58);
		expect(byDisplay('punt_met_twijfel')).toBe(7);
		expect(byDisplay('benadering')).toBe(11);
		expect(byDisplay('kandidaten')).toBe(5);
		expect(byDisplay('niet_geplaatst')).toBe(1);

		expect(places.filter((entry) => entry.correctable)).toHaveLength(24);
	});

	it('gives every correctable place something to read', () => {
		const file = JSON.parse(fs.readFileSync(generated, 'utf8')) as {
			places: Record<string, Approximation>;
		};

		for (const entry of Object.values(file.places).filter((p) => p.correctable)) {
			expect(entry.doubt && entry.doubt.length > 0).toBe(true);
		}
	});

	it('gives every drawn approximation a radius to draw', () => {
		const file = JSON.parse(fs.readFileSync(generated, 'utf8')) as {
			places: Record<string, Approximation>;
		};

		for (const entry of Object.values(file.places).filter((p) => p.display === 'benadering')) {
			expect(entry.radius).toBeGreaterThan(0);
			expect(entry.lat).toBeDefined();
			expect(entry.lng).toBeDefined();
		}
	});
});
