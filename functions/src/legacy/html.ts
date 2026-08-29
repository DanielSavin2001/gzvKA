/**
 * A small, tolerant reader for the HTML of the old gzvka.be website.
 *
 * The 101 pages in `legacy-site/` were produced by Microsoft FrontPage around 2014-2019.
 * They are a frozen corpus: table-based layout, `windows-1252` bytes, unclosed tags, and
 * presentation carried entirely by `<font>`, `<b>` and `<i>` rather than by any structure
 * worth the name. No parser dependency is worth pulling into the Cloud Functions package
 * for a corpus that will never change again, so this reads exactly what those pages use
 * and nothing more.
 *
 * What it produces is a flat list of blocks - a paragraph, a heading, an image - because
 * that is genuinely all the structure the source has. Deciding which block is a heading and
 * which is a caption is `parse.ts`'s job; this file only reports what the markup says.
 */

/**
 * The bytes are `windows-1252`, which Node cannot decode natively. It agrees with `latin1`
 * everywhere except 0x80-0x9F, where the old pages keep their curly quotes, ellipses and
 * dashes - the characters that actually appear in the prose. Decoding as plain `latin1`
 * would litter the stories with control characters.
 *
 * The five byte values Windows-1252 leaves undefined are simply absent here, and fall
 * through to the `latin1` reading.
 */
const CP1252_HIGH: Record<number, string> = {
	0x80: '€', // euro
	0x82: '‚',
	0x83: 'ƒ',
	0x84: '„',
	0x85: '…', // ellipsis
	0x86: '†',
	0x87: '‡',
	0x88: 'ˆ',
	0x89: '‰',
	0x8a: 'Š',
	0x8b: '‹',
	0x8c: 'Œ',
	0x8e: 'Ž',
	0x91: '‘', // curly quotes, all over the prose
	0x92: '’',
	0x93: '“',
	0x94: '”',
	0x95: '•',
	0x96: '–', // en dash
	0x97: '—', // em dash
	0x98: '˜',
	0x99: '™',
	0x9a: 'š',
	0x9b: '›',
	0x9c: 'œ',
	0x9e: 'ž',
	0x9f: 'Ÿ'
};

export function decodeCp1252(bytes: Buffer): string {
	let out = '';
	for (const byte of bytes) {
		out += CP1252_HIGH[byte] ?? String.fromCharCode(byte);
	}
	return out;
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	eacute: 'é',
	egrave: 'è',
	euml: 'ë',
	ecirc: 'ê',
	agrave: 'à',
	auml: 'ä',
	acirc: 'â',
	iuml: 'ï',
	ouml: 'ö',
	ocirc: 'ô',
	uuml: 'ü',
	ccedil: 'ç',
	ntilde: 'ñ',
	deg: '°',
	euro: '€',
	hellip: '…',
	rsquo: '’',
	lsquo: '‘',
	ldquo: '“',
	rdquo: '”',
	ndash: '–',
	mdash: '—',
	bull: '•',
	middot: '·'
};

export function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
		if (body.startsWith('#')) {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			// FrontPage writes the spaces in filenames as `&#32;`, so this path runs constantly.
			return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
	});
}

/** One run of text, with the emphasis that was in force where it appeared. */
export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	/** True inside a heading tag or a `<font size="4">` and up - the pages' "big text". */
	large: boolean;
	/** The href of the innermost enclosing link, when there is one. */
	href?: string;
}

export type LegacyBlock = { kind: 'text'; runs: TextRun[] } | { kind: 'image'; src: string };

/** Tags that end the current block. Anything else is inline as far as these pages go. */
const BLOCK_TAGS = new Set([
	'p',
	'div',
	'br',
	'tr',
	'td',
	'th',
	'table',
	'ul',
	'ol',
	'li',
	'blockquote',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'body'
]);

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4']);

/** Tags that never wrap anything, so must not be pushed onto the emphasis stack. */
const VOID_TAGS = new Set(['img', 'meta', 'link', 'input', 'area', 'base', 'col', 'param']);

function parseAttributes(source: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source)) !== null) {
		attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attributes;
}

