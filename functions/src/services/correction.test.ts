import type { Approximation } from '../../../sharedModels/approximation';
import type { PlaceCorrection } from '../../../sharedModels/correction';
import {
	applyCorrection,
	canDecide,
	CorrectionError,
	readCorrection,
	snapshot
} from '../../../sharedModels/correction';

/**
 * The rule these tests exist to hold: a point never moves on its own. If the grade, the
 * radius, the display mode or the doubt text survives a correction, the map keeps drawing a
 * red circle of doubt around a location somebody has actually confirmed - and the next
 * reader cannot tell which half of the record is still true.
 */

function approximation(overrides: Partial<Approximation> = {}): Approximation {
	return {
		id: 'kasteel-beaulieu',
		name: 'Kasteel Beaulieu',
		lat: 51.32,
		lng: 4.42,
		grade: 'C',
		display: 'benadering',
		radius: 600,
		note: 'Afgeleid uit een omschrijving.',
		doubt: 'Het punt komt van de straatnaam, niet van een adres.',
		correctable: true,
		priority: 28,
		kind: 'plaats',
		outsideKapellen: false,
		...overrides
	};
}

function correction(overrides: Partial<PlaceCorrection> = {}): PlaceCorrection {
	return {
		id: 'c1',
		placeId: 'kasteel-beaulieu',
		placeName: 'Kasteel Beaulieu',
		kind: 'coordinate',
		status: 'pending',
		lat: 51.3168,
		lng: 4.4235,
		message: 'Het clubhuis van de korfbalclub staat op de plek van het kasteel.',
		contributor: { name: 'Daniel' },
		previous: { grade: 'C', display: 'benadering' },
		submittedAt: '2026-08-29T00:00:00.000Z',
		...overrides
	};
}

describe('readCorrection', () => {
	it('accepts a coordinate', () => {
		const read = readCorrection({
			kind: 'coordinate',
			lat: 51.3168,
			lng: 4.4235,
			message: '  Naast   de kerk  '
		});

		expect(read.lat).toBeCloseTo(51.3168);
		expect(read.message).toBe('Naast de kerk');
	});

	it('refuses a coordinate correction with no coordinate', () => {
		// This is the one that must never get through: it would be stored looking like a
		// correction, approved by a reviewer, and move nothing at all.
		expect(() => readCorrection({ kind: 'coordinate', message: 'daar' })).toThrow(CorrectionError);
	});

	it('refuses coordinates that cannot exist', () => {
		expect(() => readCorrection({ kind: 'coordinate', lat: 991, lng: 4.4 })).toThrow(
			CorrectionError
		);
	});

	it('refuses an unknown kind', () => {
		expect(() => readCorrection({ kind: 'delete-everything' })).toThrow(CorrectionError);
	});

	it('requires a sentence when there is no coordinate to give', () => {
		expect(() => readCorrection({ kind: 'not-a-place', message: '  ' })).toThrow(CorrectionError);
		expect(() => readCorrection({ kind: 'still-unknown' })).toThrow(CorrectionError);
	});

	it('requires a chosen candidate', () => {
		expect(() => readCorrection({ kind: 'candidate', lat: 51.3, lng: 4.4 })).toThrow(
			CorrectionError
		);
	});
});

describe('snapshot', () => {
	it('records what the map was saying at the time', () => {
		expect(snapshot(approximation())).toEqual({
			grade: 'C',
			display: 'benadering',
			lat: 51.32,
			lng: 4.42,
			radius: 600,
			doubt: 'Het punt komt van de straatnaam, niet van een adres.'
		});
	});
});

describe('applyCorrection', () => {
	it('moves the grade, the radius and the doubt along with the point', () => {
		const after = applyCorrection(approximation(), correction(), '2026-08-29');

		expect(after.lat).toBeCloseTo(51.3168);
		expect(after.grade).toBe('A');
		expect(after.display).toBe('punt');
		expect(after.radius).toBe(25);
		expect(after.doubt).toBeUndefined();
		expect(after.correctable).toBe(false);
	});

	it('leaves no red circle behind a confirmed point', () => {
		const after = applyCorrection(approximation(), correction(), '2026-08-29');
		// The whole failure mode in one assertion: a point somebody confirmed, still drawn
		// inside a 600 m circle of doubt.
		expect(after.display).not.toBe('benadering');
		expect(after.radius).toBeLessThan(600);
	});

	it('records who said so and when', () => {
		const after = applyCorrection(approximation(), correction(), '2026-08-29');
		expect(after.note).toContain('Daniel');
		expect(after.note).toContain('2026-08-29');
		expect(after.note).toContain('korfbalclub');
	});

	it('credits an anonymous corrector without inventing a name', () => {
		const after = applyCorrection(approximation(), correction({ contributor: {} }), '2026-08-29');
		expect(after.note).toContain('iemand uit Kapellen');
	});

	it('drops the other candidates once one is chosen', () => {
		const before = approximation({
			display: 'kandidaten',
			candidates: [
				{ lat: 51.33, lng: 4.41, label: 'Kapelsestraat 246' },
				{ lat: 51.35, lng: 4.41, label: 'Middelbeeklaan, Putte' }
			]
		});

		const after = applyCorrection(
			before,
			correction({ kind: 'candidate', candidateLabel: 'Middelbeeklaan, Putte' }),
			'2026-08-29'
		);

		expect(after.candidates).toBeUndefined();
		expect(after.display).toBe('punt');
		expect(after.note).toContain('Middelbeeklaan, Putte');
	});

	it('stops claiming a coordinate when told it is not a place', () => {
		// Tajje de Kotter was a man. The 58 photographs are of a parade through the whole
		// municipality, so no pin can be right and the record must stop implying one.
		const after = applyCorrection(
			approximation({ id: 'tajje', name: 'Tajje', priority: 58 }),
			correction({ kind: 'not-a-place', message: 'Tajje was een persoon, geen plaats.' }),
			'2026-08-29'
		);

		expect(after.lat).toBeUndefined();
		expect(after.lng).toBeUndefined();
		expect(after.display).toBe('niet_geplaatst');
		expect(after.kind).toBe('geen_plaats');
		expect(after.correctable).toBe(false);
	});

	it('keeps a place correctable when the answer is still unknown', () => {
		const after = applyCorrection(
			approximation(),
			correction({ kind: 'still-unknown', message: 'Geen van beide, ik weet het niet.' }),
			'2026-08-29'
		);

		expect(after.display).toBe('niet_geplaatst');
		expect(after.correctable).toBe(true);
		// The old doubt is kept and the new report added, because two wrong answers ruled
		// out is progress worth keeping.
		expect(after.doubt).toContain('straatnaam');
		expect(after.doubt).toContain('Geen van beide');
	});
});

describe('canDecide', () => {
	it('allows revisiting a decision but not repeating it', () => {
		expect(canDecide('pending', 'accepted')).toBe(true);
		expect(canDecide('rejected', 'accepted')).toBe(true);
		expect(canDecide('accepted', 'accepted')).toBe(false);
	});
});
