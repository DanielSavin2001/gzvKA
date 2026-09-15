import {
	COPY_LIMITS,
	COPY_SLOTS,
	copyPages,
	readCopyFile,
	readCopyText,
	say,
	slotFor
} from '../../../sharedModels/site-copy';

/**
 * The rules these hold: a curator can rewrite the site's own words, and nothing they type can
 * empty a page, break a heading, or put words on the site that the site does not render.
 *
 * The fallback is the load-bearing half. A curator's text lives in Firestore, the pages are
 * prerendered to flat files, and the overlay that carries the text is allowed to fail - so
 * every path that does not end in stored text has to end in the words the site shipped with,
 * never in an empty paragraph.
 */

describe('the registry itself', () => {
	it('gives every slot a unique id', () => {
		// The id is a database key. Reusing one for different words would silently retitle a
		// page somewhere else the next time a curator saved.
		const ids = COPY_SLOTS.map((slot) => slot.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('ships real words for every slot, within its own limit', () => {
		for (const slot of COPY_SLOTS) {
			expect(slot.fallback.trim()).not.toBe('');
			expect(slot.fallback.length).toBeLessThanOrEqual(COPY_LIMITS[slot.kind]);
		}
	});

	it('carries no markup, because a text box is the wrong shape for it', () => {
		for (const slot of COPY_SLOTS) {
			expect(slot.fallback).not.toMatch(/<[a-z/]/i);
			// Entities too: the component rendered "&mdash;" as a dash, and a plain string
			// through Svelte renders it as the seven characters "&mdash;".
			expect(slot.fallback).not.toMatch(/&[a-z]+;|&#\d+;/i);
		}
	});

	it('names each slot after the page it is on', () => {
		// So that a stray id is obvious on sight, and so the curator's desk can group by page
		// without a second mapping to keep in step. The home page has no name in its path, so
		// it is "index" - the one case that has to be written down rather than derived.
		for (const slot of COPY_SLOTS) {
			const prefix = slot.page === '/' ? 'index' : slot.page.replace(/^\//, '');
			expect(slot.id.startsWith(`${prefix}.`)).toBe(true);
		}
	});

	it('lists each page once, in reading order', () => {
		const pages = copyPages();

		expect(new Set(pages).size).toBe(pages.length);
	});
});

describe('readCopyText', () => {
	const heading = COPY_SLOTS.find((slot) => slot.kind === 'heading')!;
	const text = COPY_SLOTS.find((slot) => slot.kind === 'text')!;

	it('takes what a curator typed', () => {
		expect(readCopyText(heading.id, 'Over ons archief')).toBe('Over ons archief');
	});

	it('refuses an id the site does not render', () => {
		// Anyone can POST. An unknown id is a typo or a client writing whatever it likes into
		// a public document; neither belongs in the database.
		expect(readCopyText('over-ons.does-not-exist', 'Hallo')).toBeUndefined();
	});

	it('refuses an empty box rather than emptying the page', () => {
		expect(readCopyText(text.id, '')).toBeUndefined();
		expect(readCopyText(text.id, '   \n  ')).toBeUndefined();
	});

	it('refuses text identical to the words the site shipped', () => {
		// A row saying "the same as the default" means nothing and has to be reasoned about
		// for ever. Saving the original back is how a curator reverts.
		expect(readCopyText(heading.id, heading.fallback)).toBeUndefined();
		expect(readCopyText(heading.id, `  ${heading.fallback}  `)).toBeUndefined();
	});

	it('keeps paragraphs in a text block but not in a heading', () => {
		expect(readCopyText(text.id, 'Eerste alinea.\n\nTweede alinea.')).toBe(
			'Eerste alinea.\n\nTweede alinea.'
		);
		// Deliberately not the default's own words: collapsing those would land back on the
		// fallback and be refused as a no-op, which is a different rule being tested below.
		expect(readCopyText(heading.id, 'Over\ndeze\nverzameling')).toBe('Over deze verzameling');
	});

	it('tidies the whitespace a pasted paragraph brings with it', () => {
		expect(readCopyText(text.id, 'Een   zin\t\tmet  rommel.')).toBe('Een zin met rommel.');
		expect(readCopyText(text.id, 'Een.\n\n\n\n\nTwee.')).toBe('Een.\n\nTwee.');
	});

	it('caps a heading so it cannot wrap the page into a mess', () => {
		expect(readCopyText(heading.id, 'x'.repeat(500))).toHaveLength(COPY_LIMITS.heading);
	});

	it('caps a text block so an article cannot be pasted into an introduction', () => {
		expect(readCopyText(text.id, 'x'.repeat(9000))).toHaveLength(COPY_LIMITS.text);
	});

	it('refuses anything that is not a string', () => {
		for (const value of [undefined, null, 42, {}, ['hallo']]) {
			expect(readCopyText(text.id, value)).toBeUndefined();
		}
	});
});

describe('readCopyFile', () => {
	const heading = COPY_SLOTS.find((slot) => slot.kind === 'heading')!;

	it('reads a stored document', () => {
		expect(readCopyFile({ version: 1, copy: { [heading.id]: 'Iets anders' } })).toEqual({
			[heading.id]: 'Iets anders'
		});
	});

	it('drops one bad entry rather than the whole page', () => {
		// The fail-soft rule the other overlays follow: one unusable row must not cost the
		// reader every other sentence on the page.
		expect(
			readCopyFile({
				version: 1,
				copy: { [heading.id]: 'Iets anders', 'not.a.slot': 'Hallo', bad: 42 }
			})
		).toEqual({ [heading.id]: 'Iets anders' });
	});

	it('reads nonsense as nothing stored', () => {
		for (const value of [undefined, null, 'tekst', 42, {}, { copy: 'nee' }, { copy: null }]) {
			expect(readCopyFile(value)).toEqual({});
		}
	});
});

describe('say', () => {
	const slot = COPY_SLOTS[0];

	it('prefers what the curator wrote', () => {
		expect(say({ [slot.id]: 'De nieuwe titel' }, slot.id)).toBe('De nieuwe titel');
	});

	it('falls back to the words the site shipped with', () => {
		// Every path that does not end in stored text ends here. A page must never render an
		// empty heading because an overlay timed out.
		expect(say({}, slot.id)).toBe(slot.fallback);
		expect(say({ [slot.id]: '   ' }, slot.id)).toBe(slot.fallback);
	});

	it('never renders an id as if it were words', () => {
		expect(say({}, 'over-ons.nonsense')).toBe('');
	});

	it('renders real words for every slot with an empty overlay', () => {
		for (const each of COPY_SLOTS) {
			expect(say({}, each.id)).toBe(each.fallback);
			expect(say({}, each.id).trim()).not.toBe('');
		}
	});
});

describe('slotFor', () => {
	it('finds a slot and admits when there is none', () => {
		expect(slotFor(COPY_SLOTS[0].id)?.label).toBe(COPY_SLOTS[0].label);
		expect(slotFor('nope')).toBeUndefined();
	});
});
