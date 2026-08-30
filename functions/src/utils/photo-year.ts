/**
 * Which year a photograph belongs to, read from its filename.
 *
 * The archive dates photographs in their names, and mostly it is one year: "Dorpsstraat -
 * optocht - 1967.jpg". Taking the first four-digit number was right for those and wrong
 * for the rest, because the archive also names *periods*:
 *
 *   75 jaar Belgie - Onafhankelijkheidsfeest 1830-1905
 *   Hoevensebaan - staakmolen 1801-1908
 *
 * The first is a photograph of the 1905 festivities commemorating 1830; the second is a
 * mill that stood from 1801 until 1908. Neither photograph can have been taken in the
 * first year of its range - photography did not exist in 1801, and the Belgian revolution
 * was not photographed - so the first year is the one year the picture certainly is not
 * from. Reading it as the date put eight photographs of a 1905 street party into the
 * 1830s, which is the sort of thing nobody notices until it is drawn on a timeline.
 */

const YEAR = '(?:18\\d{2}|19\\d{2}|20[0-1]\\d)';

/**
 * The year Belgium became a country.
 *
 * Hard-coded because it is a fact, and because it is the only base year in this archive
 * that can be relied on. "50 jarig huwelijk" is somebody's golden wedding and the archive
 * does not say whose or when, so no equivalent rule exists for it - guessing a base year
 * there would invent a date rather than read one.
 */
const BELGIAN_INDEPENDENCE = 1830;

/**
 * An anniversary of Belgium: "100 jaar Belgie", "75 jaar België".
 *
 * This has to beat both rules below, because those read the *subject* year rather than the
 * year the photograph was taken:
 *
 *   100 jaar Belgie - Eeuwfeest - vrijwilligers 1830   ->  1930, not 1830
 *   75 jaar Belgie - ... - eerste trein Kapellen 1854  ->  1905, not 1854
 *
 * The first is a photograph of the 1930 centenary parade, in which men dressed as the
 * volunteers of 1830. The second is a float at the 1905 festivities depicting the first
 * train, which ran in 1854. In both the older year is what the picture is *about*; the
 * anniversary is when somebody stood there with a camera.
 *
 * The corpus agrees with itself here, which is what makes this safe rather than clever:
 * of the 31 photographs naming an anniversary of Belgium, 24 already carry the derived
 * year in their own filename ("100 jaar Belgie - Eeuwfeesten 1930"). This rule brings the
 * other seven into line instead of leaving two in a decade that had no photography.
 */
const BELGIAN_ANNIVERSARY = /\b(\d{1,3})\s*jaar\s+belgi[e\u00eb]/i;

/** A period: two years joined by a dash, with or without spaces around it. */
const RANGE = new RegExp(`\\b(${YEAR})\\s*-\\s*(${YEAR})\\b`);

const SINGLE = new RegExp(`\\b(${YEAR})\\b`);

/**
 * The year to file a photograph under, or undefined when the name gives none.
 *
 * An anniversary of Belgium yields the anniversary itself. A range yields its later year.
 * Everything else yields the first year in the name.
 */
export function yearFromFilename(fileName: string): string | undefined {
	// First, because the other two rules would read the year the photograph is *about*.
	const anniversary = BELGIAN_ANNIVERSARY.exec(fileName);
	if (anniversary) {
		const years = Number(anniversary[1]);
		// A sanity bound rather than a blind sum: "200 jaar Belgie" has not happened yet,
		// and whatever such a filename meant, it is not a photograph from 2030.
		const when = BELGIAN_INDEPENDENCE + years;
		if (years > 0 && when <= new Date().getFullYear()) return String(when);
	}

	const range = RANGE.exec(fileName);
	if (range) {
		const [, from, to] = range;
		// Defensive: "1975-1970" is somebody's typo, not a period running backwards.
		return Number(to) >= Number(from) ? to : from;
	}

	return SINGLE.exec(fileName)?.[1];
}
