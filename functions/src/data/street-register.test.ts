import * as fs from 'fs';
import * as path from 'path';

import {
	metresBetween,
	nearestWithPhotos,
	suggestRegisterStreets
} from '../../../sharedModels/street-register';
import type { NearbyPlace, RegisterStreet } from '../../../sharedModels/street-register';

/**
 * The streets with no photographs.
 *
 * The archive holds photographs of 45 streets and the official register knows 313, so for
 * most people typing their own street the register is the only thing that can answer at
 * all. What it answers with - where the street is, and which photographed streets are
 * nearest - is arithmetic, and arithmetic that is wrong by a factor is not obviously wrong
 * on a map: a list of "nearby" streets sorted by the wrong number still looks like a list.
 */

const KAPELLEN_CENTRE = { lat: 51.3125, lng: 4.4295 };

describe('metresBetween', () => {
	it('is zero for a point and itself', () => {
		expect(metresBetween(KAPELLEN_CENTRE, KAPELLEN_CENTRE)).toBe(0);
	});

	it('measures a degree of latitude at roughly 111 km', () => {
		const north = { lat: KAPELLEN_CENTRE.lat + 1, lng: KAPELLEN_CENTRE.lng };
		expect(metresBetween(KAPELLEN_CENTRE, north)).toBeGreaterThan(111_000);
		expect(metresBetween(KAPELLEN_CENTRE, north)).toBeLessThan(111_500);
	});

	it('shortens a degree of longitude by the cosine of the latitude', () => {
		// At 51.3 degrees north a degree of longitude is about 0.625 of one of latitude, so
		// treating the two as equal - which a naive Pythagoras on raw degrees does - would
		// overstate every east-west distance by 60%.
		const east = { lat: KAPELLEN_CENTRE.lat, lng: KAPELLEN_CENTRE.lng + 1 };
		expect(metresBetween(KAPELLEN_CENTRE, east)).toBeGreaterThan(69_000);
		expect(metresBetween(KAPELLEN_CENTRE, east)).toBeLessThan(70_000);
	});

	it('is symmetric', () => {
		const a = { lat: 51.3096, lng: 4.42425 };
		const b = { lat: 51.30636, lng: 4.43753 };
		expect(metresBetween(a, b)).toBe(metresBetween(b, a));
	});
});

describe('nearestWithPhotos', () => {
	const at = (name: string, lat: number, lng: number, count: number): NearbyPlace => ({
		id: name.toLowerCase(),
		name,
		count,
		lat,
		lng
	});

	it('sorts by distance and not by how many photographs a place has', () => {
		// The whole point of the page: somebody looking at their own street wants the street
		// round the corner, not the busiest street in the village - they already know where
		// the Dorpsstraat is.
		const nearest = nearestWithPhotos(KAPELLEN_CENTRE, [
			at('Ver', 51.34, 4.44, 400),
			at('Dichtbij', 51.3126, 4.4296, 2)
		]);

		expect(nearest.map((place) => place.name)).toEqual(['Dichtbij', 'Ver']);
	});

	it('leaves out places with no photographs', () => {
		const nearest = nearestWithPhotos(KAPELLEN_CENTRE, [
			at('Leeg', 51.3126, 4.4296, 0),
			at('Vol', 51.32, 4.43, 5)
		]);

		expect(nearest.map((place) => place.name)).toEqual(['Vol']);
	});

	it('carries the distance it sorted by, so the page can show it', () => {
		const [nearest] = nearestWithPhotos(KAPELLEN_CENTRE, [at('Vlakbij', 51.3134, 4.4295, 3)]);
		expect(nearest.metres).toBeGreaterThan(90);
		expect(nearest.metres).toBeLessThan(110);
	});

	it('stops at the limit', () => {
		const many = Array.from({ length: 20 }, (_, i) => at(`S${i}`, 51.31 + i / 1000, 4.43, 1));
		expect(nearestWithPhotos(KAPELLEN_CENTRE, many)).toHaveLength(5);
		expect(nearestWithPhotos(KAPELLEN_CENTRE, many, 2)).toHaveLength(2);
	});
});

describe('suggestRegisterStreets', () => {
	const streets: RegisterStreet[] = [
		{ slug: 'berkenlaan', name: 'Berkenlaan', lat: 51.31, lng: 4.43 },
		{ slug: 'oude-berkenlaan', name: 'Oude Berkenlaan', lat: 51.32, lng: 4.44 },
		{ slug: 'zilverenhoeklaan', name: 'Zilverenhoeklaan', lat: 51.30636, lng: 4.43753 }
	];

	it('finds a street by the start of its name', () => {
		expect(suggestRegisterStreets(streets, 'berken').map((s) => s.slug)).toEqual([
			'berkenlaan',
			'oude-berkenlaan'
		]);
	});

	it('prefers a name that starts with what was typed over one that merely contains it', () => {
		expect(suggestRegisterStreets(streets, 'berkenlaan')[0].slug).toBe('berkenlaan');
	});

	it('answers nothing to an empty query', () => {
		expect(suggestRegisterStreets(streets, '   ')).toEqual([]);
	});

	it('skips streets the archive already answered with', () => {
		const found = suggestRegisterStreets(streets, 'berken', new Set(['berkenlaan']));
		expect(found.map((s) => s.slug)).toEqual(['oude-berkenlaan']);
	});

	it('stops at the limit, so it cannot crowd out the places with photographs', () => {
		expect(suggestRegisterStreets(streets, 'laan', new Set(), 1)).toHaveLength(1);
		expect(suggestRegisterStreets(streets, 'laan', new Set(), 0)).toHaveLength(0);
	});
});

describe('the generated register', () => {
	const file = path.join(__dirname, '..', '..', '..', 'static', 'data', 'street-register.json');
	const register = JSON.parse(fs.readFileSync(file, 'utf8')) as {
		version: number;
		streets: RegisterStreet[];
	};
	const index = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'static', 'data', 'archive-index.json'),
			'utf8'
		)
	) as { places: { id: string; count: number }[] };

	it('holds the streets the site already promised', () => {
		// `/straten` has always described its index as running "van de Antwerpsesteenweg tot
		// de Zilverenhoeklaan" while the Zilverenhoeklaan had no page at all.
		expect(register.streets.some((street) => street.slug === 'zilverenhoeklaan')).toBe(true);
	});

	it('never holds a street the archive has photographs of', () => {
		// Both pages would exist, one of them without the photographs. `registerStreetView`
		// refuses those at runtime as well, but a register that carries them is already wrong.
		const photographed = new Set(
			index.places.filter((place) => place.count > 0).map((place) => place.id)
		);
		const overlap = register.streets.filter((street) => photographed.has(street.slug));

		expect(overlap.map((street) => street.slug)).toEqual([]);
	});

	it('gives every street a slug, a name and a coordinate inside Kapellen', () => {
		for (const street of register.streets) {
			expect(street.slug).toMatch(/^[a-z0-9-]+$/);
			expect(street.name.length).toBeGreaterThan(0);
			expect(street.lat).toBeGreaterThan(51.25);
			expect(street.lat).toBeLessThan(51.4);
			expect(street.lng).toBeGreaterThan(4.32);
			expect(street.lng).toBeLessThan(4.55);
		}
	});

	it('has no duplicate slugs', () => {
		const slugs = register.streets.map((street) => street.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
