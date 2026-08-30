import {
	canDecide,
	EARLIEST_YEAR,
	PhotoFactError,
	readPhotoFact,
	readRejectionReason,
	readYear
} from '../../../sharedModels/photo-fact';

/**
 * The rule these tests exist to hold: the year field is the part a machine sorts by.
 *
 * "rond 1950?", "jaren 60" and "zomer 1972" are all real knowledge and none of them can go
 * on an axis. If any of them gets into `year`, the timeline either drops the photograph
 * silently or puts it somewhere invented - so they belong in the message, where a curator
 * reads them and decides.
 */

/** A year that will still be in the past long after this is written. */
const THIS_YEAR = 2026;

describe('readYear', () => {
	it('accepts a plain four-digit year', () => {
		expect(readYear('1957', THIS_YEAR)).toBe('1957');
	});

	it('trims the surrounding whitespace a form leaves behind', () => {
		expect(readYear('  1957 ', THIS_YEAR)).toBe('1957');
	});

	it('accepts a range, because knowing it was one of two winters is knowing something', () => {
		expect(readYear('1935-1936', THIS_YEAR)).toBe('1935-1936');
	});

	it('accepts the spaced and en-dashed ways people actually type a range', () => {
		expect(readYear('1935 - 1936', THIS_YEAR)).toBe('1935-1936');
		expect(readYear('1935–1936', THIS_YEAR)).toBe('1935-1936');
	});

	it('collapses a range whose ends are the same year', () => {
		expect(readYear('1957-1957', THIS_YEAR)).toBe('1957');
	});

	it('refuses a range that runs backwards, which is a typo and not a claim', () => {
		expect(() => readYear('1960-1955', THIS_YEAR)).toThrow(PhotoFactError);
	});

	it('refuses prose, however well meant', () => {
		for (const written of ['rond 1950', 'jaren 60', 'zomer 1972', 'ca. 1930', '1950?']) {
			expect(() => readYear(written, THIS_YEAR)).toThrow(PhotoFactError);
		}
	});

	it('refuses a two-digit year, which is ambiguous by a century', () => {
		expect(() => readYear('57', THIS_YEAR)).toThrow(PhotoFactError);
	});

	it('refuses a year before photography existed', () => {
		expect(() => readYear(String(EARLIEST_YEAR - 1), THIS_YEAR)).toThrow(PhotoFactError);
	});

	it('refuses a year in the future', () => {
		expect(() => readYear(String(THIS_YEAR + 1), THIS_YEAR)).toThrow(PhotoFactError);
	});

	it('accepts the current year, because somebody may photograph Kapellen today', () => {
		expect(readYear(String(THIS_YEAR), THIS_YEAR)).toBe(String(THIS_YEAR));
	});

	it('refuses an empty answer rather than storing a blank year', () => {
		for (const empty of ['', '   ', null, undefined, 1957]) {
			expect(() => readYear(empty, THIS_YEAR)).toThrow(PhotoFactError);
		}
	});
});

describe('readPhotoFact', () => {
	it('reads a complete suggestion', () => {
		const read = readPhotoFact(
			{
				photoId: 'dorpsstraat-kerk',
				photoTitle: 'Dorpsstraat - Kerk',
				year: '1963',
				message: 'De winter van 63, de vijver lag dicht.'
			},
			THIS_YEAR
		);

		expect(read).toEqual({
			photoId: 'dorpsstraat-kerk',
			photoTitle: 'Dorpsstraat - Kerk',
			year: '1963',
			message: 'De winter van 63, de vijver lag dicht.'
		});
	});

	it('lets somebody who simply knows say nothing else', () => {
		const read = readPhotoFact({ photoId: 'x', year: '1963' }, THIS_YEAR);
		expect(read.message).toBe('');
	});

	it('falls back to the id when no title was sent, so a queue still reads', () => {
		expect(readPhotoFact({ photoId: 'x', year: '1963' }, THIS_YEAR).photoTitle).toBe('x');
	});

	it('refuses a suggestion about no photograph at all', () => {
		expect(() => readPhotoFact({ year: '1963' }, THIS_YEAR)).toThrow(PhotoFactError);
	});

	it('caps the message rather than storing whatever arrives', () => {
		const read = readPhotoFact(
			{ photoId: 'x', year: '1963', message: 'a'.repeat(5000) },
			THIS_YEAR
		);
		expect(read.message.length).toBe(2000);
	});
});

describe('canDecide', () => {
	it('knows the three states', () => {
		expect(canDecide('pending')).toBe(true);
		expect(canDecide('accepted')).toBe(true);
		expect(canDecide('rejected')).toBe(true);
	});

	it('refuses anything else, including what a query string might carry', () => {
		for (const value of ['approved', '', null, undefined, 1, {}]) {
			expect(canDecide(value)).toBe(false);
		}
	});
});

describe('readRejectionReason', () => {
	it('keeps a reason', () => {
		expect(readRejectionReason(' Klopt niet met de auto op de foto. ')).toBe(
			'Klopt niet met de auto op de foto.'
		);
	});

	it('treats a blank reason as none, so the service can insist on one', () => {
		expect(readRejectionReason('   ')).toBeUndefined();
		expect(readRejectionReason(undefined)).toBeUndefined();
	});
});
