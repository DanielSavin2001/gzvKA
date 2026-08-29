/**
 * Turns a page of the old gzvka.be website into a story.
 *
 * The old site carried a great deal of writing that the photographs alone do not hold: who
 * ran the café on the corner, what the castle was before it was a convent, what it was like
 * to be twelve in the Nieuwe Wijk in 1983. None of that survives in a filename. This module
 * recovers it.
 *
 * The pages have no semantic structure to read, so the classification is done from the only
 * signals FrontPage left behind, all of which hold consistently across the corpus:
 *
 *   - a short paragraph that opens in bold or in large type is a heading;
 *   - a paragraph set entirely in italics, directly after an image, is its caption;
 *   - everything else that is not navigation chrome is prose.
 *
 * Nothing here invents text. Every string in the output appears verbatim in the source
 * page, which is committed alongside it in `legacy-site/`.
 */

import { slugify } from '../../../sharedModels/text';
import { contentRegions, decodeCp1252, decodeEntities, readBlocks } from './html';
import type { LegacyBlock, TextRun } from './html';

/** A photograph as the old page presented it: the file it referenced, and its caption. */
export interface StoryImage {
	kind: 'image';
	/** The `src` from the page, decoded - e.g. "Cafe De Pancras - Marc Brans - 10.04.2014.jpg". */
	src: string;
	/** The italic line under the photograph, when the page had one. */
	caption?: string;
}

export interface StoryParagraph {
	kind: 'paragraph';
	text: string;
	/** A short trailing line naming who wrote the piece, e.g. "Rudi Staute". */
	credit?: boolean;
}

export type StoryPart = StoryImage | StoryParagraph;

/** A run of the page under one heading. Pages without headings produce a single section. */
export interface StorySection {
	heading?: string;
	/**
	 * A label set above the heading, which several pages use for the place and year the
	 * piece is set in - "Nieuwe Wijk, 1983" above "3. Wildplassen".
	 */
	kicker?: string;
	parts: StoryPart[];
}

export interface LegacyPage {
	/** Slug of the source filename, used as the story's stable id. */
	slug: string;
	/** The source file in `legacy-site/`, so any claim can be checked against the original. */
	sourceFile: string;
	/** The page's own heading where it has one, else its `<title>`. */
	title: string;
	sections: StorySection[];
	/** Every image `src` on the page, in order, chrome excluded. */
	images: string[];
	/** Characters of prose, used to tell a written page from a bare photograph gallery. */
	proseLength: number;
}

/**
 * Navigation and decoration that appears on nearly every page. Matched on the normalised
 * text so that spacing and case in the source do not matter.
 */
const CHROME_TEXT = new Set([
	'terug naar de startpagina',
	'terug naar de start pagina',
	'terug',
	'terug naar boven',
	'naar boven',
	'startpagina',
	'home'
]);

/** Logo and banner images, which are page furniture rather than archive photographs. */
function isChromeImage(src: string): boolean {
	const name = src.toLowerCase();
	return (
		name.includes('logo') ||
		name.includes('flyertekst') ||
		name.includes('banner') ||
		name.includes('spacer') ||
		name.includes('button')
	);
}

