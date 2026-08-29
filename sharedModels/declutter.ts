/**
 * Keeping map markers off each other.
 *
 * Kapellen is small and its archive is not evenly spread: the Dorpsstraat, the Geuzenhoek
 * and half a dozen castles sit within a few hundred metres of each other, so at the zoom
 * the map opens at, their bubbles land on top of one another. The biggest simply covers the
 * rest, and a place with 216 photographs hides three places with 30 that a visitor would
 * have clicked.
 *
 * The usual answer is clustering - merge the overlapping ones into a single bubble with a
 * count. That is wrong for this archive. A cluster of 4 says "four places here" and takes a
 * click to find out which; the whole point of this map is that you can see the Kapelsestraat
 * and the castle beside it at a glance and pick the one you meant.
 *
 * So the markers are pushed apart instead, the way beads settle when you shake a tray. Two
 * rules keep it honest:
 *
 *   - A marker never moves more than `maxShift` pixels. If a knot cannot be untangled
 *     within that budget it stays tangled, because a bubble dragged 200 px across the map
 *     is no longer telling you where the place is.
 *   - The shift is in *screen* pixels and depends only on the zoom, so zooming in shrinks
 *     it to nothing on its own: at the zoom where the bubbles no longer touch, every marker
 *     sits exactly on its real coordinate. The caller draws a leader line back to the true
 *     point for anything still displaced.
 *
 * Bigger bubbles move less than smaller ones. A marker's weight is its area, so the place
 * with 216 photographs stays put and the one with 3 steps aside - which is both what the
 * eye expects and the arrangement that disturbs the map least.
 */

export interface Bubble {
	id: string;
	/** Screen position of the real coordinate, in pixels. */
	x: number;
	y: number;
	/** Radius of the drawn bubble, in pixels. */
	r: number;
}

export interface Shift {
	dx: number;
	dy: number;
}

export interface DeclutterOptions {
	/** Relaxation passes. More is smoother; the gain falls off quickly past a handful. */
	passes?: number;
	/** Clear space to leave between two bubbles, in pixels. */
	padding?: number;
	/** The furthest a marker may be moved from its real position, in pixels. */
	maxShift?: number;
}

/**
 * `maxShift` is the honesty dial, and it was chosen by measuring the real map rather than
 * picked. Overlapping marker pairs at the zoom the page opens at: 163 with no declutter,
 * 52 at a 34 px budget, 31 at 44, 13 at 56. Every step buys a tidier map and costs
 * truthfulness - 44 px is about 150 m on the ground at that zoom, and 56 nearly 190 m,
 * which is too far to drag a geocoded address even with a line drawn back to it.
 *
 * 44 also reaches zero overlaps one zoom step in, which is the behaviour that makes the
 * whole idea acceptable: the arrangement dissolves as soon as there is room for it to.
 */
const DEFAULTS = { passes: 60, padding: 3, maxShift: 44 };

