import type { Bubble } from '../../../sharedModels/declutter';
import { applyShifts, declutter, overlapCount } from '../../../sharedModels/declutter';

/**
 * The point of these is that the arrangement is measured, not eyeballed. "Looks less
 * cluttered" is not a property; "37 overlapping pairs became 0, and nothing moved further
 * than the budget from where it really is" is.
 */

/** Shifts are rounded to a tenth of a pixel, so a clamped value can land just above. */
const ROUNDING = 0.15;

/** The module's own budget, so these move with it rather than pinning an old number. */
const BUDGET = 44;

function bubble(id: string, x: number, y: number, r = 20): Bubble {
	return { id, x, y, r };
}

/** The shift actually applied to each marker, in pixels. */
function distances(before: Bubble[], shifts: Map<string, { dx: number; dy: number }>): number[] {
	return before.map((b) => {
		const shift = shifts.get(b.id);
		return shift ? Math.hypot(shift.dx, shift.dy) : 0;
	});
}

describe('declutter', () => {
	it('leaves markers that already have room alone', () => {
		const bubbles = [bubble('a', 0, 0), bubble('b', 200, 0), bubble('c', 0, 200)];
		expect(declutter(bubbles).size).toBe(0);
	});

	it('separates two markers that overlap', () => {
		const bubbles = [bubble('a', 100, 100), bubble('b', 115, 100)];
		const after = applyShifts(bubbles, declutter(bubbles));

		expect(overlapCount(after)).toBe(0);
	});

	it('unpicks a real knot as far as the budget allows', () => {
		// Eight places within 40 px of each other, which is roughly what the Dorpsstraat
		// corner looks like at the zoom the map opens at.
		//
		// Eight bubbles of radius 18 need to sit 39 px apart, which takes a patch about
		// 110 px across - further from the centre than the budget allows. So this
		// asserts what the design actually promises: most of the knot comes apart, and no
		// marker is flung away from the place it describes to achieve it.
		const bubbles = Array.from({ length: 8 }, (_, i) =>
			bubble(`p${i}`, 100 + (i % 3) * 12, 100 + Math.floor(i / 3) * 12, 18)
		);

		const before = overlapCount(bubbles);
		expect(before).toBeGreaterThan(20);

		const shifts = declutter(bubbles);
		const after = overlapCount(applyShifts(bubbles, shifts));

		expect(after).toBeLessThan(before / 3);
		for (const distance of distances(bubbles, shifts)) {
			expect(distance).toBeLessThanOrEqual(BUDGET + ROUNDING);
		}
	});

	it('unpicks it completely when the budget is big enough', () => {
		const bubbles = Array.from({ length: 8 }, (_, i) =>
			bubble(`p${i}`, 100 + (i % 3) * 12, 100 + Math.floor(i / 3) * 12, 18)
		);

		const after = applyShifts(bubbles, declutter(bubbles, { maxShift: 400 }));
		expect(overlapCount(after)).toBe(0);
	});

	it('never moves a marker further than the budget', () => {
		// The honesty rule: a bubble dragged far enough stops describing where the place is.
		const bubbles = Array.from({ length: 25 }, (_, i) => bubble(`p${i}`, 300, 300, 22));
		const shifts = declutter(bubbles, { maxShift: BUDGET });

		for (const distance of distances(bubbles, shifts)) {
			expect(distance).toBeLessThanOrEqual(BUDGET + ROUNDING);
		}
	});

	it('moves the smaller bubble further than the bigger one', () => {
		// The place with 216 photographs should stay put; the one with 3 steps aside.
		const big = bubble('big', 100, 100, 32);
		const small = bubble('small', 130, 100, 12);
		const shifts = declutter([big, small]);

		const movedBig = Math.hypot(shifts.get('big')?.dx ?? 0, shifts.get('big')?.dy ?? 0);
		const movedSmall = Math.hypot(shifts.get('small')?.dx ?? 0, shifts.get('small')?.dy ?? 0);

		expect(movedSmall).toBeGreaterThan(movedBig);
	});

	it('separates markers sitting on exactly the same point', () => {
		// Two names for one address - Beukenhof and Mastbeekhof are literally this.
		const bubbles = [bubble('a', 50, 50), bubble('b', 50, 50), bubble('c', 50, 50)];
		const after = applyShifts(bubbles, declutter(bubbles));

		expect(overlapCount(after)).toBe(0);
	});

	it('gives the same answer every time', () => {
		// No randomness anywhere: the markers must not shuffle when the map redraws.
		const bubbles = [bubble('a', 50, 50), bubble('b', 50, 50), bubble('c', 52, 51)];
		const first = declutter(bubbles);
		const second = declutter(bubbles);

		expect([...second.entries()]).toEqual([...first.entries()]);
	});

	it('does less as the zoom pulls the markers apart', () => {
		// The map fixes itself as you zoom in, which is the behaviour that makes the shifts
		// acceptable in the first place.
		const at = (spread: number) =>
			declutter([bubble('a', 100, 100), bubble('b', 100 + spread, 100), bubble('c', 100, 100 + spread)]);

		const tight = at(14).size;
		const looser = at(30).size;
		const apart = at(120).size;

		expect(tight).toBeGreaterThan(0);
		expect(apart).toBe(0);
		expect(looser).toBeLessThanOrEqual(tight);
	});

	it('handles the whole map without falling over', () => {
		// 122 markers is what the home page actually draws.
		const bubbles = Array.from({ length: 122 }, (_, i) =>
			bubble(`p${i}`, 400 + ((i * 37) % 260), 300 + ((i * 53) % 200), 14 + (i % 5) * 4)
		);

		const started = Date.now();
		const shifts = declutter(bubbles);
		const took = Date.now() - started;

		expect(took).toBeLessThan(400);
		expect(overlapCount(applyShifts(bubbles, shifts))).toBeLessThan(overlapCount(bubbles));
	});
});
