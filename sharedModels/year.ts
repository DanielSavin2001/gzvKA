/**
 * Reading a year that might be two years.
 *
 * A photograph's year is a string, and most of the time it is four digits. Sometimes it is a
 * span - "1966-1967" for a school year, "1933-1934" for a football season - and the archive
 * asks for exactly that in its own words: the dating form on every photo page says
 * "Twijfel je tussen twee jaren, schrijf dan bijvoorbeeld 1957-1958."
 *
 * Three write paths already accept one. `photo-edit.ts` takes `1935-1936` from a curator,
 * `photo-fact.ts` builds `${from}-${to}` out of a resident's suggestion, and the submission
 * service takes the same shape from the upload form. So a span is not a hypothetical the
 * parser might one day produce - it is a value the site solicits, in Dutch, from the public.
 *
 * And everything that read it read it with `Number()`, which is where this gets expensive.
 * `Number('1966-1967')` is NaN, and NaN is falsy, so:
 *
 *   - `sortForDisplay` did `ay - by || ...`, and NaN - NaN is NaN, which is falsy, so the
 *     comparison fell through to house number and then title. That is not "sorts last": it
 *     is a comparator that is not transitive, so the whole list around it takes an arbitrary
 *     order - and the photo page's arrows walk exactly that list, so they start skipping.
 *   - The timeline filtered on `/^\d{4}$/` and dropped the photograph silently.
 *   - A donor's date span filtered on `Number.isFinite` and dropped it too, which does not
 *     shorten the span so much as delete it: a donor whose every dated photograph carries a
 *     span ends up with no years at all.
 *
 * A span is anchored to its FIRST year. A Flemish school year starts in September and the
 * class photograph is taken early in it, so 1966-1967 is a photograph from 1966.
 */

/** `1935`, `1935-1936`, or `1935 - 1936` - the spaced form is what the curator regex allows. */
const YEAR = /^\s*(\d{4})\s*(?:-\s*(\d{4})\s*)?$/;

/** The two years of a span, or the one year, or null when it is not a year at all. */
export function readYearSpan(
	value: string | undefined | null
): { from: number; to: number } | null {
	if (!value) return null;

	const match = YEAR.exec(value);
	if (!match) return null;

	const from = Number(match[1]);
	const to = match[2] === undefined ? from : Number(match[2]);

	// A span that runs backwards is a typo, not a span. `1966-1965` should not silently
	// anchor to 1966 and imply a year of reasoning nobody did.
	if (to < from) return null;

	return { from, to };
}

/**
 * The year to sort, band and date by: the first year of a span.
 *
 * Null rather than NaN, deliberately. NaN propagates through arithmetic and comparisons
 * without ever being false, which is how one undated photograph reordered a whole list.
 */
export function startYear(value: string | undefined | null): number | null {
	return readYearSpan(value)?.from ?? null;
}

/** True when this is a span of two different years rather than a single year. */
export function isYearSpan(value: string | undefined | null): boolean {
	const span = readYearSpan(value);
	return span !== null && span.to > span.from;
}

/** `1935 - 1936` written the one way the archive stores it. Unreadable input is left alone. */
export function canonicalYear(value: string): string {
	const span = readYearSpan(value);
	if (!span) return value.trim();

	return span.to > span.from ? `${span.from}-${span.to}` : String(span.from);
}

/**
 * Which band of the timeline a photograph belongs to.
 *
 * Shared because it is asserted twice - once to draw the timeline and once for the arrows
 * that walk it - and `archive.ts` already warns in its own words that two copies of a
 * display rule drift and "the arrows would start skipping". Everything before 1900 is one
 * band, because that is how the timeline draws it.
 */
export function decadeBandOf(value: string | undefined | null): string | null {
	const year = startYear(value);
	if (year === null) return null;

	return year < 1900 ? 'voor-1900' : String(Math.floor(year / 10) * 10);
}
