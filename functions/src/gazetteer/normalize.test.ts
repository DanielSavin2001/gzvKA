import { damerauLevenshtein, diceCoefficient } from './distance';
import { corePlace, normalizePlace, stripDiacritics, streetSuffixFamily } from './normalize';

describe('stripDiacritics', () => {
	it('removes accents from names that appear in the archive', () => {
		expect(stripDiacritics('Café')).toBe('Cafe');
		expect(stripDiacritics('André Van Ophem')).toBe('Andre Van Ophem');
		expect(stripDiacritics('België')).toBe('Belgie');
	});
});

describe('normalizePlace', () => {
	it('folds the accented names in the corpus', () => {
		expect(normalizePlace('Café De Pancras')).toBe('cafe de pancras');
		expect(normalizePlace('75 jaar België')).toBe('75 jaar belgie');
	});

	it('lowercases the IJ spellings without needing a special case', () => {
		expect(normalizePlace('IJzerenweglaan')).toBe('ijzerenweglaan');
		expect(normalizePlace('IJjzerenweglaan')).toBe('ijjzerenweglaan');
		// The capital-i typo observed in "UItlegger".
		expect(normalizePlace('UItlegger')).toBe('uitlegger');
	});

	it('agrees on abbreviations whether or not they are followed by a space', () => {
		expect(normalizePlace('Chr. Pallemansstraat')).toBe('christiaan pallemansstraat');
		expect(normalizePlace('Chr.Pallemansstraat')).toBe('christiaan pallemansstraat');
		expect(normalizePlace('Christiaan Pallemansstraat')).toBe('christiaan pallemansstraat');
	});

	it('expands the saint abbreviation', () => {
		expect(normalizePlace('St. Jacobuskerk')).toBe('sint jacobuskerk');
		expect(normalizePlace('Sint-Jacobuskerk')).toBe('sint jacobuskerk');
	});

	it('expands OLV to the full Dutch form', () => {
		expect(normalizePlace('OLV Fatima')).toBe('onze lieve vrouw fatima');
	});

	it('reads an ampersand as the word "en"', () => {
		expect(normalizePlace('Kerken & kapellen')).toBe('kerken en kapellen');
		expect(normalizePlace('Kerken en kapellen')).toBe('kerken en kapellen');
	});

	it('folds punctuation and index suffixes to spaces', () => {
		expect(normalizePlace('Kalmthoutsesteenweg_2')).toBe('kalmthoutsesteenweg 2');
		expect(normalizePlace('Kapelsestraat-Waterstraat')).toBe('kapelsestraat waterstraat');
		expect(normalizePlace("Klasfoto's")).toBe('klasfotos');
	});

	it('does not expand "kon", which is ambiguous between Koning and Koningin', () => {
		// Expanding it either way would manufacture a fact; corePlace removes it instead.
		expect(normalizePlace('Kon. Astridlaan')).toBe('kon astridlaan');
	});

	it('returns an empty string for empty input', () => {
		expect(normalizePlace('')).toBe('');
		expect(normalizePlace(null)).toBe('');
	});
});

describe('corePlace', () => {
	it('collapses the three royal spellings that occur in the corpus', () => {
		expect(corePlace('Kon. Astridlaan')).toBe('astridlaan');
		expect(corePlace('Kon.Astridlaan')).toBe('astridlaan');
		expect(corePlace('Astridlaan')).toBe('astridlaan');
		expect(corePlace('Koningin Astridlaan')).toBe('astridlaan');
	});

	it('collapses the Albertlei spellings', () => {
		expect(corePlace('Koning Albertlei')).toBe('albertlei');
		expect(corePlace('Kon. Albertlei')).toBe('albertlei');
		expect(corePlace('Albertlei')).toBe('albertlei');
	});

	it('collapses the saint spellings', () => {
		expect(corePlace('St. Jacobuskerk')).toBe('jacobuskerk');
		expect(corePlace('Sint-Jacobuskerk')).toBe('jacobuskerk');
	});

	it('strips honorifics only at the start, never inside the name', () => {
		expect(corePlace('Pastoor Vandenhoudtstraat')).toBe('vandenhoudtstraat');
		// "Vrouw" here is part of the name proper, not a leading honorific.
		expect(corePlace('Kerk OLV van Vrede')).toBe('kerk onze lieve vrouw van vrede');
	});

	it('never strips a name down to nothing', () => {
		expect(corePlace('Sint')).toBe('sint');
		expect(corePlace('Kon.')).toBe('kon');
	});
});

