import { isLabelled, sparseLabels } from '../../../sharedModels/sparse-labels';

/**
 * The rules these hold: a label is either readable or absent, never clipped; two labels
 * never land close enough to overlap; and both ends of the axis are always named.
 *
 * The bug this replaced rendered all thirteen decade labels through `truncate`, so every
 * one of them read "19...". Nothing said so - the strip looked deliberate.
 *
 * The stride of two is measured rather than guessed: at 320px, the tightest real case, the
 * column pitch is 22.5px and the widest label ("<1900") is 40.6px against a neighbouring
 * "1910" of 30.5px, so two columns apart leaves 45px of centre-to-centre for a pair that
 * needs 35.6. A first attempt used four and produced three labels across a century, which
 * is too few to count from.
 */

describe('sparseLabels', () => {
	it('labels everything when everything fits', () => {
		// Five columns on a narrow phone is about 56px each; a four-digit year fits.
		expect(sparseLabels(5)).toEqual([0, 1, 2, 3, 4]);
	});

	it('keeps every other decade once the row is crowded', () => {
		// The real case: thirteen decades, `voor-1900` through `2010`. Seven labels -
		// <1900, 1910, 1930, 1950, 1970, 1990, 2010 - and a reader can count from any of them.
		expect(sparseLabels(13)).toEqual([0, 2, 4, 6, 8, 10, 12]);
	});

	it('names the last tick even when it does not land on the stride', () => {
		// Fourteen decades is one 2020s photograph away. 12 would be the last on-stride
		// index, and 13 is one past it - too close - so 12 gives way rather than collide.
		expect(sparseLabels(14)).toEqual([0, 2, 4, 6, 8, 10, 13]);
	});

	it('keeps both ends whatever the length', () => {
		for (let total = 1; total <= 60; total += 1) {
			const chosen = sparseLabels(total);
			expect(chosen[0]).toBe(0);
			expect(chosen[chosen.length - 1]).toBe(total - 1);
		}
	});

	it('never returns two labels closer than the stride', () => {
		for (let total = 6; total <= 60; total += 1) {
			const chosen = sparseLabels(total);
			for (let i = 1; i < chosen.length; i += 1) {
				expect(chosen[i] - chosen[i - 1]).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it('never returns an index outside the row, or a duplicate', () => {
		for (let total = 1; total <= 60; total += 1) {
			const chosen = sparseLabels(total);
			expect(new Set(chosen).size).toBe(chosen.length);
			for (const index of chosen) {
				expect(index).toBeGreaterThanOrEqual(0);
				expect(index).toBeLessThan(total);
			}
		}
	});

	it('gives back roughly half the ticks, not a handful', () => {
		// The regression that prompted this: three labels across thirteen decades.
		expect(sparseLabels(13).length).toBeGreaterThanOrEqual(6);
		expect(sparseLabels(21).length).toBeGreaterThanOrEqual(10);
	});

	it('takes a wider stride when a caller has less room', () => {
		expect(sparseLabels(13, { stride: 4 })).toEqual([0, 4, 8, 12]);
	});

	it('survives an empty timeline', () => {
		expect(sparseLabels(0)).toEqual([]);
	});

	it('answers for a single index too', () => {
		expect(isLabelled(0, 13)).toBe(true);
		expect(isLabelled(1, 13)).toBe(false);
		expect(isLabelled(2, 13)).toBe(true);
		expect(isLabelled(12, 13)).toBe(true);
	});
});
