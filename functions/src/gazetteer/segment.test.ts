import { ARCHIVE_OPENED, donationYear, splitFilename } from './segment';

/**
 * The rule these hold: the day the archive was HANDED a photograph is not the day the
 * photograph was taken.
 *
 * The archive writes both kinds of date into its filenames and tells them apart by where
 * they sit. A stamp in the last segment is a donation; the same shape in the middle is an
 * event the picture is of. Until this was read properly, one numbered scan lost its donor,
 * its donation date and its title in one go, and was filed under the year somebody handed
 * it over:
 *
 *   Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017.jpg     donor, received 01.02.2017
 *   Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017 2.jpg   nothing, and "Jaartal 2017"
 *
 * Two characters apart, and the second is a horse and cart in front of a shop with
 * hand-painted signage. 122 photographs were filed under 2014 or later this way, which
 * made the 2010s the tallest bar on a timeline of historic Kapellen.
 */

describe('a donation stamp with a sequence number', () => {
	it('reads the date, the donor and the sequence out of the numbered twin', () => {
		const parts = splitFilename('Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017 2.jpg');

		expect(parts.dateOfAcquisition).toBe('01.02.2017');
		expect(parts.contributor).toBe('Omer Cleiren');
		expect(parts.indexSuffix).toBe(2);
	});

	it('agrees with the un-numbered twin about everything else', () => {
		const numbered = splitFilename('Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017 2.jpg');
		const plain = splitFilename('Dorpsstraat - Hoelen - Omer Cleiren - 01.02.2017.jpg');

		expect(numbered.dateOfAcquisition).toBe(plain.dateOfAcquisition);
		expect(numbered.contributor).toBe(plain.contributor);
		expect(numbered.placeSegments.map((segment) => segment.text)).toEqual(
			plain.placeSegments.map((segment) => segment.text)
		);
	});

	it('reads a note where the number would be', () => {
		// Three files say NIEUW - the archive's marker for a rescan - and it broke them the
		// same way a digit did.
		const parts = splitFilename('Dorpsstraat - Omer Cleiren - 07.12.2015 NIEUW.jpg');

		expect(parts.dateOfAcquisition).toBe('07.12.2015');
		expect(parts.contributor).toBe('Omer Cleiren');
	});

	it('handles a whole numbered run', () => {
		for (let n = 1; n <= 9; n += 1) {
			const parts = splitFilename(`Antwerpsesteenweg - Omer Cleiren - 26.09.2019 ${n}.jpg`);
			expect(parts.dateOfAcquisition).toBe('26.09.2019');
			expect(parts.contributor).toBe('Omer Cleiren');
		}
	});

	it('leaves an EVENT date in a middle segment alone', () => {
		// This is the counter-example the rule exists to not break. 09.07.1976 is the day
		// of the Tajje centenary, the photographs ARE of that day, and 1976 is the right
		// year for all twenty-five of them. "zd" at the tail is the date slot saying the
		// archive does not know when it was given the picture.
		const parts = splitFilename('Tajje 100 - 09.07.1976 01 - Hugo De Hoon - zd.jpg');

		expect(parts.dateOfAcquisition).toBeNull();
		expect(parts.dateKnown).toBe(false);
		expect(parts.contributor).toBe('Hugo De Hoon');
		expect(donationYear(parts)).toBeNull();
	});

	it('refuses a stamp from before the archive existed', () => {
		// The position guard is what the corpus proves today; this is the one that will
		// still be right when the corpus grows. Nothing was donated in 1947.
		const parts = splitFilename('Turnfeest - Philippe Speth - 06.07.1947 2.jpg');

		expect(parts.dateOfAcquisition).toBeNull();
	});

	it('takes the archive at its word about when it opened', () => {
		expect(ARCHIVE_OPENED).toBe(2013);

		const first = splitFilename('Dorpsstraat - Iemand Anders - 15.11.2013 1.jpg');
		expect(first.dateOfAcquisition).toBe('15.11.2013');
	});
});

describe('a donation stamp with a space where the dot belongs', () => {
	it('reads 18.02 2015 as a date rather than as a year', () => {
		const parts = splitFilename('Plantijn_3 - Robert Vingerhoed - 18.02 2015.jpg');

		expect(parts.dateOfAcquisition).toBe('18.02.2015');
		expect(parts.contributor).toBe('Robert Vingerhoed');
	});
});

describe('donationYear', () => {
	it('names the year the archive received the photograph', () => {
		expect(
			donationYear(splitFilename('Dorpsstraat - Hoelen - O. Cleiren - 01.02.2017 2.jpg'))
		).toBe('2017');
	});

	it('says nothing about a photograph whose date slot is old', () => {
		// A bare year in the date slot dates the picture: "Bunderhof_16 - 1909" and the six
		// "Jan Ketelaars N - Hoghescote - 1988" are right as they stand.
		expect(donationYear(splitFilename('Bunderhof_16 - 1909.jpg'))).toBeNull();
		expect(donationYear(splitFilename('Jan Ketelaars 6 - Hoghescote - 1988.jpg'))).toBeNull();
	});

	it('says nothing when there is no date slot at all', () => {
		expect(donationYear(splitFilename('Dorpsstraat - optocht.jpg'))).toBeNull();
	});

	it('reads the year out of a bare-year date slot the archive filled in recently', () => {
		// The shape that the old guard could not see: no dd.mm.yyyy, so no acquisition
		// date, so nothing stopped the year being taken as the photograph's.
		expect(donationYear(splitFilename('Iets - Iemand Anders - 2015.jpg'))).toBe('2015');
	});

	it('reads a month-year date slot too', () => {
		expect(
			donationYear(splitFilename('Kasteel Op den Wal in de sneeuw - H. De Hoon - 12.2014.jpg'))
		).toBe('2014');
	});
});
