/**
 * Which blocks a page shows, and in what order.
 *
 * The second half of letting the curators run the site themselves. The first put the words
 * in their hands; this puts the arrangement there - whether the stories come before the
 * streets on the front page, whether a block appears at all.
 *
 * ## Why an ordered list of ids rather than a page builder
 *
 * Because the blocks on these pages are not paragraphs. "The map" is a Leaflet instance with
 * its own data, its own clustering and its own uncertainty circles; "a greep uit het archief"
 * picks photographs and lays them out responsively. Those are components, and they stay
 * components. What a curator gets to decide is which of them appear and in what order, which
 * is the editorial question - not how a map is built, which is not.
 *
 * That choice is also what keeps the arrangement safe. Every id here is one a developer put
 * in the page, so no arrangement can produce a broken page: the worst a curator can do is
 * hide something, and hiding is one click from being undone.
 *
 * ## The rule that matters
 *
 * A stored order names the blocks that existed when it was saved. A block added to the page
 * afterwards is in no stored order at all - and must still appear, or shipping a new section
 * would silently do nothing on a site whose curators had ever touched the layout. So the
 * stored order is a preference applied to the page's own list, not a replacement for it.
 */

export interface PageBlock {
	/** Stable id, `<page>.<what>`. A database key: never reused for something else. */
	id: string;
	page: string;
	/** What the curator's desk calls it. */
	label: string;
	/** A line saying what the block is, for somebody deciding whether to hide it. */
	about: string;
	/**
	 * A block that cannot be hidden.
	 *
	 * The search box on the front page is the front page. Hiding it would not be a layout
	 * decision, it would be a broken site with no way back except this file - so it is not
	 * offered, rather than offered and regretted.
	 */
	essential?: boolean;
}

/** Every block a curator may move or hide, in the order the page ships with. */
export const PAGE_BLOCKS: PageBlock[] = [
	{
		id: 'index.kaart',
		page: '/',
		label: 'De kaart',
		about: 'De kaart van Kapellen met alle plaatsen erop.'
	},
	{
		id: 'index.straten',
		page: '/',
		label: 'Straten van Kapellen',
		about: "De lijst van straten en pleinen met foto's."
	},
	{
		id: 'index.gebieden',
		page: '/',
		label: 'Wijken, kastelen en gebouwen',
		about: 'De lijst van alle andere plaatsen.'
	},
	{
		id: 'index.verhalen',
		page: '/',
		label: "Verhalen bij de foto's",
		about: 'Een greep uit de verhalen, met een link naar alle verhalen.'
	},
	{
		id: 'index.greep',
		page: '/',
		label: 'Een greep uit het archief',
		about: "Een handvol foto's uit het archief."
	}
];

const BY_PAGE = new Map<string, PageBlock[]>();
for (const block of PAGE_BLOCKS) {
	BY_PAGE.set(block.page, [...(BY_PAGE.get(block.page) ?? []), block]);
}

/** The blocks of one page, in the order it ships with. */
export function blocksOf(page: string): PageBlock[] {
	return BY_PAGE.get(page) ?? [];
}

/** Every page whose arrangement a curator may change. */
export function layoutPages(): string[] {
	return [...BY_PAGE.keys()];
}

export function blockFor(id: string): PageBlock | undefined {
	return PAGE_BLOCKS.find((block) => block.id === id);
}

/** One page's arrangement, as a curator left it. */
export interface PageLayout {
	order: string[];
	hidden: string[];
}

/** What the site fetches: every page a curator has rearranged, keyed by route. */
export interface LayoutFile {
	version: number;
	layout: Record<string, PageLayout>;
}

/**
 * One page's stored arrangement, with anything unusable dropped.
 *
 * Ids that are not blocks of this page are discarded rather than kept: they can only come
 * from a typo, a crafted request, or a block a developer has since removed, and none of
 * those should survive into the arrangement. Duplicates are discarded too - an id appearing
 * twice would render a block twice.
 */
export function readPageLayout(page: string, input: unknown): PageLayout {
	const known = new Set(blocksOf(page).map((block) => block.id));
	const raw = (input ?? {}) as Partial<PageLayout>;

	const clean = (values: unknown): string[] => {
		if (!Array.isArray(values)) return [];

		const seen = new Set<string>();
		for (const value of values) {
			if (typeof value === 'string' && known.has(value)) seen.add(value);
		}
		return [...seen];
	};

	const hidden = clean(raw.hidden).filter((id) => !blockFor(id)?.essential);
	return { order: clean(raw.order), hidden };
}

/** A whole stored document, read off the wire. */
export function readLayoutFile(input: unknown): Record<string, PageLayout> {
	if (!input || typeof input !== 'object') return {};

	const raw = (input as Partial<LayoutFile>).layout;
	if (!raw || typeof raw !== 'object') return {};

	const layout: Record<string, PageLayout> = {};
	for (const [page, value] of Object.entries(raw as Record<string, unknown>)) {
		if (blocksOf(page).length === 0) continue;

		const read = readPageLayout(page, value);
		if (read.order.length > 0 || read.hidden.length > 0) layout[page] = read;
	}

	return layout;
}

/**
 * The ids to render, in order.
 *
 * Blocks the curator has placed come first, in their order; everything else follows in the
 * order the page ships with. That second half is the rule this function exists for: a block
 * added to a page after a curator last saved is in no stored order, and appending it rather
 * than dropping it is the difference between shipping a new section and shipping nothing.
 */
export function arrange(page: string, layout: Record<string, PageLayout> = {}): string[] {
	const blocks = blocksOf(page);
	const stored = layout[page];
	if (!stored) return blocks.map((block) => block.id);

	// Deduplicated here as well as in `readPageLayout`, because this is a pure function and
	// the next caller may not have validated its input. A repeated id is not a cosmetic
	// problem: the pages render these through a keyed `{#each}`, and Svelte throws on a
	// duplicate key - which blanks the page rather than drawing a block twice.
	const known = new Set(blocks.map((block) => block.id));
	const placed = [...new Set(stored.order.filter((id) => known.has(id)))];
	const rest = blocks.map((block) => block.id).filter((id) => !placed.includes(id));
	const hidden = new Set(stored.hidden);

	return [...placed, ...rest].filter((id) => !hidden.has(id));
}
