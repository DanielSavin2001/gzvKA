import { yearFromFilename } from './photo-year';

describe('yearFromFilename', () => {
	it('reads a plain year', () => {
		expect(yearFromFilename('Dorpsstraat - optocht - 1967.jpg')).toBe('1967');
		expect(yearFromFilename('Kaart Kapellen 1892.jpg')).toBe('1892');
	});

	it('takes the later year of a period', () => {
		// The photograph is of the 1905 festivities, not of the 1830 revolution. Eight
		// photographs of a street party sat in the 1830s because of this.
		expect(yearFromFilename('75 jaar Belgie - Onafhankelijkheidsfeest 1830-1905.jpg')).toBe('1905');
		expect(yearFromFilename('Hoevensebaan - staakmolen 1801-1908.jpg')).toBe('1908');
	});

	it('handles the spacing the archive actually uses', () => {
		expect(yearFromFilename('Kapellen 1940 - 1945.jpg')).toBe('1945');
		expect(yearFromFilename('Kapellen 1940- 1945.jpg')).toBe('1945');
	});

	it('keeps a trailing counter out of it', () => {
		expect(yearFromFilename('75 jaar Belgie - Onafhankelijkheidsfeest 1830-1905 6.jpg')).toBe(
			'1905'
		);
	});

	it('does not read a backwards range as a period', () => {
		expect(yearFromFilename('iets 1975-1970.jpg')).toBe('1975');
	});

	it('ignores numbers that are not years', () => {
		expect(yearFromFilename('Kapelsestraat 113 - schuur.jpg')).toBeUndefined();
		expect(yearFromFilename('Akkerstraat 1 - zd.jpg')).toBeUndefined();
		// House numbers and counts must not become dates.
		expect(yearFromFilename('Hoevensebaan 2100.jpg')).toBeUndefined();
	});

	it('does not treat a date as a range', () => {
		// "09.07.1976" is one date; there is no second year to prefer.
		expect(yearFromFilename('Matheus Janssens - 09.07.1976.jpg')).toBe('1976');
	});
});
