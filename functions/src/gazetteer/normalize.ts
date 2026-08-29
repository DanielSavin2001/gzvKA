/**
 * Place-name normalization.
 *
 * This is a layer on top of the archive-wide {@link normalizeText}: it adds the things
 * that are specific to Flemish place names as volunteers actually typed them into
 * filenames over more than a decade - abbreviated honorifics ("Kon. Astridlaan"),
 * abbreviated saints ("St. Jacobuskerk"), and the street-suffix families that stop
 * fuzzy matching from confusing a wood with a manor.
 *
 * Pure module: it imports nothing from `../constants` or `../services`, so it stays
 * testable with no Firebase runtime and no credentials.
 */

import { normalizeText } from '../../../sharedModels/text';

/**
 * Street-name endings, longest first. Two names may only be fuzzy-matched against each
 * other when they share a family, which is what keeps "mastenbos" (a wood) away from
 * "mastenhof" (a manor) - two edits apart, and a real pair in this corpus.
 */
export const STREET_SUFFIXES: readonly string[] = [
	'sesteenweg',
	'steenweg',
	'straat',
	'baan',
	'dreef',
	'plein',
	'park',
	'laan',
	'heide',
	'donck',
	'hoek',
	'veld',
	'kaai',
	'dijk',
	'berg',
	'wijk',
	'weg',
	'lei',
	'pad',
	'hof',
	'bos'
];

/**
 * Leading titles that appear in some spellings of a street and not in others. Stripping
 * them collapses "Koning Albertlei", "Kon. Albertlei" and "Albertlei" onto one key.
 */
export const HONORIFIC_TOKENS: readonly string[] = [
	'koning',
	'koningin',
	'kon',
	'sint',
	'st',
	'christiaan',
	'chr',
	'pastoor',
	'burgemeester',
	'jonkheer',
	'baron',
	'graaf',
	'onze',
	'lieve',
	'vrouw'
];

/**
 * Whole-token expansions.
 *
 * `kon` is deliberately absent: the corpus uses it for both *Koning* Albert and
 * *Koningin* Astrid, so expanding it either way would manufacture a fact. It is removed
 * by {@link corePlace} instead, which needs no such decision.
 */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
	st: 'sint',
	ste: 'sint',
	olv: 'onze lieve vrouw',
	chr: 'christiaan',
	no: 'nr'
};

/** Strips accents, leaving the base letters. */
export function stripDiacritics(input: string): string {
	return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Folds a place name to its comparison form.
 *
 * Beyond the archive-wide normalization this expands whole-token abbreviations and reads
 * `&` as the word "en", so "Kerken & kapellen" and "Kerken en kapellen" agree.
 *
 * @example
 * normalizePlace('Chr. Pallemansstraat')  // => 'christiaan pallemansstraat'
 * normalizePlace('St. Jacobuskerk')       // => 'sint jacobuskerk'
 * normalizePlace('Kalmthoutsesteenweg_2') // => 'kalmthoutsesteenweg 2'
 */
export function normalizePlace(input: string | null | undefined): string {
	if (input === null || input === undefined) return '';

	// Read the ampersand as a word before punctuation folding turns it into a space.
	const withConjunction = input.replace(/&/g, ' en ');

	const normalized = normalizeText(withConjunction);
	if (normalized === '') return '';

	return collapseSpacedInitialisms(normalized.split(' '))
		.map((token) => ABBREVIATIONS[token] ?? token)
		.join(' ')
		.trim();
}

/**
 * Joins runs of two or more single-letter tokens back into one word, so that a
 * dotted initialism survives punctuation folding.
 *
 * The archive writes the same church both ways: "Kerk O.L.V. van Vrede" and
 * "Kerk OLV Vrede". Folding punctuation turns the first into "o l v", which would never
 * meet the second. Collapsing the run restores "olv", which the abbreviation table then
 * expands like any other. Digits are excluded, so a house number is never glued to
 * anything.
 */
function collapseSpacedInitialisms(tokens: string[]): string[] {
	const result: string[] = [];
	let run: string[] = [];

	const flush = (): void => {
		if (run.length >= 2) result.push(run.join(''));
		else result.push(...run);
		run = [];
	};

	for (const token of tokens) {
		if (token.length === 1 && /[a-z]/.test(token)) {
			run.push(token);
			continue;
		}
		flush();
		if (token !== '') result.push(token);
	}
	flush();

	return result;
}

/**
 * The key used for alias lookup: {@link normalizePlace} with any leading honorifics
 * removed, so the spellings that actually occur in the corpus collapse together.
 *
 * Only *leading* honorifics are stripped, so "Onze Lieve Vrouw van Vrede" reduces to
 * "van vrede" while a name that merely contains such a word keeps it.
 *
 * @example
 * corePlace('Kon. Astridlaan')    // => 'astridlaan'
 * corePlace('Koning Albertlei')   // => 'albertlei'
 * corePlace('St. Jacobuskerk')    // => 'jacobuskerk'
 */
export function corePlace(input: string | null | undefined): string {
	const tokens = normalizePlace(input).split(' ').filter(Boolean);

	let start = 0;
	while (start < tokens.length && HONORIFIC_TOKENS.includes(tokens[start])) {
		start += 1;
	}

	// Never strip a name down to nothing: a place literally called "Sint" keeps its token.
	if (start === tokens.length) return tokens.join(' ');

	return tokens.slice(start).join(' ');
}

/**
 * The street-suffix family of a normalized name, or null when it ends in none of them.
 *
 * Both "-sesteenweg" and "-steenweg" report `steenweg`, so "Hoogboomsesteenweg" and
 * "Hoogboomsteenweg" are allowed to fuzzy-match each other.
 *
 * @example
 * streetSuffixFamily('hoogboomsesteenweg') // => 'steenweg'
 * streetSuffixFamily('mastenbos')          // => 'bos'
 * streetSuffixFamily('mastenhof')          // => 'hof'
 * streetSuffixFamily('louwke poep')        // => null
 */
export function streetSuffixFamily(normalized: string): string | null {
	const compact = normalized.replace(/ /g, '');

	for (const suffix of STREET_SUFFIXES) {
		if (compact.endsWith(suffix)) {
			return suffix === 'sesteenweg' ? 'steenweg' : suffix;
		}
	}

	return null;
}
