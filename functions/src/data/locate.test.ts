import * as fs from 'fs';
import * as path from 'path';

import type { Approximation } from '../../../sharedModels/approximation';
import type { PlacedCoordinate, StreetGeometry } from '../../../sharedModels/locate';
import { locate } from '../../../sharedModels/locate';

/**
 * Which of the three answers about a place wins.
 *
 * Every pin on every map comes out of `locate`, and until now it had no test, because it
 * lived in `src/lib/` where this suite cannot reach it. What that cost is on the record:
 * "Kasteel Oude Gracht" carries the alias "Oude Gracht", which is also a 2.3 km road in the
 * street register, so the register tier answered first and the castle was drawn at the
 * road's midpoint - 761 m from where the archive's own 1892 map puts it, and 761 m from its
 * own circle of doubt, which is drawn from the research rather than from `locate`. The map
 * asserted both at once: the castle is here, and it is somewhere in that ring over there.
 *
 * Nobody caught it in code review. It was caught by a reader looking at the castles page.
 */

const KAPELLEN_LAT = 51.3125;
const KAPELLEN_LNG = 4.4295;

function research(overrides: Partial<Approximation> = {}): Approximation {
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

function street(lat: number, lng: number): StreetGeometry {
	return { name: 'Test', municipality: 'Kapellen', lat, lng, lines: [] };
}

const pin = (lat: number, lng: number): PlacedCoordinate => ({ lat, lng });

describe('locate', () => {
	it('has nothing to say about a place nobody has placed', () => {
		expect(locate('test', {}, {}, {})).toBeNull();
	});

	it('prefers a curator over everything else', () => {
		const at = locate(
			'test',
			{ test: pin(51.4, 4.4) },
			{ test: street(51.3, 4.3) },
			{ test: research() }
		);

		expect(at).toEqual({ lat: 51.4, lng: 4.4, source: 'placed' });
	});

	it('prefers the register to research that names no radius', () => {
		// The register is authoritative about where a street runs, and a doubted point with
		// no radius makes no claim precise enough to contradict it.
		const at = locate(
			'test',
			{},
			{ test: street(51.3, 4.3) },
			{ test: research({ display: 'punt_met_twijfel', radius: undefined }) }
		);

		expect(at).toEqual({ lat: 51.3, lng: 4.3, source: 'register' });
	});

	it('prefers research that carries a circle to the register', () => {
		// The case that was wrong. A name match is not knowledge about the thing that bears
		// the name: the register knew a road called Oude Gracht, not the castle.
		const at = locate(
			'test',
			{},
			{ test: street(51.32646, 4.47368) },
			{ test: research({ lat: 51.32129, lng: 4.46651, radius: 150 }) }
		);

		expect(at).toEqual({ lat: 51.32129, lng: 4.46651, source: 'onderzoek' });
	});

	it('still lets a curator overrule a circle', () => {
		const at = locate('test', { test: pin(51.4, 4.4) }, {}, { test: research({ radius: 150 }) });

		expect(at).toEqual({ lat: 51.4, lng: 4.4, source: 'placed' });
	});

	it('falls back to the register when the research has no point at all', () => {
		// `benadering` with no coordinate is not a circle, so it must not swallow the answer
		// the register does have.
		const at = locate(
			'test',
			{},
			{ test: street(51.3, 4.3) },
			{ test: research({ lat: undefined, lng: undefined }) }
		);

		expect(at).toEqual({ lat: 51.3, lng: 4.3, source: 'register' });
	});

	it('uses the research when it is the only answer', () => {
		const at = locate('test', {}, {}, { test: research({ display: 'punt', radius: undefined }) });

		expect(at).toEqual({ lat: KAPELLEN_LAT, lng: KAPELLEN_LNG, source: 'onderzoek' });
	});
});

describe('the shipped data', () => {
	const read = <T>(...file: string[]): T =>
		JSON.parse(
			fs.readFileSync(path.join(__dirname, '..', '..', '..', 'static', 'data', ...file), 'utf8')
		) as T;

	it('puts every circle of doubt around the marker it belongs to', () => {
		// The invariant, asserted against the files the site actually ships rather than
		// against a fixture: wherever a circle is drawn, `locate` has to put the marker at its
		// centre. This is the check that would have caught the castle.
		const approximations = read<{ places: Record<string, Approximation> }>(
			'place-approximations.json'
		).places;
		const geometry = read<{ streets: Record<string, StreetGeometry> }>(
			'street-geometry.json'
		).streets;
		const placed = read<{ places?: Record<string, PlacedCoordinate> }>(
			'place-coordinates.json'
		).places;

		const offCentre: string[] = [];
		for (const [id, entry] of Object.entries(approximations)) {
			if (entry.display !== 'benadering' || !(entry.radius ?? 0)) continue;

			// A curator's pin replaces the research outright, circle and all, so a place they
			// placed by hand is not one this invariant is about.
			if (placed?.[id]) continue;

			const at = locate(id, placed ?? {}, geometry, approximations);
			if (at?.lat !== entry.lat || at?.lng !== entry.lng) offCentre.push(id);
		}

		expect(offCentre).toEqual([]);
	});

	it('keeps the castle off the road that shares its name', () => {
		// The specific record, so the fix cannot be undone by a data change either. The point
		// is the one the 1892 map in the archive's own "Kaarten en Luchtfoto's" gives, not the
		// midpoint of the 2.3 km road the alias matched.
		const approximations = read<{ places: Record<string, Approximation> }>(
			'place-approximations.json'
		).places;
		const geometry = read<{ streets: Record<string, StreetGeometry> }>(
			'street-geometry.json'
		).streets;

		const castle = approximations['kasteel-oude-gracht'];
		expect(castle).toBeDefined();

		// The collision itself is still in the data and is expected to be: the register really
		// does hold a road of that name. What must not come back is the castle being drawn on
		// it.
		expect(geometry['kasteel-oude-gracht']).toBeDefined();

		const at = locate('kasteel-oude-gracht', {}, geometry, approximations);
		expect(at).toEqual({ lat: castle.lat, lng: castle.lng, source: 'onderzoek' });
	});
});
