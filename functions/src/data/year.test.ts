import {
	canonicalYear,
	decadeBandOf,
	isYearSpan,
	readYearSpan,
	startYear
} from '../../../sharedModels/year';

/**
 * A year that is two years.
 *
 * Not a hypothetical: the dating form under every photograph tells residents, in Dutch,
 * "Twijfel je tussen twee jaren, schrijf dan bijvoorbeeld 1957-1958", and three write paths
 * accept that shape. Everything that READ it used `Number()`, and `Number('1957-1958')` is
 * NaN - which is falsy, so it did not sort last, it broke the comparator.
 */

describe('reading a year', () => {
	it('reads a plain year', () => {
		expect(readYearSpan('1935')).toEqual({ from: 1935, to: 1935 });
		expect(startYear('1935')).toBe(1935);
		expect(isYearSpan('1935')).toBe(false);
	});

	it('reads a school year at its first year', () => {
		// A Flemish school year starts in September and the class photograph is taken early
		// in it, so 1966-1967 is a photograph from 1966.
		expect(readYearSpan('1966-1967')).toEqual({ from: 1966, to: 1967 });
		expect(startYear('1966-1967')).toBe(1966);
		expect(isYearSpan('1966-1967')).toBe(true);
	});

	it('reads the spaced form a curator is allowed to type', () => {
		// `photo-edit.ts` accepts /^\d{4}(\s?-\s?\d{4})?$/, so "1935 - 1936" reaches the data.
		expect(startYear('1935 - 1936')).toBe(1935);
		expect(startYear(' 1935 ')).toBe(1935);
	});

	it('has nothing to say about what is not a year', () => {
		for (const value of [undefined, null, '', 'onbekend', '19', '19355', '1935/1936', 'z.d.']) {
			expect(startYear(value)).toBeNull();
		}
	});

	it('refuses a span that runs backwards', () => {
		// A typo, not a span. Anchoring it to 1966 would imply reasoning nobody did.
		expect(readYearSpan('1966-1965')).toBeNull();
		expect(startYear('1966-1965')).toBeNull();
	});

	it('writes a span the one way the archive stores it', () => {
		expect(canonicalYear('1935 - 1936')).toBe('1935-1936');
		expect(canonicalYear('1935-1935')).toBe('1935');
		expect(canonicalYear(' 1935 ')).toBe('1935');
		expect(canonicalYear('onbekend')).toBe('onbekend');
	});
});

describe('sorting and banding', () => {
	it('never hands back NaN', () => {
		// The whole defect in one assertion. `Number('1966-1967')` is NaN, `NaN - NaN` is NaN,
		// and NaN is falsy - so `ay - by || ...` fell through to the next comparison instead
		// of ordering, giving a comparator that is not transitive. The photo page's previous
		// and next arrows walk exactly that list.
		expect(Number('1966-1967')).toBeNaN();
		expect(startYear('1966-1967')).toBe(1966);
		expect(Number.isNaN(startYear('1966-1967') as number)).toBe(false);
	});

	it('sorts a span among the single years, not after them', () => {
		const years = ['1970', '1966-1967', '1965', undefined];
		const sorted = [...years].sort(
			(a, b) =>
				(startYear(a) ?? Number.POSITIVE_INFINITY) - (startYear(b) ?? Number.POSITIVE_INFINITY)
		);

		expect(sorted).toEqual(['1965', '1966-1967', '1970', undefined]);
	});

	it('bands a span by its first year', () => {
		expect(decadeBandOf('1966-1967')).toBe('1960');
		// The one that moves: a 1969-1970 class photograph is a photograph from 1969.
		expect(decadeBandOf('1969-1970')).toBe('1960');
		expect(decadeBandOf('1970')).toBe('1970');
	});

	it('keeps everything before 1900 in one band, the way the timeline draws it', () => {
		expect(decadeBandOf('1899')).toBe('voor-1900');
		expect(decadeBandOf('1830-1905')).toBe('voor-1900');
		expect(decadeBandOf('1900')).toBe('1900');
		expect(decadeBandOf('geen')).toBeNull();
	});
});
