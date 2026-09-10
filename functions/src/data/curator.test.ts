import {
	CuratorRoster,
	curatorLabel,
	curatorName,
	looksLikeAddress,
	readCuratorName,
	UNNAMED_CURATOR
} from '../../../sharedModels/curator';

/**
 * The rule these hold: a curator's email address never reaches a reader.
 *
 * It is not a style preference. `photoEdits` is a public endpoint and it answered with the
 * whole stored record, so every corrected photograph on the live site carried the private
 * address of whoever corrected it - and `npm run archive:pull` wrote the same records into a
 * public repository, once per edit, every night.
 *
 * Every path out of that has to end in a name or in "Een beheerder". The awkward cases are
 * the ones that decide it: an empty roster, a roster that has never heard of this address,
 * a stamp written before any of this existed. All three must fail closed.
 */

const ROSTER: CuratorRoster = {
	'boatingdruid315@outlook.be': 'Daniel Savin',
	'hugodehoon@gmail.com': 'Hugo De Hoon'
};

describe('curatorLabel', () => {
	it('turns an address the roster knows into that curator name', () => {
		expect(curatorLabel('boatingdruid315@outlook.be', ROSTER)).toBe('Daniel Savin');
		expect(curatorLabel('hugodehoon@gmail.com', ROSTER)).toBe('Hugo De Hoon');
	});

	it('leaves a stamp that is already a name alone', () => {
		// What every decision made after this change looks like.
		expect(curatorLabel('Hugo De Hoon', ROSTER)).toBe('Hugo De Hoon');
	});

	it('withholds an address the roster does not know', () => {
		// A curator removed from the list, or one added before names were a field. Their past
		// decisions still have to render, and rendering the address is the bug.
		expect(curatorLabel('someone@else.test', ROSTER)).toBe(UNNAMED_CURATOR);
	});

	it('withholds an address when there is no roster at all', () => {
		// The site's fallback path: `static/data/photo-edits.json` is read straight from the
		// build with no Firestore anywhere near it, and older copies of that file hold
		// addresses. The browser has nothing to resolve them with and must not print them.
		expect(curatorLabel('boatingdruid315@outlook.be')).toBe(UNNAMED_CURATOR);
	});

	it('matches an address whatever case it was stored in', () => {
		// Firestore document ids are lower-cased by `requireAdmin`; a stamp is whatever the
		// token said. `BoatingDruid315@outlook.be` is the same person.
		expect(curatorLabel('BoatingDruid315@Outlook.be', ROSTER)).toBe('Daniel Savin');
	});

	it('reads a missing or nonsense stamp as an unnamed curator', () => {
		expect(curatorLabel(undefined, ROSTER)).toBe(UNNAMED_CURATOR);
		expect(curatorLabel('', ROSTER)).toBe(UNNAMED_CURATOR);
		expect(curatorLabel('   ', ROSTER)).toBe(UNNAMED_CURATOR);
		expect(curatorLabel(42, ROSTER)).toBe(UNNAMED_CURATOR);
		expect(curatorLabel(null, ROSTER)).toBe(UNNAMED_CURATOR);
	});

	it('never lets an @ through, whatever shape it is in', () => {
		for (const stamped of [
			'boatingdruid315@outlook.be',
			' hugodehoon@gmail.com ',
			'not.an.address@',
			'@handle',
			'a@b'
		]) {
			expect(curatorLabel(stamped, {})).not.toContain('@');
		}
	});
});

describe('readCuratorName', () => {
	it('takes a name a person typed into the console', () => {
		expect(readCuratorName('Daniel Savin')).toBe('Daniel Savin');
	});

	it('tidies the whitespace a typed field collects', () => {
		expect(readCuratorName('  Hugo   De Hoon \n')).toBe('Hugo De Hoon');
	});

	it('reads an empty or non-string field as no name given', () => {
		expect(readCuratorName('')).toBeUndefined();
		expect(readCuratorName('   ')).toBeUndefined();
		expect(readCuratorName(undefined)).toBeUndefined();
		expect(readCuratorName({ name: 'Daniel' })).toBeUndefined();
	});

	it('bounds a name, so the field cannot become a paragraph', () => {
		expect(readCuratorName('x'.repeat(500))).toHaveLength(80);
	});
});

describe('curatorName', () => {
	it('prefers the name this archive gave the curator', () => {
		// The `admins` document is what the curators control. Google's display name is
		// whatever their account happens to be called.
		expect(curatorName('Daniel Savin', 'daniel.s')).toBe('Daniel Savin');
	});

	it('falls back to the name Google knows them by', () => {
		// So a curator added to `admins` with an empty document is still recognisable from
		// their very first decision rather than anonymous until somebody fills the field in.
		expect(curatorName(undefined, 'Hugo De Hoon')).toBe('Hugo De Hoon');
	});

	it('never stamps an address, even when that is all there is', () => {
		expect(curatorName(undefined, undefined)).toBe(UNNAMED_CURATOR);
	});
});

describe('looksLikeAddress', () => {
	it('errs towards withholding', () => {
		expect(looksLikeAddress('a@b')).toBe(true);
		expect(looksLikeAddress('Daniel Savin')).toBe(false);
	});
});
