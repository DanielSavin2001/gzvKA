/**
 * Filename segmentation.
 *
 * Volunteers named these files by hand over more than a decade, but they followed a
 * convention closely enough that it can be parsed:
 *
 *     <description / place> [ - <contributor> ] - <date>
 *
 * with "z.d." (zonder datum, no date) and "z.n." (zonder naam, anonymous) standing in for
 * the unknown parts. This module recovers those roles so that the place text can be
 * searched for streets without the donor's surname being mistaken for one.
 *
 * Pure module: no Firebase, no config, testable offline.
 */

import { normalizePlace } from './normalize';

/**
 * The segment separator.
 *
 * A hyphen only separates when it has whitespace on at least one side. That single rule
 * is what keeps "Marie-Leen", "Robert-Diane", "1969-1970" and
 * "Chr. Pallemansstraat-Heidestraat" intact while still splitting the two malformed
 * shapes the corpus contains: "1907_2 -Dirk Van Laer" (space before only) and
 * "St. Jacobuskerk- Hugo De Hoon" (space after only). A bare hyphen between two place
 * names means a corner, which is handled separately rather than by splitting.
 */
const SEGMENT_SEPARATOR = /(?:\s+-\s*|\s*-\s+)/;

/**
 * A trailing date-ish token: a full date, a month-year, a bare year, or the archive's
 * "no date" marker.
 */
const DATE_TOKEN = /^(?:z\.?d\.?|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{4}|\d{4})$/i;

/** The archive's "anonymous donor" marker. */
const ANONYMOUS_TOKEN = /^z\.?n\.?$/i;

/** A full donation date, which is the only form that yields dateOfAcquisition. */
const FULL_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/**
 * An unambiguous duplicate marker: "_5" or "(9)" at the end of a segment.
 *
 * Safe to strip from any segment, because neither shape can be a house number.
 */
const UNAMBIGUOUS_INDEX = /(?:_(\d{1,3})|\s*\((\d{1,3})\))$/;

/**
 * A bare trailing number, as in "Raymond Roeland 2".
 *
 * Only ever stripped from a contributor segment. On a place segment the same shape is a
 * house number - "Dorpsstraat 15" - so stripping it there would throw away an address.
 */
const CONTRIBUTOR_INDEX = /\s+(\d{1,2})$/;

/**
 * Subject prefixes whose meaning the archive never recorded. They are stripped so they do
 * not pollute place matching, and reported so that nobody silently guesses what they mean.
 */
const KNOWN_PREFIX_CODES = new Set(['OWNP', 'SP', 'FZ', 'KAPE', 'ACC', 'GZVKA']);

/** The roles recovered from one filename. */
export interface FilenameParts {
	/** The filename with its extension removed. */
	base: string;
	/** Every segment, in order, trimmed. */
	segments: string[];
	/** Segments that carry place or description text, with their original index. */
	placeSegments: Array<{ text: string; index: number }>;
	/** The donor, or null when anonymous or absent. */
	contributor: string | null;
	/** The raw date-ish token, or null. */
	dateToken: string | null;
	/** dd.mm.yyyy when the date token is a full date. */
	dateOfAcquisition: string | null;
	/** True unless the filename says z.d. */
	dateKnown: boolean;
	/** True unless the filename says z.n. */
	contributorKnown: boolean;
	/** An unexplained leading code such as "OWNP" or "SP". */
	prefixCode: string | null;
	/** The duplicate marker, when the filename carries one. */
	indexSuffix: number | null;
}

/** Removes a file extension, tolerating the doubled dot in "z.d..jpg". */
export function stripExtension(filename: string): string {
	return filename.replace(/\.(jpe?g|png|gif|webp)$/i, '');
}

/**
 * Splits a filename into its conventional roles.
 *
 * Roles are assigned by pattern rather than by position, because the corpus contains
 * files where the donor and the date appear the other way round
 * ("Hoogboom - Hoogboomsesteenweg - 08.01.2015 - Johan Van Elst.jpg").
 */
