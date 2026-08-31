import type { Approximation } from '../../../sharedModels/approximation';
import { hasCircle } from '../../../sharedModels/approximation';
import type { StreetGeometry } from '../../../sharedModels/locate';
import { locate } from '../../../sharedModels/locate';
import type { Line, OverlayRecord } from '../../../sharedModels/place-overlay';
import {
	PlaceOverlayError,
	centreOfLines,
	lengthOfLines,
	readCuratorApproximation,
	readCuratorGeometry,
	withApproximationRecords,
	withGeometryRecords
} from '../../../sharedModels/place-overlay';

/**
 * What a curator may say about where a place is.
 *
 * These readers are the door between a form and the map, and the map is the part of this
 * archive a reader trusts without being able to check. Every rejection below is a shape the
 * shipped data has actually been in at some point: a caption promising a circle with no
 * radius to draw it from, a point that is half a point, a "possible location" nobody
 * labelled.
 */

const KAPELLEN: [number, number] = [4.4295, 51.3125];

describe('readCuratorApproximation', () => {
	it('says nothing when there is nothing to say', () => {
		expect(readCuratorApproximation(undefined)).toBeUndefined();
		expect(readCuratorApproximation(null)).toBeUndefined();
	});

	it('reads a plain point', () => {
		const read = readCuratorApproximation({
			lat: 51.3125,
			lng: 4.4295,
			grade: 'A',
			display: 'punt'
		});

		expect(read).toEqual({ lat: 51.3125, lng: 4.4295, grade: 'A', display: 'punt' });
	});

	it('takes a point typed as text, because a form field hands back strings', () => {
		const read = readCuratorApproximation({
			lat: '51.3125',
			lng: '4.4295',
			grade: 'B',
			display: 'punt'
		});

		expect(read?.lat).toBe(51.3125);
		expect(read?.lng).toBe(4.4295);
	});

	it('refuses half a point', () => {
		// `locate` reads exactly these two fields and must never hand back a position that is
		// not one. It already returned `{lat: undefined, lng: undefined}` once, from a record
		// that named a radius and no point.
		expect(() => readCuratorApproximation({ lat: 51.3, grade: 'A', display: 'punt' })).toThrow(
			PlaceOverlayError
		);
	});

	it('refuses a point that is not near Kapellen', () => {
		expect(() => readCuratorApproximation({ lat: 0, lng: 0, grade: 'A', display: 'punt' })).toThrow(
			PlaceOverlayError
		);
	});

	it('refuses a circle with no radius to draw it from', () => {
		// The exact shape 74 shipped places were in: the caption said "bij benadering" because
		// it was written off `radius`, and the map drew no circle because `hasCircle` reads
		// `display` and `radius` together.
		expect(() =>
			readCuratorApproximation({ lat: 51.3, lng: 4.4, grade: 'C', display: 'benadering' })
		).toThrow(/straal/i);
	});

	it('refuses a radius wide enough to be meaningless', () => {
		expect(() =>
			readCuratorApproximation({
				lat: 51.3,
				lng: 4.4,
				grade: 'C',
				display: 'benadering',
				radius: 50_000
			})
		).toThrow(PlaceOverlayError);
	});

	it('drops a radius that no longer belongs to a circle', () => {
		// Switching away from `benadering` and back must not silently re-draw the old ring.
		const read = readCuratorApproximation({
			lat: 51.3,
			lng: 4.4,
			grade: 'B',
			display: 'punt',
			radius: 400
		});

		expect(read?.radius).toBeUndefined();
	});

	it('refuses a point-shaped display with no point', () => {
		expect(() => readCuratorApproximation({ grade: '?', display: 'punt_met_twijfel' })).toThrow(
			PlaceOverlayError
		);
	});

	it('lets a place be recorded as not placed at all', () => {
		const read = readCuratorApproximation({ grade: '?', display: 'niet_geplaatst' });

		expect(read).toEqual({ grade: '?', display: 'niet_geplaatst' });
	});

	it('refuses candidates that are not labelled', () => {
		// Two pins a reader cannot tell apart ask a question and give no means of answering it.
		expect(() =>
			readCuratorApproximation({
				grade: 'C',
				display: 'kandidaten',
				candidates: [{ lat: 51.3, lng: 4.4 }]
			})
		).toThrow(/berust/i);
	});

	it('refuses a candidates display with no candidates', () => {
		expect(() => readCuratorApproximation({ grade: 'C', display: 'kandidaten' })).toThrow(
			PlaceOverlayError
		);
	});

	it('keeps labelled candidates', () => {
		const read = readCuratorApproximation({
			grade: 'C',
			display: 'kandidaten',
			candidates: [
				{ lat: 51.3, lng: 4.4, label: 'Uit de kadasterkaart van 1892' },
				{ lat: 51.31, lng: 4.41, label: 'Uit het bijschrift' }
			]
		});

		expect(read?.candidates).toHaveLength(2);
	});

	it('refuses an unknown grade or display', () => {
		expect(() => readCuratorApproximation({ grade: 'Z', display: 'punt' })).toThrow(
			PlaceOverlayError
		);
		expect(() => readCuratorApproximation({ grade: 'A', display: 'sterretje' })).toThrow(
			PlaceOverlayError
		);
	});

	it('keeps the doubt in the researcher’s own words', () => {
		const read = readCuratorApproximation({
			lat: 51.3,
			lng: 4.4,
			grade: 'C',
			display: 'punt_met_twijfel',
			doubt: 'Het punt komt van de straatnaam, omdat "Bunder" in beide voorkomt.',
			correctable: true
		});

		expect(read?.doubt).toContain('Bunder');
		expect(read?.correctable).toBe(true);
	});
});