/** Coincident markers need *some* direction to separate along; this one is reproducible. */
function nudgeFor(index: number): { x: number; y: number } {
	// The golden angle spreads successive indices evenly around the circle rather than
	// clumping them, so three places at one address open into a fan rather than a line.
	const angle = index * 2.399963229728653;
	return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * Works out how far each bubble has to move so none overlap.
 *
 * Returns a shift per id, in screen pixels. Ids not in the result did not move.
 */
export function declutter(
	bubbles: Bubble[],
	options: DeclutterOptions = {}
): Map<string, Shift> {
	const passes = options.passes ?? DEFAULTS.passes;
	const padding = options.padding ?? DEFAULTS.padding;
	const maxShift = options.maxShift ?? DEFAULTS.maxShift;

	const count = bubbles.length;
	const x = new Float64Array(count);
	const y = new Float64Array(count);
	// Weight by area: a bubble twice as wide is four times as reluctant to be pushed.
	const weight = new Float64Array(count);

	for (let i = 0; i < count; i += 1) {
		// A sub-pixel nudge, different for every index and the same on every run.
		//
		// Without it the relaxation deadlocks on symmetry: three markers on one point push
		// the first two apart in exactly opposite directions, and the third then receives
		// two pushes that cancel to zero and never moves at all. It stayed buried under the
		// other two forever. A hundredth of a pixel is far too small to see and is enough to
		// break every such tie.
		const nudge = nudgeFor(i);
		x[i] = bubbles[i].x + nudge.x * 0.01;
		y[i] = bubbles[i].y + nudge.y * 0.01;
		weight[i] = Math.max(1, bubbles[i].r * bubbles[i].r);
	}

	for (let pass = 0; pass < passes; pass += 1) {
		let moved = false;

		for (let i = 0; i < count; i += 1) {
			for (let j = i + 1; j < count; j += 1) {
				const wanted = bubbles[i].r + bubbles[j].r + padding;

				let dx = x[j] - x[i];
				let dy = y[j] - y[i];
				let distance = Math.hypot(dx, dy);

				if (distance >= wanted) continue;

				if (distance < 1e-6) {
					// Exactly on top of each other - two places at one address. Pick a
					// direction from the index so the result is the same every time.
					const nudge = nudgeFor(j);
					dx = nudge.x;
					dy = nudge.y;
					distance = 1;
				}

				const overlap = wanted - distance;
				const unitX = dx / distance;
				const unitY = dy / distance;

				// Share the correction in inverse proportion to weight, so the heavier
				// bubble barely moves and the lighter one steps aside.
				const total = weight[i] + weight[j];
				const shareI = weight[j] / total;
				const shareJ = weight[i] / total;

				x[i] -= unitX * overlap * shareI;
				y[i] -= unitY * overlap * shareI;
				x[j] += unitX * overlap * shareJ;
				y[j] += unitY * overlap * shareJ;

				moved = true;
			}
		}

		// Hold every marker inside its budget *between* passes rather than trimming the
		// finished layout.
		//
		// Clamping at the end looked equivalent and was not: the relaxation would fling two
		// markers to opposite sides and leave a third exactly between them, correctly
		// separated - and then pulling the outer two back to the budget put them back on top
		// of the one in the middle. Enforcing the limit here means the following passes see
		// the wall and push the middle marker out too, which is the arrangement wanted.
		for (let i = 0; i < count; i += 1) {
			const driftX = x[i] - bubbles[i].x;
			const driftY = y[i] - bubbles[i].y;
			const drift = Math.hypot(driftX, driftY);

			if (drift > maxShift) {
				const scale = maxShift / drift;
				x[i] = bubbles[i].x + driftX * scale;
				y[i] = bubbles[i].y + driftY * scale;
			}
		}

		// Nothing overlapped this pass, so nothing will next pass either.
		if (!moved) break;
	}

	const shifts = new Map<string, Shift>();

	for (let i = 0; i < count; i += 1) {
		const dx = x[i] - bubbles[i].x;
		const dy = y[i] - bubbles[i].y;
		const distance = Math.hypot(dx, dy);

		if (distance < 0.5) continue;

		// Already inside the budget: the relaxation held it there on every pass.
		shifts.set(bubbles[i].id, { dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 });
	}

	return shifts;
}

/** How many pairs of these bubbles overlap. Used by the tests, and worth having. */
export function overlapCount(bubbles: Bubble[], padding = 0): number {
	let overlaps = 0;

	for (let i = 0; i < bubbles.length; i += 1) {
		for (let j = i + 1; j < bubbles.length; j += 1) {
			const wanted = bubbles[i].r + bubbles[j].r + padding;
			if (Math.hypot(bubbles[j].x - bubbles[i].x, bubbles[j].y - bubbles[i].y) < wanted) {
				overlaps += 1;
			}
		}
	}

	return overlaps;
}

/** Applies shifts, so a caller (or a test) can measure the arrangement that results. */
export function applyShifts(bubbles: Bubble[], shifts: Map<string, Shift>): Bubble[] {
	return bubbles.map((bubble) => {
		const shift = shifts.get(bubble.id);
		return shift ? { ...bubble, x: bubble.x + shift.dx, y: bubble.y + shift.dy } : bubble;
	});
}