export function splitFilename(filename: string): FilenameParts {
	const base = stripExtension(filename).trim();
	const rawSegments = base
		.split(SEGMENT_SEPARATOR)
		.map((segment) => segment.trim())
		.filter((segment) => segment !== '');

	const consumed = new Set<number>();

	// A duplicate marker can be attached to any segment - "Kasteel Op den Wal_5" on the
	// description, "z.d (11)" on the date - so it is stripped before a segment is
	// classified, and the first one found is reported.
	let indexSuffix: number | null = null;
	const cleaned = rawSegments.map((segment) => {
		const match = segment.match(UNAMBIGUOUS_INDEX);
		if (!match) return segment;

		const digits = match[1] ?? match[2];
		const parsed = Number.parseInt(digits, 10);
		if (indexSuffix === null && !Number.isNaN(parsed)) indexSuffix = parsed;

		return segment.replace(UNAMBIGUOUS_INDEX, '').trim();
	});

	let dateToken: string | null = null;
	let dateKnown = true;
	let contributor: string | null = null;
	let contributorKnown = true;

	// Scan from the end: the date and the donor live at the tail of the convention.
	for (let i = cleaned.length - 1; i >= 0 && dateToken === null; i -= 1) {
		if (DATE_TOKEN.test(cleaned[i])) {
			dateToken = cleaned[i];
			dateKnown = !/^z\.?d\.?$/i.test(cleaned[i]);
			consumed.add(i);
		} else if (ANONYMOUS_TOKEN.test(cleaned[i])) {
			// An anonymity marker at the tail: the donor is known to be unknown.
			contributorKnown = false;
			consumed.add(i);
		}
	}

	// The donor is the last unconsumed segment that looks like a person rather than a place,
	// but only when there is still a segment before it to carry the description.
	for (let i = cleaned.length - 1; i >= 1; i -= 1) {
		if (consumed.has(i)) continue;

		const segment = cleaned[i];

		if (ANONYMOUS_TOKEN.test(segment)) {
			contributorKnown = false;
			consumed.add(i);
			continue;
		}

		if (looksLikePersonName(segment)) {
			contributor = stripTrailingIndex(segment);
			consumed.add(i);
		}
		break;
	}

	if (!contributorKnown) contributor = null;

	let prefixCode: string | null = null;
	const firstUnconsumed = cleaned.findIndex((_, i) => !consumed.has(i));
	if (firstUnconsumed !== -1) {
		const candidate = cleaned[firstUnconsumed].toUpperCase();
		if (KNOWN_PREFIX_CODES.has(candidate)) {
			prefixCode = candidate;
			consumed.add(firstUnconsumed);
		}
	}

	const placeSegments = rawSegments
		.map((text, index) => ({ text, index }))
		.filter(({ index }) => !consumed.has(index));

	return {
		base,
		segments: rawSegments,
		placeSegments,
		contributor,
		dateToken,
		dateOfAcquisition: toAcquisitionDate(dateToken),
		dateKnown,
		contributorKnown,
		prefixCode,
		indexSuffix
	};
}

/**
 * Whether a segment reads as a person's name rather than a place.
 *
 * Deliberately conservative: two or more capitalised words, none of which is a
 * street-shaped word or a digit. Getting this wrong in the permissive direction would
 * discard a place segment, so anything ambiguous is left as place text.
 */
function looksLikePersonName(segment: string): boolean {
	const withoutIndex = stripTrailingIndex(segment);
	const words = withoutIndex.split(/\s+/).filter(Boolean);

	if (words.length < 2 || words.length > 5) return false;
	if (/\d/.test(withoutIndex)) return false;

	const normalized = normalizePlace(withoutIndex);
	if (normalized === '') return false;

	// A segment containing a street-shaped word is a place, whatever its capitalisation.
	if (
		/(straat|steenweg|baan|dreef|laan|lei|plein|pad|weg|hof|bos|park|kerk|kasteel)\b/.test(
			normalized
		)
	) {
		return false;
	}

	// Every word starts with a capital, or is a Dutch name particle (Van, De, Den, Ter).
	return words.every(
		(word) => /^[A-ZÀ-Þ]/.test(word) || /^(van|de|den|der|ter|te|het|du|le)$/i.test(word)
	);
}

/** Removes a trailing duplicate marker such as the "2" in "Raymond Roeland 2". */
function stripTrailingIndex(segment: string): string {
	return segment.replace(UNAMBIGUOUS_INDEX, '').replace(CONTRIBUTOR_INDEX, '').trim();
}

/** Normalizes a full date token to dd.mm.yyyy, or null for anything else. */
function toAcquisitionDate(dateToken: string | null): string | null {
	if (dateToken === null) return null;

	const match = dateToken.match(FULL_DATE);
	if (!match) return null;

	const [, day, month, year] = match;
	return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
}

/** The folder context of an image, and the district it implies. */
export interface PathContext {
	folderSegments: string[];
	/**
	 * True for the `Wedstrijden GZVKA/` subtree, which is prize-draw photography of
	 * present-day events and sponsors rather than photographs of places. Address
	 * extraction should be down-weighted there rather than applied.
	 */
	topicalOnly: boolean;
}

/** Splits a repository-relative image path into its folder chain. */
export function splitPathContext(relativePath: string): PathContext {
	const parts = relativePath.split('/').filter(Boolean);
	const folderSegments = parts.slice(0, -1);

	return {
		folderSegments,
		topicalOnly: folderSegments.some((segment) => /^wedstrijden gzvka$/i.test(segment.trim()))
	};
}
