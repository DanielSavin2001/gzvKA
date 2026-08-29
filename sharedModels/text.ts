/**
 * Shared text utilities for the gzvKA archive.
 *
 * This module is imported by BOTH the SvelteKit frontend and the Firebase Functions
 * backend, so it must stay dependency-free and side-effect-free. The backend compiles
 * it via `functions/tsconfig.json` into `functions/lib/sharedModels/`; the frontend
 * pulls it in through Vite (see `server.fs.allow` in vite.config.js).
 *
 * The archive is Dutch/Flemish and its filenames are full of accents, apostrophes
 * ("Klasfoto's"), inconsistent casing and punctuation ("z.d..jpg", "Kasteel Op den Wal_5").
 * Search only works if the indexing side and the querying side fold all of that away in
 * exactly the same manner, which is why this lives in one shared place rather than being
 * reimplemented per surface.
 */

/**
 * Characters that Unicode NFD decomposition does not split into a base letter plus a
 * combining mark, and that therefore need an explicit transliteration. Without this,
 * "Ĳzerenweglaan" and "Ærenhof" would keep characters that no visitor is going to type.
 */
const NON_DECOMPOSING_CHARACTERS: ReadonlyArray<readonly [RegExp, string]> = [
	[/Ĳ/g, 'IJ'], // Ĳ - Dutch IJ digraph, uppercase
	[/ĳ/g, 'ij'], // ĳ - Dutch IJ digraph, lowercase
	[/[Æ]/g, 'AE'], // Æ
	[/[æ]/g, 'ae'], // æ
	[/[Œ]/g, 'OE'], // Œ
	[/[œ]/g, 'oe'], // œ
	[/[ß]/g, 'ss'], // ß
	[/[Ø]/g, 'O'], // Ø
	[/[ø]/g, 'o'], // ø
	[/[ĐÐ]/g, 'D'], // Đ, Ð
	[/[đð]/g, 'd'], // đ, ð
	[/[Ł]/g, 'L'], // Ł
	[/[ł]/g, 'l'], // ł
	[/[Þ]/g, 'TH'], // Þ
	[/[þ]/g, 'th'] // þ
];

/**
 * Apostrophe-like characters. These are removed WITHOUT leaving a separator behind, so
 * that "Klasfoto's" normalizes to "klasfotos" (one token) rather than "klasfoto s"
 * (two tokens, the second of which is noise).
 */
const APOSTROPHES = /['‘’ʼ´`]/g;

/** Unicode combining marks left over after NFD decomposition. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Anything that is not an ASCII letter or digit becomes a single separator. */
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

/**
 * Folds a string to a plain, lowercase, accent-free, space-separated form.
 *
 * This is the canonical normalization for the whole archive: image titles are stored in
 * this form so that they are searchable, and a visitor's query is put through the exact
 * same function before it is compared against them.
 *
 * @example
 * normalizeText("Kasteel Op den Wal_5 - Hugo De Hoon - z.d..jpg")
 *   // => "kasteel op den wal 5 hugo de hoon z d jpg"
 * normalizeText("Klasfoto's Sint-Jozef 1969-1970")
 *   // => "klasfotos sint jozef 1969 1970"
 * normalizeText("Café Pancras")
 *   // => "cafe pancras"
 */
export function normalizeText(input: string | null | undefined): string {
	if (input === null || input === undefined) return '';

	let text = input;

	for (const [pattern, replacement] of NON_DECOMPOSING_CHARACTERS) {
		text = text.replace(pattern, replacement);
	}

	// Drop apostrophes first so possessives and elisions stay a single word.
	text = text.replace(APOSTROPHES, '');

	return text
		.normalize('NFD')
		.replace(COMBINING_MARKS, '')
		.toLowerCase()
		.replace(NON_ALPHANUMERIC, ' ')
		.trim();
}

/**
 * Turns a name into a stable, URL-safe identifier.
 *
 * Slugs are used as document keys and as route segments (`/straat/kapelsestraat`), so they
 * must be deterministic and must never change for a given input - a changed slug is a
 * broken link and a broken Firestore reference.
 *
 * @example
 * slugify("Kalmthoutsesteenweg - Duitse Wijk") // => "kalmthoutsesteenweg-duitse-wijk"
 * slugify("Putte-Kapellen")                    // => "putte-kapellen"
 * slugify("Kerken en kapellen")                // => "kerken-en-kapellen"
 */
export function slugify(input: string | null | undefined): string {
	return normalizeText(input).replace(/ /g, '-');
}

/** Options accepted by {@link tokenize}. */
export interface TokenizeOptions {
	/**
	 * Tokens shorter than this are dropped. Defaults to 2, which removes the noise
	 * produced by folding "z.d." into "z d" while keeping meaningful short tokens
	 * such as house numbers.
	 */
	minLength?: number;
	/**
	 * Tokens that consist only of digits are kept regardless of {@link minLength},
	 * because house numbers ("Meidoornlaan 9") and years are worth searching on.
	 * Defaults to true.
	 */
	keepNumbers?: boolean;
}

/**
 * Splits text into the de-duplicated, order-preserving token list used for search
 * indexing and for matching a query against a title.
 *
 * @example
 * tokenize("Stationsstraat 88 - Swatti Alix - zd")
 *   // => ["stationsstraat", "88", "swatti", "alix", "zd"]
 */
export function tokenize(
	input: string | null | undefined,
	options: TokenizeOptions = {}
): string[] {
	const minLength = options.minLength ?? 2;
	const keepNumbers = options.keepNumbers ?? true;

	const normalized = normalizeText(input);
	if (normalized === '') return [];

	const seen = new Set<string>();
	const tokens: string[] = [];

	for (const token of normalized.split(' ')) {
		if (token === '') continue;

		const isNumeric = /^[0-9]+$/.test(token);
		if (token.length < minLength && !(keepNumbers && isNumeric)) continue;
		if (seen.has(token)) continue;

		seen.add(token);
		tokens.push(token);
	}

	return tokens;
}

/**
 * Collapses a normalized string to a comparison key with no separators at all.
 *
 * Used for tolerant place-name matching, where the corpus disagrees with itself about
 * spacing and hyphenation: "Op den Wal", "Op-den-Wal" and "Opdenwal" must all collide.
 *
 * @example
 * compactKey("Op den Wal")   // => "opdenwal"
 * compactKey("Op-den-Wal")   // => "opdenwal"
 */
export function compactKey(input: string | null | undefined): string {
	return normalizeText(input).replace(/ /g, '');
}
