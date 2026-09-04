import { isLabelled, sparseLabels } from '../../../sharedModels/sparse-labels';

/**
 * The rule these hold: a label is either readable or absent, never clipped, and two
 * labels never land close enough to overlap.
 *
 * The bug this replaced rendered all thirteen decade labels through `truncate`, so every
 * one of them read "19...". Nothing said so - the strip looked deliberate.
 */

describe('sparseLabels', () => {
	it('labels everything when everything fits', () => {
		// Five columns on a narrow phone is about 56px each; a four-digit year fits.
		expect(sparseLabels(5)).toEqual([0, 1, 2, 3, 4]);
	});

	it('thins to the ends and the middle once the row is crowded', () => {
		// The real case: thirteen decades, `voor-1900` through `2010`.
		expect(sparseLabels(13)).toEqual([0, 6, 12]);
	});

	it('drops the middle rather than let it collide with an end', () => {
		// Six columns: the middle sits two from the front, so it would overlap. Ends only.
		expect(sparseLabels(6)).toEqual([0, 5]);
	});

	it('keeps the ends even when there is only just room for them', () => {
		expect(sparseLabels(9)).toEqual([0, 4, 8]);
	});

	it('never returns an index outside the row', () => {
		for (let total = 1; total <= 40; total += 1) {
			for (const index of sparseLabels(total)) {
				expect(index).toBeGreaterThanOrEqual(0);
				expect(index).toBeLessThan(total);
			}
		}
	});

	it('never returns two labels closer than the gap', () => {
		for (let total = 6; total <= 40; total += 1) {
			const chosen = sparseLabels(total);
			for (let i = 1; i < chosen.length; i += 1) {
				expect(chosen[i] - chosen[i - 1]).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it('always labels both ends, so the axis is anchored at all', () => {
		for (let total = 1; total <= 40; total += 1) {
			const chosen = sparseLabels(total);
			expect(chosen[0]).toBe(0);
			expect(chosen[chosen.length - 1]).toBe(total - 1);
		}
	});

	it('survives an empty timeline', () => {
		expect(sparseLabels(0)).toEqual([]);
	});

	it('answers for a single index too', () => {
		expect(isLabelled(0, 13)).toBe(true);
		expect(isLabelled(6, 13)).toBe(true);
		expect(isLabelled(7, 13)).toBe(false);
		expect(isLabelled(12, 13)).toBe(true);
	});
});
