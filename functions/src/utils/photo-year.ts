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

/** Two years joined by a dash, with or without spaces around it. */
const RANGE = new RegExp(`\\b(${YEAR})\\s*-\\s*(${YEAR})\\b`);

const SINGLE = new RegExp(`\\b(${YEAR})\\b`);

/**
 * The year to file a photograph under, or undefined when the name gives none.
 *
 * An anniversary of Belgium yields the anniversary itself. A span of two consecutive years
 * is a season and is kept whole. Any wider range yields its later year. Everything else
 * yields the first year in the name.
 *
 * ## Why consecutive years are different
 *
 * Taking the later year of a range was written for periods, and it is right for those: a
 * mill that stood from 1801 to 1908 was not photographed in 1801. It was wrong for the 118
 * filenames in this archive whose two years are consecutive, because those are not periods
 * at all - they are seasons, and Belgium names a season by the year it starts in.
 *
 * The corpus is unambiguous about it. Of those 118, 107 are class photographs
 * ("Klasfoto - De Platanen 1999-2000 - 4de leerjaar") and the other 11 are football teams
 * ("SP - Noorse VV - 1962-1963", "FC Cappellen 1933-1934"). A school year and a football
 * season both run from autumn to spring, both are spoken of by their first year, and the
 * photograph in both cases is taken near the start. There is not one counter-example: no
 * consecutive pair in this archive means anything but a season.
 *
 * So "Klasfoto - De Platanen 1999-2000" was filed under 2000, which put a class from the
 * nineties in the 2000s. Fifteen photographs sat in the wrong decade on the timeline for
 * exactly this reason, all of them at the turn of one: 1969-1970, 1979-1980, 1989-1990,
 * 1999-2000, 2009-2010.
 *
 * The span is kept whole rather than reduced to its first year, because "1969-1970" is what
 * the photograph is actually of and everything downstream already reads a span: `startYear`
 * sorts and bands by the first year, `decadeBandOf` puts it in the sixties, and a caption
 * that says "1969-1970" is the truth a caption saying "1969" only approximates.
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
		const from = Number(range[1]);
		const to = Number(range[2]);

		// Defensive: "1975-1970" is somebody's typo, not a period running backwards.
		if (to < from) return String(from);

		// A season - a school year or a football season - kept whole. See above.
		if (to === from + 1) return `${from}-${to}`;

		// A period. The first year is the one year the photograph certainly is not from.
		return String(to);
	}

	return SINGLE.exec(fileName)?.[1];
}
