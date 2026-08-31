/**
 * Spotting two spellings of one person.
 *
 * A donor is not a record: it is the string on each photograph, and identity is
 * `slugify(name)`. So the archive already merges what the slug merges - "Johan Van Elst" and
 * "Johan van Elst" are one man, because case and accents fall out of the slug. Everything
 * else forks: "J. Van Elst" is a different person from "Johan Van Elst" as far as the site is
 * concerned, with a page of his own and one photograph on it.
 *
 * Nobody finds those by eye in a list of 297 names, which is why they are still there. This
 * finds the pairs worth looking at and, importantly, says WHY it thinks so - a curator has to
 * be able to disagree, and "these two look alike" is not something to act on blindly. Two
 * brothers really can be A. Peeters and Alfons Peeters.
 */

import { normalizeText } from './text';

/** Why two names are being shown together. Displayed to the curator, so it must be plain. */
export type Likeness = 'zelfde-woorden' | 'initiaal' | 'tikfout';

export interface DonorLike {
	slug: string;
	name: string;
	count: number;
}

export interface SimilarPair {
	a: DonorLike;
	b: DonorLike;
	why: Likeness;
	/** Dutch, shown as-is beside the pair. */
	reason: string;
}

/** Words of a name, normalised and stripped of the punctuation an initial carries. */
function words(name: string): string[] {
	return normalizeText(name)
		.split(' ')
		.map((word) => word.replace(/\./g, ''))
		.filter(Boolean);
}

/** Levenshtein distance, capped: anything past `limit` is reported as `limit + 1`. */
export function editDistance(a: string, b: string, limit = 3): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > limit) return limit + 1;

	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

	for (let i = 1; i <= a.length; i += 1) {
		const current = [i];
		let best = i;

		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
			best = Math.min(best, current[j]);
		}

		// Every cell in this row is already past the limit, so no completion can come back.
		if (best > limit) return limit + 1;
		previous = current;
	}

	return previous[b.length];
}

/**
 * Whether one name is the other with a word abbreviated to its initial.
 *
 * "J Van Elst" against "Johan Van Elst": same number of words, every word equal except one,
 * and that one is a single letter which starts the other. Requiring the same word count
 * keeps "Van Elst" from matching "Johan Van Elst", which is a different question - that one
 * is a missing first name, and a missing first name is genuinely ambiguous between people.
 */
function initialOf(a: string[], b: string[]): boolean {
	if (a.length !== b.length || a.length < 2) return false;

	let abbreviations = 0;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] === b[i]) continue;

		const short = a[i].length === 1 ? a[i] : b[i].length === 1 ? b[i] : null;
		const long = a[i].length === 1 ? b[i] : b[i].length === 1 ? a[i] : null;
		if (!short || !long || !long.startsWith(short)) return false;

		abbreviations += 1;
	}

	return abbreviations === 1;
}

/**
 * Two people with the same surname, rather than one person spelled twice.
 *
 * The plain distance rule cannot tell "Robert Vingerhoed" from "Roger Vingerhoed", and both
 * are in this archive - 132 photographs and 1. So are "Stan Wagemans" and "Jean Wagemans".
 * Offering either pair as a merge invites a curator to fuse two real people, which is the one
 * mistake this desk must not make easy: the photographs are of somebody's family.
 *
 * The signal is where the difference falls. A surname mistyped is a typo; a first name that
 * is a different first name is a different person. "Marianne"/"Mariane" is one character and
 * stays - that is a slip. "Robert"/"Roger" is two, and two characters of difference in a
 * given name is a name, not a slip.
 */
function differentGivenName(a: string[], b: string[]): boolean {
	if (a.length !== b.length || a.length < 2) return false;

	const differing = a.map((word, index) => (word === b[index] ? -1 : index)).filter((i) => i >= 0);
	if (differing.length !== 1 || differing[0] !== 0) return false;

	const [one, two] = [a[0], b[0]];
	if (one.startsWith(two) || two.startsWith(one)) return false;

	return editDistance(one, two, 2) >= 2;
}

/**
 * Pairs of donors that are probably one person, most photographs at stake first.
 *
 * Deliberately conservative. It reports three things and nothing else: the same words in a
 * different order, one word shortened to an initial, and a name within two characters of
 * another. A looser rule turns 297 names into a wall of false pairs, and a wall nobody reads
 * is worth less than the list it replaced.
 */
export function likelyDuplicates(donors: DonorLike[]): SimilarPair[] {
	const pairs: SimilarPair[] = [];

	const prepared = donors.map((donor) => ({
		donor,
		flat: normalizeText(donor.name).replace(/\./g, ''),
		words: words(donor.name),
		sorted: words(donor.name).slice().sort().join(' ')
	}));

	for (let i = 0; i < prepared.length; i += 1) {
		for (let j = i + 1; j < prepared.length; j += 1) {
			const left = prepared[i];
			const right = prepared[j];

			let why: Likeness | null = null;
			let reason = '';

			if (left.words.length > 1 && left.sorted === right.sorted) {
				why = 'zelfde-woorden';
				reason = 'Dezelfde woorden, andere volgorde.';
			} else if (initialOf(left.words, right.words)) {
				why = 'initiaal';
				reason = 'Eén naam staat afgekort.';
			} else if (
				left.flat.length >= 6 &&
				editDistance(left.flat, right.flat, 2) <= 2 &&
				!differentGivenName(left.words, right.words)
			) {
				why = 'tikfout';
				reason = 'Verschilt maar één of twee tekens.';
			}

			if (why) pairs.push({ a: left.donor, b: right.donor, why, reason });
		}
	}

	// The pair worth looking at first is the one with the most photographs hanging on it.
	return pairs.sort((one, two) => two.a.count + two.b.count - (one.a.count + one.b.count));
}