describe('readCuratorGeometry', () => {
	it('says nothing when nothing was drawn', () => {
		expect(readCuratorGeometry(undefined)).toBeUndefined();
		expect(readCuratorGeometry({ lines: [] })).toBeUndefined();
	});

	it('drops a stray click without losing the shape around it', () => {
		const read = readCuratorGeometry({
			lines: [
				[[4.42, 51.31]],
				[
					[4.42, 51.31],
					[4.43, 51.32]
				]
			]
		});

		expect(read?.lines).toEqual([
			[
				[4.42, 51.31],
				[4.43, 51.32]
			]
		]);
	});

	it('refuses a point that is not near Kapellen', () => {
		expect(() =>
			readCuratorGeometry({
				lines: [
					[
						[4.42, 51.31],
						[0, 0]
					]
				]
			})
		).toThrow(PlaceOverlayError);
	});

	it('keeps a closed ring, which is how an estate boundary is drawn', () => {
		const ring: Line = [
			[4.42, 51.31],
			[4.43, 51.31],
			[4.43, 51.32],
			[4.42, 51.31]
		];

		expect(readCuratorGeometry({ lines: [ring] })?.lines[0]).toHaveLength(4);
	});
});

describe('centreOfLines', () => {
	it('has nothing to say about nothing', () => {
		expect(centreOfLines([])).toBeNull();
	});

	it('puts the centre halfway along by distance, not at the average of the clicks', () => {
		// Twenty clicks around one bend and two down a straight: the average is dragged into
		// the bend, and halfway by distance is where a reader would put their finger.
		const line: Line = [
			[4.4, 51.3],
			[4.401, 51.3],
			[4.402, 51.3],
			[4.403, 51.3],
			[4.5, 51.3]
		];

		const centre = centreOfLines([line]);
		expect(centre).not.toBeNull();
		expect(centre!.lng).toBeGreaterThan(4.44);
		expect(centre!.lng).toBeLessThan(4.46);
	});

	it('reads the longest line when several were drawn', () => {
		const short: Line = [
			[4.4, 51.3],
			[4.401, 51.3]
		];
		const long: Line = [
			[4.5, 51.35],
			[4.6, 51.35]
		];

		expect(centreOfLines([short, long])!.lat).toBeCloseTo(51.35, 4);
	});

	it('measures a line in metres', () => {
		// One hundredth of a degree of latitude is about 1.1 km.
		expect(
			lengthOfLines([
				[
					[4.43, 51.31],
					[4.43, 51.32]
				]
			])
		).toBeGreaterThan(1050);
		expect(
			lengthOfLines([
				[
					[4.43, 51.31],
					[4.43, 51.32]
				]
			])
		).toBeLessThan(1160);
	});
});

function shipped(overrides: Partial<Approximation> = {}): Approximation {
	return {
		id: 'kasteel-test',
		name: 'Kasteel Test',
		grade: 'C',
		display: 'benadering',
		note: 'Uit het onderzoek.',
		correctable: true,
		priority: 42,
		kind: 'plaats',
		outsideKapellen: false,
		lat: 51.32,
		lng: 4.46,
		radius: 300,
		...overrides
	};
}

