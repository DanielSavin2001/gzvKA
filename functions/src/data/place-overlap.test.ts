import type { OverlapPhoto, OverlapPlace } from '../../../sharedModels/place-overlap';
import {
	overlappingPlaces,
	photosByPlace,
	sameplaceOverlaps
} from '../../../sharedModels/place-overlap';

/**
 * The distinction these tests exist to hold: a nesting is not a duplicate.
 *
 * Every photograph of Kasteel Haezeldonck is also a photograph in Hoogboom, and that is
 * correct - the castle stands in the district. Ertbrand and Fort van Ertbrand look the same
 * on a containment measure and are not the same thing at all: remove the fort's
 * photographs from the district and seven are left, so the two entries are one place under
 * two names. A detector that cannot tell those apart reports 28 pairs, 23 of which are
 * fine, and gets ignored.
 */

function photo(id: string, ...places: string[]): OverlapPhoto {
	return { id, st: places };
}

const NAMES: OverlapPlace[] = [
	{ id: 'ertbrand', name: 'Ertbrand' },
	{ id: 'fort-van-ertbrand', name: 'Fort van Ertbrand' },
	{ id: 'hoogboom', name: 'Hoogboom' },
	{ id: 'kasteel-haezeldonck', name: 'Kasteel Haezeldonck' }
];

/** Ertbrand: 10 photographs, 8 of which are the fort's. */
function ertbrand(): OverlapPhoto[] {
	const shared = Array.from({ length: 8 }, (_, index) =>
		photo(`fort-${index}`, 'fort-van-ertbrand', 'ertbrand')
	);
	return [...shared, photo('molen-1', 'ertbrand'), photo('molen-2', 'ertbrand')];
}

/** Hoogboom: 40 photographs, 4 of which are of a castle standing in it. */
function hoogboom(): OverlapPhoto[] {
	const castle = Array.from({ length: 4 }, (_, index) =>
		photo(`kasteel-${index}`, 'kasteel-haezeldonck', 'hoogboom')
	);
	const rest = Array.from({ length: 36 }, (_, index) => photo(`hoogboom-${index}`, 'hoogboom'));
	return [...castle, ...rest];
}

describe('photosByPlace', () => {
	it('files a photograph under every place it names', () => {
		const byPlace = photosByPlace([photo('a', 'ertbrand', 'fort-van-ertbrand')]);

		expect(byPlace.get('ertbrand')).toEqual(new Set(['a']));
		expect(byPlace.get('fort-van-ertbrand')).toEqual(new Set(['a']));
	});

	it('survives a photograph filed nowhere', () => {
		expect(photosByPlace([{ id: 'a' } as OverlapPhoto]).size).toBe(0);
	});
});

describe('overlappingPlaces', () => {
	it('calls two names for one place what they are', () => {
		const [found] = overlappingPlaces(ertbrand(), NAMES);

		expect(found.kind).toBe('zelfde');
		expect(found.a.id).toBe('ertbrand');
		expect(found.b.id).toBe('fort-van-ertbrand');
		expect(found.shared).toBe(8);
		// Every one of the fort's photographs is in the district ...
		expect(found.containment).toBe(1);
		// ... and taking them out leaves two, so the two entries are nearly one set.
		expect(found.overlap).toBeCloseTo(0.8, 5);
	});

	it('does not call a castle standing in a district a duplicate', () => {
		const [found] = overlappingPlaces(hoogboom(), NAMES);

		expect(found.kind).toBe('binnen');
		expect(found.containment).toBe(1);
		// The district is ten times the castle. Nobody is confused by two bubbles here.
		expect(found.overlap).toBeCloseTo(0.1, 5);
	});

	it('puts the larger side first, however the photographs arrive', () => {
		const found = overlappingPlaces(ertbrand().reverse(), NAMES);

		expect(found[0].a.count).toBeGreaterThanOrEqual(found[0].b.count);
	});

	it('leaves out places too small to say anything about', () => {
		// One photograph filed under two places is inside both, at 100%, always. Reporting
		// that would bury the real pairs under arithmetic.
		const found = overlappingPlaces([photo('a', 'ertbrand', 'fort-van-ertbrand')], NAMES);

		expect(found).toEqual([]);
	});

	it('ignores places that merely share a few photographs', () => {
		const photos = [
			photo('a', 'ertbrand', 'hoogboom'),
			photo('b', 'ertbrand'),
			photo('c', 'ertbrand'),
			photo('d', 'hoogboom'),
			photo('e', 'hoogboom'),
			photo('f', 'hoogboom')
		];

		expect(overlappingPlaces(photos, NAMES)).toEqual([]);
	});

	it('reports the worst pair first', () => {
		const found = overlappingPlaces([...hoogboom(), ...ertbrand()], NAMES);

		expect(found[0].kind).toBe('zelfde');
		expect(found.map((entry) => entry.kind)).toEqual(['zelfde', 'binnen']);
	});

	it('falls back to the id when a place has no name', () => {
		const [found] = overlappingPlaces(ertbrand(), []);

		expect(found.a.name).toBe('ertbrand');
	});

	it('lets a caller ask only for the pairs that need deciding', () => {
		const found = sameplaceOverlaps(overlappingPlaces([...hoogboom(), ...ertbrand()], NAMES));

		expect(found).toHaveLength(1);
		expect(found[0].b.id).toBe('fort-van-ertbrand');
	});
});
