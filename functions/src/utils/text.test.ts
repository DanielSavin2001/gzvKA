import { compactKey, normalizeText, slugify, tokenize } from '../../../sharedModels/text';

describe('normalizeText', () => {
	it('returns an empty string for null, undefined and blank input', () => {
		expect(normalizeText(null)).toBe('');
		expect(normalizeText(undefined)).toBe('');
		expect(normalizeText('')).toBe('');
		expect(normalizeText('   ')).toBe('');
	});

	it('strips accents from Dutch and French place names in the archive', () => {
		expect(normalizeText('Café Pancras')).toBe('cafe pancras');
		expect(normalizeText('Les Châtaigniers')).toBe('les chataigniers');
		expect(normalizeText('Sint-Jozefkerk')).toBe('sint jozefkerk');
	});

	it('lowercases regardless of the original casing', () => {
		expect(normalizeText('KAPELSESTRAAT')).toBe('kapelsestraat');
		expect(normalizeText('KaPeLsEsTrAaT')).toBe('kapelsestraat');
	});

	it('keeps possessives as one word by dropping apostrophes without a separator', () => {
		expect(normalizeText("Klasfoto's")).toBe('klasfotos');
		expect(normalizeText("Foto's Deelnemers")).toBe('fotos deelnemers');
		expect(normalizeText('Klasfoto’s')).toBe('klasfotos');
	});

	it('expands the Dutch IJ digraph', () => {
		expect(normalizeText('Ĳzerenweglaan')).toBe('ijzerenweglaan');
		expect(normalizeText('ĳzer')).toBe('ijzer');
	});

	it('transliterates characters that NFD does not decompose', () => {
		expect(normalizeText('Straße')).toBe('strasse');
		expect(normalizeText('Ærenhof')).toBe('aerenhof');
		expect(normalizeText('Œuvre')).toBe('oeuvre');
		expect(normalizeText('Øst')).toBe('ost');
	});

	it('folds every run of punctuation into a single space', () => {
		expect(normalizeText('z.d..jpg')).toBe('z d jpg');
		expect(normalizeText('Kasteel Op den Wal_5')).toBe('kasteel op den wal 5');
		expect(normalizeText('1969-1970')).toBe('1969 1970');
		expect(normalizeText('Putte-Kapellen')).toBe('putte kapellen');
	});

	it('collapses repeated whitespace and trims the result', () => {
		expect(normalizeText('  Kasteel   Op  den Wal  ')).toBe('kasteel op den wal');
		expect(normalizeText('Kasteel Op den Wal  - Swatti Alix')).toBe(
			'kasteel op den wal swatti alix'
		);
	});

	it('normalizes real corpus filenames', () => {
		expect(normalizeText('Kasteel Op den Wal_5 - Hugo De Hoon - z.d..jpg')).toBe(
			'kasteel op den wal 5 hugo de hoon z d jpg'
		);
		expect(
			normalizeText('OWNP - Kapelsestraat 246 - Home Philippe Speth - Swatti Alix - zd.jpg')
		).toBe('ownp kapelsestraat 246 home philippe speth swatti alix zd jpg');
		expect(
			normalizeText('Medaille Inhuldiging Gemeentehuis 1907_2 -Dirk Van Laer - 07.02.2015.jpg')
		).toBe('medaille inhuldiging gemeentehuis 1907 2 dirk van laer 07 02 2015 jpg');
		expect(normalizeText('Broedersschool 2de lj 1969-1970.jpg')).toBe(
			'broedersschool 2de lj 1969 1970 jpg'
		);
	});

	it('is idempotent - normalizing an already normalized string changes nothing', () => {
		const once = normalizeText("Klasfoto's Sint-Jozef 1969-1970");
		expect(normalizeText(once)).toBe(once);
	});
});

describe('slugify', () => {
	it('joins the normalized words with hyphens', () => {
		expect(slugify('Kalmthoutsesteenweg - Duitse Wijk')).toBe('kalmthoutsesteenweg-duitse-wijk');
		expect(slugify('Kerken en kapellen')).toBe('kerken-en-kapellen');
		expect(slugify('Putte-Kapellen')).toBe('putte-kapellen');
	});

	it('produces the same slug for spacing and hyphenation variants', () => {
		expect(slugify('Op den Wal')).toBe(slugify('Op-den-Wal'));
		expect(slugify('Op den Wal')).toBe(slugify('  op   den   wal '));
	});

	it('produces URL-safe output containing only lowercase letters, digits and hyphens', () => {
		const slug = slugify("Klasfoto's Sint-Jozef (1969-1970)!");
		expect(slug).toMatch(/^[a-z0-9-]+$/);
		expect(slug).toBe('klasfotos-sint-jozef-1969-1970');
	});

	it('returns an empty string for empty input rather than a stray hyphen', () => {
		expect(slugify('')).toBe('');
		expect(slugify(null)).toBe('');
		expect(slugify('---')).toBe('');
	});
});

describe('tokenize', () => {
	it('splits a real filename into searchable tokens', () => {
		expect(tokenize('Stationsstraat 88 - Swatti Alix - zd')).toEqual([
			'stationsstraat',
			'88',
			'swatti',
			'alix',
			'zd'
		]);
	});

	it('keeps house numbers even though they are shorter than the minimum length', () => {
		expect(tokenize('Meidoornlaan 9')).toEqual(['meidoornlaan', '9']);
		expect(tokenize('Kapelsestraat 246')).toEqual(['kapelsestraat', '246']);
	});

	it('drops the one-letter noise produced by folding "z.d."', () => {
		expect(tokenize('Kasteel Bunderhof - z.d.')).toEqual(['kasteel', 'bunderhof']);
	});

	it('de-duplicates while preserving first-seen order', () => {
		expect(tokenize('Kapellen Kapellen kapellen KAPELLEN')).toEqual(['kapellen']);
		expect(tokenize('Putte Kapellen Putte')).toEqual(['putte', 'kapellen']);
	});

	it('honours an explicit minLength', () => {
		expect(tokenize('Op den Wal', { minLength: 3 })).toEqual(['den', 'wal']);
		expect(tokenize('Op den Wal', { minLength: 1 })).toEqual(['op', 'den', 'wal']);
	});

	it('can be told to drop bare numbers', () => {
		expect(tokenize('Meidoornlaan 9', { keepNumbers: false })).toEqual(['meidoornlaan']);
	});

	it('returns an empty array for empty input', () => {
		expect(tokenize('')).toEqual([]);
		expect(tokenize(null)).toEqual([]);
		expect(tokenize('.-.')).toEqual([]);
	});
});

describe('compactKey', () => {
	it('collides across spacing and hyphenation differences', () => {
		expect(compactKey('Op den Wal')).toBe('opdenwal');
		expect(compactKey('Op-den-Wal')).toBe('opdenwal');
		expect(compactKey('Opdenwal')).toBe('opdenwal');
	});

	it('collides across the corpus spelling variants of the same street', () => {
		expect(compactKey('Sint Jacobuskerk')).toBe(compactKey('Sint-Jacobuskerk'));
	});

	it('does not collide across genuinely different streets', () => {
		expect(compactKey('Kapelsestraat')).not.toBe(compactKey('Kapellensestraat'));
		expect(compactKey('Dorpsstraat')).not.toBe(compactKey('Dorpstraat'));
	});
});
