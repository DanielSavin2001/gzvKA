/**
 * Which of a row of evenly spaced ticks get a written label.
 *
 * The timeline's decade strip has thirteen bars. On a 360-pixel phone that is about
 * twenty-one pixels each, and a four-digit year at the smallest readable size needs thirty -
 * so every label was rendered with `truncate` and every one of them came out as "19...".
 * Thirteen identical ellipses is not a denser axis, it is no axis: a reader cannot tell 1910
 * from 1990, and the strip's whole job is telling them where to tap.
 *
 * Shrinking the type is not the way out. This archive's readers are largely the people who
 * are *in* the photographs, and the site has already been through a pass for exactly that;
 * ten-pixel text would trade one unreadable label for another.
 *
 * So the labels get sparser rather than smaller. An axis has never needed a number under
 * every tick - it needs enough of them to count from, which is why a ruler prints 0, 5 and
 * 10 and not every millimetre.
 *
 * ## The stride is measured, not guessed
 *
 * The first version of this kept only the ends and the middle, from a guess at how much
 * room a year needs. Three labels across a century is too few to read - you cannot tell
 * 1930 from 1940 without counting bars - and the guess turned out to be twice as cautious
 * as the pixels require. Measured in a browser, at 320, 360, 390 and 414 pixels wide:
 *
 *     column pitch   22.5 - 29.7 px
 *     "1950"         30.5 px
 *     "<1900"        40.6 px   (the widest, and the one that has to clear its neighbour)
 *
 * Two columns apart puts 45 pixels between centres at the very worst case, against the
 * 35.6 the widest pair actually needs. So the stride is two, and thirteen decades keep
 * seven labels rather than three.
 *
 * Lives in `sharedModels/` for the reason the rest do: it is a rule with an edge case -
 * what happens when the last tick does not land on the stride - and a rule with an edge
 * case needs a test.
 */

/**
 * The indices worth labelling, given how many ticks there are.
 *
 * Small rows are labelled in full: there is room, and thinning them would hide something
 * for nothing.
 *
 * Both ends are always labelled. They are what a reader orients by - the first tells them
 * where the archive starts, the last where it stops - and an axis labelled only in the
 * middle reads as a fragment of a longer one.
 *
 * `stride` is in ticks rather than pixels because that is what the caller can know: the
 * strip is a flex row of equal columns, so "two columns apart" is a distance whatever the
 * viewport turns out to be.
 */
export function sparseLabels(total: number, { all = 5, stride = 2 } = {}): number[] {
	if (total <= 0) return [];
	if (total <= all) return Array.from({ length: total }, (_, index) => index);

	const last = total - 1;
	const chosen: number[] = [];
	for (let index = 0; index <= last; index += stride) chosen.push(index);

	// The last tick may not land on the stride - thirteen decades do, fourteen will not, and
	// a fourteenth is one 2020s photograph away. It is labelled regardless, because an axis
	// that stops naming things one short of its own end looks broken rather than sparse; if
	// that crowds the tick before it, that one gives way.
	if (chosen[chosen.length - 1] !== last) {
		if (last - chosen[chosen.length - 1] < stride) chosen.pop();
		chosen.push(last);
	}

	return chosen;
}

/** Whether one tick is labelled, for a caller that has an index rather than a list. */
export function isLabelled(
	index: number,
	total: number,
	options?: { all?: number; stride?: number }
) {
	return sparseLabels(total, options).includes(index);
}
