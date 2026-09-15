import {
	arrange,
	blocksOf,
	layoutPages,
	PAGE_BLOCKS,
	readLayoutFile,
	readPageLayout
} from '../../../sharedModels/site-layout';

/**
 * The rules these hold: a curator can rearrange a page and cannot break it.
 *
 * Every id is one a developer put in the page, so no arrangement produces a page that does
 * not render. What is left to get wrong is subtler and all of it is here: a block added to
 * the page after a curator last saved must still appear; an id that is not a block of this
 * page must not be stored; a block the page cannot do without must not be hideable; and the
 * same id must never render twice.
 */

const HOME = '/';

describe('the registry itself', () => {
	it('gives every block a unique id', () => {
		const ids = PAGE_BLOCKS.map((block) => block.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('names each block after its page, and says what it is', () => {
		for (const block of PAGE_BLOCKS) {
			const prefix = block.page === '/' ? 'index' : block.page.replace(/^\//, '');
			expect(block.id.startsWith(`${prefix}.`)).toBe(true);
			expect(block.label.trim()).not.toBe('');
			expect(block.about.trim()).not.toBe('');
		}
	});

	it('lists every page that can be rearranged', () => {
		expect(layoutPages()).toContain(HOME);
		expect(blocksOf(HOME).length).toBeGreaterThan(1);
		expect(blocksOf('/geen-pagina')).toEqual([]);
	});
});

describe('arrange', () => {
	const shipped = blocksOf(HOME).map((block) => block.id);

	it('ships the page as the developer wrote it when nothing is stored', () => {
		expect(arrange(HOME)).toEqual(shipped);
		expect(arrange(HOME, {})).toEqual(shipped);
	});

	it('puts the blocks where the curator put them', () => {
		const reversed = [...shipped].reverse();
		expect(arrange(HOME, { [HOME]: { order: reversed, hidden: [] } })).toEqual(reversed);
	});

	it('leaves a hidden block out', () => {
		const without = arrange(HOME, { [HOME]: { order: [], hidden: [shipped[1]] } });

		expect(without).not.toContain(shipped[1]);
		expect(without).toHaveLength(shipped.length - 1);
	});

	it('still shows a block the curator has never seen', () => {
		// The rule this function exists for. A curator arranged the page when it had three
		// blocks; a developer then shipped a fourth. Dropping it would mean the new section
		// silently did nothing for exactly the people who use this feature.
		const partial = shipped.slice(0, 2);
		const arranged = arrange(HOME, { [HOME]: { order: partial, hidden: [] } });

		expect(arranged.slice(0, 2)).toEqual(partial);
		expect(new Set(arranged)).toEqual(new Set(shipped));
	});

	it('never renders the same block twice', () => {
		const arranged = arrange(HOME, {
			[HOME]: { order: [shipped[0], shipped[0], shipped[1]], hidden: [] }
		});

		expect(new Set(arranged).size).toBe(arranged.length);
	});

	it('ignores an order full of ids that are not blocks of this page', () => {
		expect(arrange(HOME, { [HOME]: { order: ['nonsense', 'straten.title'], hidden: [] } })).toEqual(
			shipped
		);
	});
});

describe('readPageLayout', () => {
	const shipped = blocksOf(HOME).map((block) => block.id);

	it('keeps the ids that are really blocks of this page', () => {
		expect(readPageLayout(HOME, { order: shipped, hidden: [shipped[0]] })).toEqual({
			order: shipped,
			hidden: [shipped[0]]
		});
	});

	it('drops ids from another page, or from nowhere', () => {
		expect(
			readPageLayout(HOME, { order: [shipped[0], 'over-ons.title', 42, null], hidden: ['nope'] })
		).toEqual({ order: [shipped[0]], hidden: [] });
	});

	it('drops a repeated id rather than rendering a block twice', () => {
		expect(readPageLayout(HOME, { order: [shipped[0], shipped[0]], hidden: [] }).order).toEqual([
			shipped[0]
		]);
	});

	it('reads nonsense as no arrangement at all', () => {
		for (const value of [undefined, null, 'tekst', 42, { order: 'nee', hidden: 7 }]) {
			expect(readPageLayout(HOME, value)).toEqual({ order: [], hidden: [] });
		}
	});
});

describe('readLayoutFile', () => {
	const shipped = blocksOf(HOME).map((block) => block.id);

	it('reads a stored document', () => {
		expect(
			readLayoutFile({ version: 1, layout: { [HOME]: { order: shipped, hidden: [] } } })
		).toEqual({ [HOME]: { order: shipped, hidden: [] } });
	});

	it('drops a page nothing on the site renders', () => {
		expect(
			readLayoutFile({ version: 1, layout: { '/verzonnen': { order: ['x'], hidden: [] } } })
		).toEqual({});
	});

	it('drops a page whose arrangement says nothing', () => {
		// An empty arrangement is the shipped one. Storing it would be a row that means
		// nothing and has to be reasoned about later.
		expect(readLayoutFile({ version: 1, layout: { [HOME]: { order: [], hidden: [] } } })).toEqual(
			{}
		);
	});

	it('reads nonsense as nothing stored', () => {
		for (const value of [undefined, null, 'tekst', 42, {}, { layout: 'nee' }]) {
			expect(readLayoutFile(value)).toEqual({});
		}
	});
});

describe('a block the page cannot do without', () => {
	it('is never hidden, however the request asks', () => {
		// There is no essential block on the home page today - the search box is outside the
		// arrangement entirely - but the rule has to hold the moment one is marked, because
		// the failure it prevents is a page with no way back except this file.
		const essential = PAGE_BLOCKS.find((block) => block.essential);
		if (!essential) {
			expect(PAGE_BLOCKS.every((block) => !block.essential)).toBe(true);
			return;
		}

		const read = readPageLayout(essential.page, { order: [], hidden: [essential.id] });
		expect(read.hidden).not.toContain(essential.id);
		expect(arrange(essential.page, { [essential.page]: read })).toContain(essential.id);
	});
});