function runsText(runs: TextRun[]): string {
	return runs
		.map((run) => run.text)
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when every run carrying visible text satisfies `has`. */
function everyVisibleRun(runs: TextRun[], has: (run: TextRun) => boolean): boolean {
	const visible = runs.filter((run) => run.text.trim() !== '');
	return visible.length > 0 && visible.every(has);
}

/**
 * A heading is a short line that opens in bold or in large type. The length bound separates
 * it from a paragraph set entirely in bold, of which the corpus has a handful.
 *
 * The share, rather than "every run is bold", is what the pages actually need: headings are
 * routinely written as an emphasised phrase with a plain tail -
 * `<u><b>De Mythe van de Pancras</b></u> (deel 1).` and
 * `<u><b>DORPSSTRAAT en GEUZENHOEK</b></u> (+ zijstraten)`. Requiring the emphasis to start
 * the block is what keeps an ordinary sentence with a bold name in the middle out.
 */
const MAX_HEADING_LENGTH = 120;
const MIN_HEADING_EMPHASIS = 0.6;

/** The longest unemphasised tail a heading may carry, as in "(+ zijstraten)". */
const MAX_HEADING_TAIL = 25;

function leadingEmphasis(runs: TextRun[]): { share: number; tail: number } {
	const visible = runs.filter((run) => run.text.trim() !== '');
	const total = visible.reduce((sum, run) => sum + run.text.trim().length, 0);
	if (total === 0) return { share: 0, tail: 0 };

	let emphasised = 0;
	for (const run of visible) {
		if (!run.bold && !run.large) break;
		emphasised += run.text.trim().length;
	}

	return { share: emphasised / total, tail: total - emphasised };
}

function isHeading(runs: TextRun[], text: string): boolean {
	if (text.length === 0 || text.length > MAX_HEADING_LENGTH) return false;

	const { share, tail } = leadingEmphasis(runs);
	if (share === 0) return false;

	// Either the emphasis dominates the line, or what follows it is only a qualifier. A
	// long heading needs the first test - "DORPSSTRAAT en GEUZENHOEK (+ zijstraten)" - and
	// a short one needs the second, since "De Mythe (deel 1)." is under the ratio while
	// plainly still a heading. A sentence opening with a bold name fails both: its tail is
	// the rest of the sentence.
	return share >= MIN_HEADING_EMPHASIS || tail <= MAX_HEADING_TAIL;
}

/** Captions are set in italics under the photograph, and name donor and date. */
function isCaption(runs: TextRun[], text: string): boolean {
	return text.length > 0 && text.length <= 200 && everyVisibleRun(runs, (run) => run.italic);
}

/** A line that is only a link, e.g. "terug naar de startpagina". */
function isNavigation(runs: TextRun[], text: string): boolean {
	const normalized = text
		.toLowerCase()
		.replace(/[^a-z ]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (CHROME_TEXT.has(normalized)) return true;
	return text.length <= 60 && everyVisibleRun(runs, (run) => run.href !== undefined);
}

/**
 * A closing signature: a short line naming the author, with no sentence in it. These sit at
 * the end of a piece ("Rudi Staute") and read badly as a paragraph of their own.
 */
function isCredit(text: string): boolean {
	if (text.length > 48 || /[.!?:;]$/.test(text)) return false;
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length < 2 || words.length > 4) return false;
	return words.every((word) => /^[’'A-Za-zÀ-ÿ.-]+$/.test(word) && /^[A-ZÀ-Þ’']/.test(word));
}

/** Reads a legacy page from disk. Exported so the build script and the tests agree. */
export function parseLegacyHtml(fileName: string, bytes: Buffer): LegacyPage {
	const html = decodeCp1252(bytes);
	const documentTitle = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
		.replace(/\s+/g, ' ')
		.trim();

	const blocks = readBlocks(contentRegions(html));

	const sections: StorySection[] = [];
	const images: string[] = [];
	let current: StorySection = { parts: [] };
	let proseLength = 0;
	let pageHeading = '';

	const startSection = (heading: string): void => {
		// Two headings in a row are a label and a title, not an empty section followed by a
		// full one - "Nieuwe Wijk, 1983" then "3. Wildplassen". The first becomes the kicker.
		if (current.parts.length === 0 && current.heading !== undefined) {
			current.kicker = current.kicker ? `${current.kicker} - ${current.heading}` : current.heading;
			current.heading = heading;
			return;
		}

		if (current.parts.length > 0 || current.heading !== undefined) sections.push(current);
		current = { heading, parts: [] };
	};

	for (const block of blocks) {
		if (block.kind === 'image') {
			if (isChromeImage(block.src)) continue;
			images.push(block.src);
			current.parts.push({ kind: 'image', src: block.src });
			continue;
		}

		const text = runsText(block.runs);
		if (text === '') continue;
		if (isNavigation(block.runs, text)) continue;

		const last = current.parts[current.parts.length - 1];

		// An italic line directly under a photograph is that photograph's caption. This has
		// to be tested before the heading rule, because the captions on several pages are
		// set in bold italics and would otherwise each start a spurious new section.
		if (last?.kind === 'image' && last.caption === undefined && isCaption(block.runs, text)) {
			last.caption = text;
			continue;
		}

		// A signature closing a piece - "Rudi Staute" - is set in bold, so it has to be
		// recognised before the heading rule or every story would end with an empty section
		// named after its author. What tells the two apart is position: a signature follows
		// the writing, a heading precedes it.
		const followsProse = current.parts.some((part) => part.kind === 'paragraph');
		if (followsProse && isCredit(text)) {
			current.parts.push({ kind: 'paragraph', text, credit: true });
			continue;
		}

		if (isHeading(block.runs, text)) {
			// The first heading on the page is the page's own title, not a section of it.
			if (pageHeading === '' && sections.length === 0 && current.parts.length === 0) {
				pageHeading = text;
				continue;
			}
			startSection(text);
			continue;
		}

		proseLength += text.length;
		current.parts.push({ kind: 'paragraph', text });
	}

	if (current.parts.length > 0 || current.heading !== undefined) sections.push(current);

	const baseName = fileName.replace(/\.[^.]+$/, '');

	return {
		slug: slugify(baseName),
		sourceFile: fileName,
		title: pageHeading || documentTitle || baseName,
		sections,
		images,
		proseLength
	};
}

/** Convenience for tests and tooling that already hold the decoded markup. */
export function parseLegacyBlocks(html: string): LegacyBlock[] {
	return readBlocks(contentRegions(html));
}