describe('withApproximationRecords', () => {
	it('keeps what the build knows and a person does not decide', () => {
		const merged = withApproximationRecords(
			{ 'kasteel-test': shipped({ aliasOf: 'iets-anders' }) },
			{
				'kasteel-test': {
					id: 'kasteel-test',
					name: 'Kasteel Test',
					approximation: { lat: 51.33, lng: 4.47, grade: 'A', display: 'punt' }
				}
			}
		);

		// The photograph count behind `priority` is recounted every build; an edit to a radius
		// must not silently reset it, because nothing on the page would show that it had.
		expect(merged['kasteel-test'].priority).toBe(42);
		expect(merged['kasteel-test'].kind).toBe('plaats');
		expect(merged['kasteel-test'].aliasOf).toBe('iets-anders');
		expect(merged['kasteel-test'].lat).toBe(51.33);
		expect(merged['kasteel-test'].display).toBe('punt');
	});

	it('drops the old circle when the curator says it is a point', () => {
		const merged = withApproximationRecords(
			{ 'kasteel-test': shipped() },
			{
				'kasteel-test': {
					id: 'kasteel-test',
					name: 'Kasteel Test',
					approximation: { lat: 51.33, lng: 4.47, grade: 'A', display: 'punt' }
				}
			}
		);

		expect(hasCircle(merged['kasteel-test'])).toBe(false);
		expect(merged['kasteel-test'].radius).toBeUndefined();
	});

	it('adds a place the research has never heard of', () => {
		const merged = withApproximationRecords(
			{},
			{
				'kasteel-appel': {
					id: 'kasteel-appel',
					name: 'Kasteel Appel',
					approximation: { lat: 51.33, lng: 4.47, grade: 'B', display: 'punt' }
				}
			}
		);

		expect(merged['kasteel-appel'].name).toBe('Kasteel Appel');
		expect(merged['kasteel-appel'].priority).toBe(0);
	});

	it('leaves a record alone that says nothing about where it is', () => {
		const records: Record<string, OverlayRecord> = {
			'kasteel-test': { id: 'kasteel-test', name: 'Andere naam' }
		};

		expect(withApproximationRecords({ 'kasteel-test': shipped() }, records)).toEqual({
			'kasteel-test': shipped()
		});
	});

	it('leaves a place the register positions alone when the record is silent', () => {
		// The defect this guards. A record is stored whole, so the desk sent its position
		// fields whatever the curator came to do - and they default to "not placed". Renaming
		// the Dorpsstraat wrote `niet_geplaatst` over a street the register positions
		// perfectly, `isDrawable` dropped it from every map, and nothing showed that it had.
		const merged = withApproximationRecords(
			{},
			{ dorpsstraat: { id: 'dorpsstraat', name: 'Dorpsstraat' } }
		);

		expect(merged.dorpsstraat).toBeUndefined();

		const geometry: Record<string, StreetGeometry> = {
			dorpsstraat: {
				name: 'Dorpsstraat',
				municipality: 'Kapellen',
				lat: 51.31,
				lng: 4.43,
				lines: []
			}
		};

		expect(locate('dorpsstraat', {}, geometry, merged)).toEqual({
			lat: 51.31,
			lng: 4.43,
			source: 'register'
		});
	});

	it('keeps the marker inside its own circle', () => {
		// The invariant the castle broke: wherever a circle is drawn, `locate` has to put the
		// marker at its centre. A curator-drawn circle is subject to it like any other.
		const approximations = withApproximationRecords(
			{},
			{
				'kasteel-test': {
					id: 'kasteel-test',
					name: 'Kasteel Test',
					approximation: {
						lat: 51.32129,
						lng: 4.46651,
						grade: 'C',
						display: 'benadering',
						radius: 150
					}
				}
			}
		);

		const geometry: Record<string, StreetGeometry> = {
			'kasteel-test': {
				name: 'Oude Gracht',
				municipality: 'Kapellen',
				lat: 51.32646,
				lng: 4.47368,
				lines: []
			}
		};

		expect(locate('kasteel-test', {}, geometry, approximations)).toEqual({
			lat: 51.32129,
			lng: 4.46651,
			source: 'onderzoek'
		});
	});
});

describe('withGeometryRecords', () => {
	const register: Record<string, StreetGeometry> = {
		dorpsstraat: {
			name: 'Dorpsstraat',
			municipality: 'Kapellen',
			lat: 51.31,
			lng: 4.43,
			lines: [[KAPELLEN, [4.44, 51.32]]],
			length: 1200
		}
	};

	it('leaves the register alone when nothing was drawn', () => {
		expect(withGeometryRecords(register, {})).toEqual(register);
	});

	it('replaces the register line rather than drawing both', () => {
		const drawn: Line = [
			[4.5, 51.35],
			[4.51, 51.35]
		];

		const merged = withGeometryRecords(register, {
			dorpsstraat: { id: 'dorpsstraat', name: 'Dorpsstraat', geometry: { lines: [drawn] } }
		});

		expect(merged.dorpsstraat.lines).toEqual([drawn]);
		expect(merged.dorpsstraat.lat).toBeCloseTo(51.35, 4);
		expect(merged.dorpsstraat.municipality).toBe('Kapellen');
	});

	it('gives a drawn shape a point the map can open on', () => {
		const merged = withGeometryRecords(
			{},
			{
				'kasteel-appel': {
					id: 'kasteel-appel',
					name: 'Kasteel Appel',
					geometry: {
						lines: [
							[
								[4.46, 51.32],
								[4.47, 51.32]
							]
						]
					}
				}
			}
		);

		expect(merged['kasteel-appel'].lng).toBeCloseTo(4.465, 4);
		expect(merged['kasteel-appel'].length).toBeGreaterThan(600);
	});
});
