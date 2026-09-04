/**
 * Which of a row of evenly spaced ticks get a written label.
 *
 * The timeline's decade strip has thirteen bars. On a 360-pixel phone that is about
 * twenty-one pixels each, and a four-digit year at the smallest readable size needs
 * thirty - so every label was rendered with `truncate` and every one of them came out as
 * "19...". Thirteen identical ellipses is not a denser axis, it is no axis: a reader cannot
 * tell 1910 from 1990, and the strip's whole job is telling them where to tap.
 *
 * Shrinking the type is not the way out. This archive's readers are largely the people who
 * are *in* the photographs, and the site has already been through a pass for exactly that;
 * ten-pixel text would trade one unreadable label for another.
 *
 * So the labels get sparser rather than smaller. An axis has never needed a number under
 * every tick - it needs enough anchors to count from, which is why a ruler prints 0, 5 and
 * 10 and not every millimetre. Three labels at full size beat thirteen ellipses, and the
 * heading directly under the strip names the decade you are actually looking at in 4xl
 * type, so the labels only ever have to serve aiming at the *others*.
 *
 * Lives in `sharedModels/` for the reason the rest do: it is a rule with an edge case -
 * what happens when two anchors land next to each other - and a rule with an edge case
 * needs a test.
 */

/**
 * The indices worth labelling, given how many ticks there are and how many ticks apart two
 * labels must be to not collide.
 *
 * Small rows are labelled in full: there is room, and thinning them would hide something
 * for nothing. Past that it is the ends and the middle - the three a reader counts from.
 *
 * `gap` is in ticks rather than pixels because that is what the caller can actually know:
 * the strip is a flex row of equal columns, so "four columns apart" is a width whatever
 * the viewport turns out to be.
 */
export function sparseLabels(total: number, { all = 5, gap = 4 } = {}): number[] {
	if (total <= 0) return [];
	if (total <= all) return Array.from({ length: total }, (_, index) => index);

	const first = 0;
	const last = total - 1;
	const middle = Math.floor(last / 2);

	// The ends always win. The middle is a convenience, and a convenience that lands on
	// top of something else is worse than no convenience - two four-digit years
	// overlapping read as one eight-digit number.
	const chosen = [first];
	if (middle - first >= gap && last - middle >= gap) chosen.push(middle);
	chosen.push(last);

	return chosen;
}

/** Whether one tick is labelled, for a caller that has an index rather than a list. */
export function isLabelled(index: number, total: number, options?: { all?: number; gap?: number }) {
	return sparseLabels(total, options).includes(index);
}