/**
 * Reads a fragment into blocks.
 *
 * Emphasis is tracked as a stack of open inline tags rather than by pairing tags up: these
 * pages leave `<font>` and `<b>` unclosed often enough that strict pairing would drop text
 * on the floor. An unmatched closing tag pops the nearest matching open tag if there is one
 * and is otherwise ignored, which is what a browser does and what keeps the prose intact.
 */
export function readBlocks(html: string): LegacyBlock[] {
	const blocks: LegacyBlock[] = [];
	let runs: TextRun[] = [];

	const open: { tag: string; large: boolean; href?: string }[] = [];
	let skipUntil: string | null = null;

	const flush = (): void => {
		if (runs.some((run) => run.text.trim() !== '')) blocks.push({ kind: 'text', runs });
		runs = [];
	};

	const emphasis = () => ({
		bold: open.some(
			(entry) => entry.tag === 'b' || entry.tag === 'strong' || HEADING_TAGS.has(entry.tag)
		),
		italic: open.some((entry) => entry.tag === 'i' || entry.tag === 'em'),
		underline: open.some((entry) => entry.tag === 'u'),
		large: open.some((entry) => entry.large),
		href: [...open].reverse().find((entry) => entry.href)?.href
	});

	const pattern =
		/<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(html)) !== null) {
		const [whole, rawTag, rawAttributes, text] = match;

		if (text !== undefined) {
			if (skipUntil) continue;
			const decoded = decodeEntities(text);
			if (decoded !== '') runs.push({ text: decoded, ...emphasis() });
			continue;
		}

		if (rawTag === undefined) continue; // a comment

		const tag = rawTag.toLowerCase();
		const closing = whole.startsWith('</');

		if (skipUntil) {
			if (closing && tag === skipUntil) skipUntil = null;
			continue;
		}

		if (!closing && (tag === 'script' || tag === 'style')) {
			skipUntil = tag;
			continue;
		}

		if (BLOCK_TAGS.has(tag)) flush();

		if (closing) {
			for (let i = open.length - 1; i >= 0; i -= 1) {
				if (open[i].tag === tag) {
					open.splice(i, 1);
					break;
				}
			}
			continue;
		}

		const attributes = parseAttributes(rawAttributes ?? '');

		if (tag === 'img') {
			const src = attributes['src'];
			if (src) {
				flush();
				blocks.push({ kind: 'image', src });
			}
			continue;
		}

		// Block and void tags wrap nothing that outlives them. Pushing `<br>` in particular
		// would leave every later run looking as though it were nested inside it.
		if (BLOCK_TAGS.has(tag) || VOID_TAGS.has(tag)) continue;

		open.push({
			tag,
			large: tag === 'font' ? Number(attributes['size'] ?? '0') >= 4 : HEADING_TAGS.has(tag),
			href: tag === 'a' ? attributes['href'] : undefined
		});
	}

	flush();
	return blocks;
}

/**
 * Returns the content region of a FrontPage page.
 *
 * FrontPage marks its layout cells with `<!-- MSCellType="ContentBody" -->`, which is by
 * far the most reliable way to separate the prose from the logo, the flyer banner and the
 * empty navigation column - a column that runs to 120 blank paragraphs on some pages. 100
 * of the 101 pages carry the marker; three carry two cells and one carries none, so the
 * result is every marked region joined, falling back to the whole document.
 */
export function contentRegions(html: string): string {
	const marker = /<!--\s*MSCellType="ContentBody"\s*-->/g;
	const regions: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = marker.exec(html)) !== null) {
		regions.push(html.slice(match.index, endOfCell(html, marker.lastIndex)));
	}

	return regions.length > 0 ? regions.join('\n') : html;
}

/** Scans forward from inside a `<td>` to the `</td>` that closes it, nesting included. */
function endOfCell(html: string, from: number): number {
	const cells = /<(\/?)td\b/gi;
	cells.lastIndex = from;

	let depth = 1;
	let match: RegExpExecArray | null;
	while ((match = cells.exec(html)) !== null) {
		depth += match[1] === '/' ? -1 : 1;
		if (depth === 0) return match.index;
	}
	return html.length;
}
