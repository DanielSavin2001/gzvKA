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
 *
 * The day and month are separated by a dot; the month and the year by a dot or a space.
 * The space is not a shape anybody chose - it is three filenames where the last dot was
 * typed as a space ("Plantijn_3 - Robert Vingerhoed - 18.02 2015") - but a stamp the
 * pattern does not recognise is not merely unread. It falls through to the year rules,
 * which then file the photograph under the year the archive received it.
 */
const DATE_TOKEN = /^(?:z\.?d\.?|\d{1,2}\.\d{1,2}[. ]\d{4}|\d{1,2}\.\d{4}|\d{4})$/i;

/**
 * The first year this archive received anything.
 *
 * The earliest donation stamp in the corpus is 15.11.2013, and the distribution climbs
 * from there: 1 in 2013, 367 in 2014, 507 in 2015, and on to 70 in 2025. Nothing was
 * donated before the archive existed, so a dd.mm.yyyy dated 2012 or earlier is a date
 * about the photograph rather than about the archive - the 1947 gymnastics display, the
 * 1976 Tajje centenary - and must keep dating the picture.
 *
 * This bound is what lets the rules below be generous about the shape of a donation stamp
 * without ever stealing a year from a photograph that is genuinely old.
 */
export const ARCHIVE_OPENED = 2013;

/**
 * A donation stamp with a sequence number or a note stuck onto it: "01.02.2017 2",
 * "26.09.2019 7", "07.12.2015 NIEUW".
 *
 * When one photograph is scanned in several parts the archive numbers them after the date
 * rather than before it, and that number used to make the whole segment unreadable:
 * `DATE_TOKEN` is anchored, so "01.02.2017 2" is not a date, and the scan then walked past
 * the donor as well. The two files below differ by two characters and by everything else:
 *
 *   Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017.jpg     donor, received 01.02.2017
 *   Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017 2.jpg   no donor, no date, "Jaartal 2017"
 *
 * The second is a photograph of a horse and cart in front of a shop with hand-painted
 * signage. Nothing about it is from 2017 except the day somebody handed it over.
 */
const STAMP_WITH_SEQUENCE = /^(\d{1,2}\.\d{1,2}[. ]\d{4})\s+(\d{1,3}|NIEUW)$/i;

/** The archive's "anonymous donor" marker. */
const ANONYMOUS_TOKEN = /^z\.?n\.?$/i;

/**
 * Contributors that are institutions rather than people, keyed by their normalized form.
 *
 * {@link looksLikePersonName} requires two capitalised words, so a single-word credit like
 * "Hoghescote" was never recognised as the donor. It then stayed in the place text, where
 * it matched the gazetteer alias for Hoogboom - 53 photographs carried a district they are
 * not of, only because of who donated them. The values are the archive's canonical donor
 * spelling, so "Heemkring Hoghescote", bare "Hoghescote" and "HH" all land on one donor.
 */
const INSTITUTIONAL_CONTRIBUTORS = new Map<string, string>([
	['hoghescote', 'Heemkring Hoghescote'],
	['heemkring hoghescote', 'Heemkring Hoghescote'],
	['hh', 'Heemkring Hoghescote']
]);

/** A full donation date, which is the only form that yields dateOfAcquisition. */
const FULL_DATE = /^(\d{1,2})\.(\d{1,2})[. ](\d{4})$/;

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
		// A sequence number stuck to the stamp is peeled off first. Without this the
		// segment is not a date, is not a person either, and the loop below stops on it -
		// so one numbered scan lost its donor, its donation date and its title all at once,
		// and gained the donation year as its own.
		const stamped = donationStamp(cleaned[i], i === cleaned.length - 1);
		const candidate = stamped?.date ?? cleaned[i];

		if (DATE_TOKEN.test(candidate)) {
			dateToken = candidate;
			dateKnown = !/^z\.?d\.?$/i.test(candidate);
			consumed.add(i);
			// The number was a duplicate marker all along, so it is recorded as one rather
			// than discarded with the rest of the segment.
			if (indexSuffix === null && stamped?.index != null) indexSuffix = stamped.index;
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

		// "z.n." already said the donor is unknown, so whatever precedes it is not the donor.
		// Consuming it anyway ate the caption twice over: the segment was taken as a
		// contributor and then discarded by the `contributorKnown` check below, so
		// "Nieuwe Wijk - St. Jozefkapel - zn - zd" lost the chapel from its title and from
		// everything derived from it.
		if (!contributorKnown) break;

		const institution = INSTITUTIONAL_CONTRIBUTORS.get(normalizePlace(stripTrailingIndex(segment)));
		if (institution) {
			contributor = institution;
			consumed.add(i);
		} else if (looksLikePersonName(segment)) {
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
 * Exported so the archive index can drop a donor from a photograph's display title in the
 * cases where the date convention broke down and the donor was never separated out.
 *
 * Deliberately conservative: two or more capitalised words, none of which is a
 * street-shaped word or a digit. Getting this wrong in the permissive direction would
 * discard a place segment, so anything ambiguous is left as place text.
 */
export function looksLikePersonName(segment: string): boolean {
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

/**
 * The donation stamp inside a segment that also carries a sequence number, or null.
 *
 * Guarded twice, and both guards are load-bearing.
 *
 * `isLast` is the first. The same shape appears mid-filename and means the opposite
 * there: every one of the twenty-five "Tajje 100 - 09.07.1976 NN - Hugo De Hoon - zd"
 * photographs carries the date of the 1976 centenary in a middle segment, and 1976 is
 * exactly the year those pictures should be filed under. In the corpus the split is
 * total - every bare-number stamp in the last segment is a donation, every one in a
 * middle segment is an event - with no counter-example either way.
 *
 * {@link ARCHIVE_OPENED} is the second, and it is the one that will still be right when
 * the corpus grows. A stamp from before the archive existed cannot be a donation.
 */
function donationStamp(
	segment: string,
	isLast: boolean
): { date: string; index: number | null } | null {
	if (!isLast) return null;

	const match = STAMP_WITH_SEQUENCE.exec(segment);
	if (!match) return null;

	const year = Number(FULL_DATE.exec(match[1])?.[3]);
	if (!Number.isFinite(year) || year < ARCHIVE_OPENED) return null;

	const sequence = Number.parseInt(match[2], 10);
	return { date: match[1], index: Number.isNaN(sequence) ? null : sequence };
}

/**
 * The year a filename's date slot says the archive RECEIVED the photograph, or null.
 *
 * The index build asks this before it believes a year read out of the name. Reading the
 * date slot rather than looking for a date anywhere in the filename is the whole of the
 * rule: sixty-two photographs carry a year that also appears in some date stamp, and
 * twenty-eight of them are correctly dated by it, because in those the stamp sits in the
 * description - a gymnastics display on 06.07.1947, the Tajje centenary on 09.07.1976.
 * Position in the segment chain tells a donation from an event; the presence of a stamp
 * does not.
 *
 * Bounded by {@link ARCHIVE_OPENED} for the same reason, and because the date slot may
 * legitimately hold a bare year: "Bunderhof_16 - 1909" and six "Jan Ketelaars N -
 * Hoghescote - 1988" are dated by theirs, and should stay that way.
 */
export function donationYear(parts: FilenameParts): string | null {
	if (!parts.dateToken) return null;

	const year = /(\d{4})$/.exec(parts.dateToken)?.[1];
	if (!year || Number(year) < ARCHIVE_OPENED) return null;

	return year;
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
