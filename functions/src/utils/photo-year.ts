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

/** A period: two years joined by a dash, with or without spaces around it. */
const RANGE = new RegExp(`\\b(${YEAR})\\s*-\\s*(${YEAR})\\b`);

const SINGLE = new RegExp(`\\b(${YEAR})\\b`);

/**
 * The year to file a photograph under, or undefined when the name gives none.
 *
 * A range yields its later year. Everything else yields the first year in the name.
 */
export function yearFromFilename(fileName: string): string | undefined {
	const range = RANGE.exec(fileName);
	if (range) {
		const [, from, to] = range;
		// Defensive: "1975-1970" is somebody's typo, not a period running backwards.
		return Number(to) >= Number(from) ? to : from;
	}

	return SINGLE.exec(fileName)?.[1];
}
