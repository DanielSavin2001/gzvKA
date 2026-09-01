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

	it('keeps a season whole rather than reading it as a period', () => {
		// Belgium names a school year and a football season by the year they start in, and
		// the photograph is taken near the start of it. Taking the later year put a class
		// from the nineties in the 2000s.
		expect(
			yearFromFilename('Klasfoto - De Platanen 1999-2000 - 4de leerjaar - juf Chris.jpg')
		).toBe('1999-2000');
		expect(yearFromFilename('SP - Noorse VV - 1962-1963 - Kampioen - Hoghescote - zd.png')).toBe(
			'1962-1963'
		);
	});

	it('tells a season from a period by the gap alone', () => {
		// Two consecutive years is a season; anything wider is a period, and there is not one
		// counter-example either way in this archive.
		expect(yearFromFilename('iets 1969-1970.jpg')).toBe('1969-1970');
		expect(yearFromFilename('iets 1969-1971.jpg')).toBe('1971');
	});

	it('keeps the spacing of a season out of the answer', () => {
		expect(yearFromFilename('Klasfoto 1969 - 1970 - 2de leerjaar.jpg')).toBe('1969-1970');
	});

	it('still lets an anniversary of Belgium win over a season', () => {
		// Not a real filename, but the rule order matters more than the example: the
		// anniversary is when somebody stood there with a camera.
		expect(yearFromFilename('100 jaar Belgie - stoet 1929-1930.jpg')).toBe('1930');
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

describe('anniversaries of Belgium', () => {
	it('reads the centenary as 1930, not as the year it commemorates', () => {
		expect(
			yearFromFilename('100 jaar Belgie - Eeuwfeest - vrijwilligers 1830 - Hoghescote - zd.png')
		).toBe('1930');
	});

	it('reads the 75th as 1905, even when the picture is about an 1854 train', () => {
		expect(
			yearFromFilename(
				'75 jaar Belgie - Onafhankelijkheidsfeesten - eerste trein Kapellen 1854 - Hoghescote - zd.png'
			)
		).toBe('1905');
	});

	it('agrees with the filenames that already say the year themselves', () => {
		expect(yearFromFilename('100 jaar Belgie - Eeuwfeesten 1930 - Stationsstraat.jpg')).toBe(
			'1930'
		);
		expect(yearFromFilename('75 jaar Belgie - Onafhankelijkheidsfeest 1830-1905.jpg')).toBe('1905');
	});

	it('dates the ones that carried no year at all', () => {
		expect(
			yearFromFilename('100 jaar Belgie - Eeuwfeest - oude herberg - Hoghescote - zd.png')
		).toBe('1930');
	});

	it('handles the accented spelling the corpus also uses', () => {
		expect(yearFromFilename('100 jaar België_1 - Hugo De Hoon - 26.04.2015.jpg')).toBe('1930');
	});

	it('finds it mid-name, not only at the start', () => {
		expect(yearFromFilename('Kasteel Beaulieu - 100 jaar Belgie 1930 - Yolande.jpg')).toBe('1930');
	});

	it('refuses an anniversary that has not happened yet', () => {
		// Whatever "200 jaar Belgie" meant, it is not a photograph from 2030.
		expect(yearFromFilename('200 jaar Belgie - zn - zd.jpg')).toBeUndefined();
	});

	it('leaves other anniversaries alone, having no base year to add to', () => {
		// A golden wedding: the archive does not say whose, or when they married.
		expect(yearFromFilename('Frans Van Lent - 50 jarig huwelijk - zd.jpg')).toBeUndefined();
		// The festival year is already in the name and is the right answer.
		expect(yearFromFilename('Fanfare St Cecilia - Festival 1913 - 50 jaar.jpg')).toBe('1913');
	});

	it('does not fire on a person turning a hundred', () => {
		expect(yearFromFilename('Tajje 100 - 09.07.1976 01 - Hugo De Hoon - zd.jpg')).toBe('1976');
	});
});