describe('streetSuffixFamily', () => {
	it('reports the same family for both steenweg spellings', () => {
		expect(streetSuffixFamily('hoogboomsesteenweg')).toBe('steenweg');
		expect(streetSuffixFamily('hoogboomsteenweg')).toBe('steenweg');
		expect(streetSuffixFamily('kalmthoutsesteenweg')).toBe('steenweg');
	});

	it('separates the families that fuzzy matching must not cross', () => {
		expect(streetSuffixFamily('mastenbos')).toBe('bos');
		expect(streetSuffixFamily('mastenhof')).toBe('hof');
		expect(streetSuffixFamily('zilverhof')).toBe('hof');
		expect(streetSuffixFamily('zilverenhoek')).toBe('hoek');
	});

	it('recognises the common street endings', () => {
		expect(streetSuffixFamily('dorpsstraat')).toBe('straat');
		expect(streetSuffixFamily('hoevensebaan')).toBe('baan');
		expect(streetSuffixFamily('jagersdreef')).toBe('dreef');
		expect(streetSuffixFamily('koningin astridlaan')).toBe('laan');
		expect(streetSuffixFamily('guyotlei')).toBe('lei');
		expect(streetSuffixFamily('loopgravenpad')).toBe('pad');
		expect(streetSuffixFamily('stationsplein')).toBe('plein');
	});

	it('returns null for a name that is not street-shaped', () => {
		expect(streetSuffixFamily('louwke poep')).toBeNull();
		expect(streetSuffixFamily('de sterre')).toBeNull();
	});
});

describe('damerauLevenshtein', () => {
	it('scores the real corpus misspellings as one or two edits', () => {
		// Every pair below is an actual spelling variant observed in the archive.
		expect(damerauLevenshtein('doprsstraat', 'dorpsstraat')).toBe(1); // transposition
		expect(damerauLevenshtein('dorpstraat', 'dorpsstraat')).toBe(1); // deletion
		expect(damerauLevenshtein('ijjzerenweglaan', 'ijzerenweglaan')).toBe(1);
		expect(damerauLevenshtein('kalthoutsesteenweg', 'kalmthoutsesteenweg')).toBe(1);
		expect(damerauLevenshtein('kalmrhoutsesteenweg', 'kalmthoutsesteenweg')).toBe(1);
		expect(damerauLevenshtein('kalmhousesteenweg', 'kalmthoutsesteenweg')).toBe(2);
		expect(damerauLevenshtein('hoogboomsesteenweg', 'hoogboomsteenweg')).toBe(2);
	});

	it('keeps genuinely different streets far apart', () => {
		// Verified against an independent implementation. Note akkerstraat/kerkstraat is
		// three edits, not four: both share the "straat" family, so it is the edit
		// threshold alone that has to reject this pair, and at length 11 that threshold
		// is 2. The margin here is one edit, which is worth knowing.
		expect(damerauLevenshtein('akkerstraat', 'kerkstraat')).toBe(3);
		expect(damerauLevenshtein('beukenhof', 'bunderhof')).toBe(4);
		expect(damerauLevenshtein('irishof', 'lusthof')).toBe(4);
	});

	it('scores a near miss that only the suffix-family guard rejects', () => {
		// Two edits at nine characters would otherwise pass the edit threshold; it is the
		// bos/hof family difference that keeps a wood from matching a manor.
		expect(damerauLevenshtein('mastenbos', 'mastenhof')).toBe(2);
	});

	it('handles the trivial cases', () => {
		expect(damerauLevenshtein('', '')).toBe(0);
		expect(damerauLevenshtein('abc', 'abc')).toBe(0);
		expect(damerauLevenshtein('', 'abc')).toBe(3);
		expect(damerauLevenshtein('abc', '')).toBe(3);
	});

	it('is symmetric', () => {
		expect(damerauLevenshtein('kalmhousesteenweg', 'kalmthoutsesteenweg')).toBe(
			damerauLevenshtein('kalmthoutsesteenweg', 'kalmhousesteenweg')
		);
	});

	it('returns max + 1 when the ceiling is exceeded, without finishing', () => {
		expect(damerauLevenshtein('akkerstraat', 'kerkstraat', 2)).toBe(3);
		// Under the ceiling the exact distance is still returned.
		expect(damerauLevenshtein('dorpstraat', 'dorpsstraat', 2)).toBe(1);
	});
});

describe('diceCoefficient', () => {
	it('rates an identical pair as 1', () => {
		expect(diceCoefficient('dorpsstraat', 'dorpsstraat')).toBe(1);
	});

	it('rates a single transposition well below 1, which is why it cannot be the accept metric', () => {
		const dice = diceCoefficient('doprsstraat', 'dorpsstraat');
		expect(dice).toBeGreaterThan(0.65);
		expect(dice).toBeLessThan(0.75);
	});

	it('passes the real misspelling through the 0.55 pre-filter', () => {
		expect(diceCoefficient('kalmhousesteenweg', 'kalmthoutsesteenweg')).toBeGreaterThan(0.55);
		expect(diceCoefficient('hoogboomsesteenweg', 'hoogboomsteenweg')).toBeGreaterThan(0.55);
	});

	it('rates unrelated names low', () => {
		expect(diceCoefficient('akkerstraat', 'guyotlei')).toBeLessThan(0.3);
	});

	it('handles strings too short to have bigrams', () => {
		expect(diceCoefficient('a', 'a')).toBe(1);
		expect(diceCoefficient('a', 'b')).toBe(0);
		expect(diceCoefficient('', '')).toBe(1);
	});
});
