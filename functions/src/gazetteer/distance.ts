/**
 * String distance metrics for tolerant place-name matching.
 *
 * The choice of metric here is load-bearing, so it is worth recording why:
 * the archive's real misspellings are overwhelmingly single-character slips and
 * transpositions - "Doprsstraat" for "Dorpsstraat" is one transposition, "Dorpstraat"
 * one deletion, "Kalmhousesteenweg" two edits from "Kalmthoutsesteenweg". Damerau-
 * Levenshtein scores those as 1, 1 and 2 and scores genuinely different streets much
 * higher, so it is the metric that decides acceptance. Dice similarity on character
 * bigrams rates that same transposition only 0.70, which means any Dice threshold loose
 * enough to catch it would also accept unrelated names - so Dice is used only as a cheap
 * pre-filter to avoid running the quadratic metric against every entry.
 *
 * Pure module: no Firebase, no config, testable offline.
 */

/**
 * Damerau-Levenshtein distance, optimal string alignment variant: insertions, deletions,
 * substitutions and transpositions of two adjacent characters each cost 1.
 *
 * The optimal string alignment variant does not allow a substring to be edited more than
 * once, which is the standard, cheaper form and is more than adequate for typo detection.
 *
 * @param max Optional early-exit ceiling. When the distance certainly exceeds it, the
 * function returns `max + 1` without finishing - a large saving when scanning a gazetteer.
 *
 * @example
 * damerauLevenshtein('doprsstraat', 'dorpsstraat') // => 1 (one transposition)
 * damerauLevenshtein('mastenbos', 'mastenhof')     // => 2
 */
export function damerauLevenshtein(a: string, b: string, max?: number): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const ceiling = max ?? Number.POSITIVE_INFINITY;

	// A length gap alone already exceeds the ceiling; no need to build the matrix.
	if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;

	const rows = a.length + 1;
	const cols = b.length + 1;

	// Three rolling rows are enough for the optimal string alignment variant.
	let twoBack: number[] = [];
	let oneBack: number[] = new Array(cols);
	let current: number[] = new Array(cols);

	for (let j = 0; j < cols; j += 1) oneBack[j] = j;

	for (let i = 1; i < rows; i += 1) {
		current[0] = i;
		let rowMinimum = current[0];

		for (let j = 1; j < cols; j += 1) {
			const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

			let value = Math.min(
				current[j - 1] + 1, // insertion
				oneBack[j] + 1, // deletion
				oneBack[j - 1] + substitutionCost // substitution
			);

			// Transposition of two adjacent characters.
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, twoBack[j - 2] + 1);
			}

			current[j] = value;
			if (value < rowMinimum) rowMinimum = value;
		}

		// Every remaining row can only add to the minimum, so this exit is safe.
		if (rowMinimum > ceiling) return ceiling + 1;

		twoBack = oneBack;
		oneBack = current;
		current = new Array(cols);
	}

	return oneBack[cols - 1];
}

/**
 * Sorensen-Dice similarity over character bigrams, from 0 (nothing in common) to 1
 * (identical). Used only as a cheap pre-filter before {@link damerauLevenshtein}.
 *
 * Strings shorter than two characters have no bigrams; they compare as 1 when equal and
 * 0 otherwise, rather than dividing by zero.
 *
 * @example
 * diceCoefficient('kalmhousesteenweg', 'kalmthoutsesteenweg') // => ~0.82
 */
export function diceCoefficient(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;

	const bigramCounts = new Map<string, number>();
	for (let i = 0; i < a.length - 1; i += 1) {
		const bigram = a.slice(i, i + 2);
		bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
	}

	let shared = 0;
	for (let i = 0; i < b.length - 1; i += 1) {
		const bigram = b.slice(i, i + 2);
		const remaining = bigramCounts.get(bigram) ?? 0;
		if (remaining > 0) {
			bigramCounts.set(bigram, remaining - 1);
			shared += 1;
		}
	}

	return (2 * shared) / (a.length - 1 + (b.length - 1));
}
