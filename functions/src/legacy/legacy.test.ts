import * as fs from 'fs';
import * as path from 'path';

import { contentRegions, decodeCp1252, decodeEntities, readBlocks } from './html';
import { parseLegacyHtml } from './parse';
import { buildPhotoLookup, photoKey, resolvePhoto, unambiguousFolders } from './link';

const LEGACY_DIR = path.join(__dirname, '..', '..', '..', 'legacy-site');

describe('decodeCp1252', () => {
	it('reads the curly quotes and dashes the old pages are full of', () => {
		// 0x91-0x94 are quotes in Windows-1252 and control characters in latin1, which is
		// what makes decoding as latin1 wrong rather than merely imprecise.
		expect(decodeCp1252(Buffer.from([0x91, 0x92, 0x93, 0x94, 0x85, 0x96]))).toBe('‘’“”…–');
	});

	it('leaves plain ASCII and latin1 accents alone', () => {
		expect(decodeCp1252(Buffer.from('Café', 'latin1'))).toBe('Café');
	});
});

describe('decodeEntities', () => {
	it('decodes the numeric spaces FrontPage writes into filenames', () => {
		expect(decodeEntities('Cafe&#32;De&#32;Pancras.jpg')).toBe('Cafe De Pancras.jpg');
	});

	it('decodes the named entities the pages use', () => {
		expect(decodeEntities('&quot;Pancras&quot; &amp; frituur&nbsp;')).toBe('"Pancras" & frituur ');
	});

	it('leaves an unknown entity as written rather than dropping it', () => {
		expect(decodeEntities('100&fake;200')).toBe('100&fake;200');
	});
});

describe('readBlocks', () => {
	it('keeps a paragraph whole across the inline tags inside it', () => {
		const blocks = readBlocks('<p>Vicky <b>Staal</b> keek terug</p>');

		expect(blocks).toHaveLength(1);
		expect(blocks[0].kind).toBe('text');
		if (blocks[0].kind !== 'text') throw new Error('expected a text block');
		expect(blocks[0].runs.map((run) => run.text).join('')).toBe('Vicky Staal keek terug');
	});

	it('records which runs were emphasised', () => {
		const blocks = readBlocks('<p><b>Kop</b> staart</p>');
		if (blocks[0].kind !== 'text') throw new Error('expected a text block');

		expect(blocks[0].runs.map((run) => [run.text, run.bold])).toEqual([
			['Kop', true],
			[' staart', false]
		]);
	});

	it('does not let a <br> swallow the rest of the page', () => {
		// `<br>` never closes, so pushing it on the emphasis stack would leave everything
		// after it looking nested - the bug that would silently mark a whole page bold.
		const blocks = readBlocks('<p><b>Kop</b><br>gewone tekst</p>');
		const last = blocks[blocks.length - 1];
		if (last.kind !== 'text') throw new Error('expected a text block');

		expect(last.runs.every((run) => !run.bold)).toBe(true);
	});

	it('survives the unclosed tags these pages are full of', () => {
		const blocks = readBlocks('<p><font face="Tahoma"><b>Kop<p>Volgende alinea</p>');
		expect(blocks).toHaveLength(2);
	});

	it('reports images as their own block, with the entities in the src decoded', () => {
		const blocks = readBlocks('<p><img src="Cafe&#32;De&#32;Pancras.jpg"></p>');
		expect(blocks).toEqual([{ kind: 'image', src: 'Cafe De Pancras.jpg' }]);
	});

	it('ignores script and style content', () => {
		const blocks = readBlocks('<p>zichtbaar</p><style>p { color: red }</style>');
		expect(blocks).toHaveLength(1);
	});
});

describe('contentRegions', () => {
	it('returns only the marked content cell', () => {
		const html =
			'<td><!-- MSCellType="NavBody" -->menu</td>' +
			'<td><!-- MSCellType="ContentBody" -->het verhaal</td>';

		expect(contentRegions(html)).toContain('het verhaal');
		expect(contentRegions(html)).not.toContain('menu');
	});

	it('does not stop at a nested table inside the content cell', () => {
		const html =
			'<td><!-- MSCellType="ContentBody" -->begin<table><tr><td>binnen</td></tr></table>eind</td>' +
			'<td>daarbuiten</td>';

		const region = contentRegions(html);
		expect(region).toContain('binnen');
		expect(region).toContain('eind');
		expect(region).not.toContain('daarbuiten');
	});

	it('falls back to the whole document when the marker is absent', () => {
		// One page in the corpus, Kalmthoutsesteenweg.htm, has no ContentBody cell at all.
		expect(contentRegions('<p>geen markering</p>')).toBe('<p>geen markering</p>');
	});
});

describe('photoKey', () => {
	it('ignores the case of the extension, which the pages and the files disagree on', () => {
		expect(photoKey('Jaak Van den Bleeken - 26.08.2014.PNG')).toBe(
			photoKey('Jaak Van den Bleeken - 26.08.2014.png')
		);
	});

	it('ignores accents, which the pages and the filenames also disagree on', () => {
		expect(photoKey('Café De Pancras.jpg')).toBe(photoKey('Cafe De Pancras.jpg'));
	});

	it('decodes a percent-encoded reference', () => {
		expect(photoKey('Antwerpsesteenweg%20-%20Le%20Pr%C3%A9joli.jpg')).toBe(
			photoKey('Antwerpsesteenweg - Le Préjoli.jpg')
		);
	});

	it('keys on the basename, so a folder does not change the answer', () => {
		expect(photoKey('Café Pancras/Cafe De Pancras.jpg')).toBe(photoKey('Cafe De Pancras.jpg'));
	});
});

describe('resolvePhoto', () => {
	const photos = [
		{ id: 'a', p: 'Café Pancras/Cafe De Pancras.jpg' },
		{ id: 'b', p: 'Hoevensebaan/Cafe De Pancras.jpg' },
		{ id: 'c', p: 'Café Pancras/Jaak Van den Bleeken.png' }
	];
	const lookup = buildPhotoLookup(photos);

	it('resolves an unambiguous reference', () => {
		expect(resolvePhoto('Jaak Van den Bleeken.PNG', lookup)?.id).toBe('c');
	});

	it('returns null for a photograph this repository does not have', () => {
		expect(resolvePhoto('Villa Withof.jpg', lookup)).toBeNull();
	});

	it('breaks a tie towards the folder the rest of the page resolved to', () => {
		const preferred = unambiguousFolders(['Jaak Van den Bleeken.png'], lookup);
		expect(preferred).toEqual(new Set(['Café Pancras']));
		expect(resolvePhoto('Cafe De Pancras.jpg', lookup, preferred)?.id).toBe('a');
	});

	it('is stable when nothing settles the tie', () => {
		expect(resolvePhoto('Cafe De Pancras.jpg', lookup)?.id).toBe('a');
	});
});

describe('parseLegacyHtml', () => {
	const parse = (html: string) => parseLegacyHtml('test.htm', Buffer.from(html, 'latin1'));

	it('takes the first bold line as the page title', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KASTEEL X</b></p><p>Tekst.</p></td>'
		);
		expect(page.title).toBe('KASTEEL X');
	});

	it('reads a heading that is bold with a plain tail', () => {
		// `<u><b>De Mythe van de Pancras</b></u> (deel 1).` is how the corpus writes headings.
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p><u><b>De Mythe</b></u> (deel 1).</p><p>Verhaal.</p></td>'
		);

		expect(page.sections.map((section) => section.heading)).toEqual(['De Mythe (deel 1).']);
	});

	it('does not mistake a sentence with a bold name in it for a heading', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p>Hierover schreef <b>Rudi Staute</b> een uitgebreid stuk voor ons.</p></td>'
		);

		expect(page.sections).toHaveLength(1);
		expect(page.sections[0].heading).toBeUndefined();
	});

	it('reads an italic line under a photograph as its caption', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p><img src="Foto.jpg"></p><p><i>Foto - Marc Brans - 10.04.2014</i></p></td>'
		);

		expect(page.sections[0].parts).toEqual([
			{ kind: 'image', src: 'Foto.jpg', caption: 'Foto - Marc Brans - 10.04.2014' }
		]);
	});

	it('reads a closing signature as a credit, not as a new section', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p>Het verhaal loopt hier ten einde.</p><p><i><b>Rudi Staute</b></i></p></td>'
		);

		expect(page.sections).toHaveLength(1);
		expect(page.sections[0].parts).toContainEqual({
			kind: 'paragraph',
			text: 'Rudi Staute',
			credit: true
		});
	});

	it('treats a bold name before any prose as a heading rather than a credit', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p><b>Rudi Staute</b></p><p>Daarna komt het verhaal.</p></td>'
		);

		expect(page.sections[0].heading).toBe('Rudi Staute');
	});

	it('folds two headings in a row into a label and a title', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p><b>Nieuwe Wijk, 1983</b></p><p><b>3. Wildplassen</b></p><p>Tegen de middag ...</p></td>'
		);

		expect(page.sections).toHaveLength(1);
		expect(page.sections[0].kicker).toBe('Nieuwe Wijk, 1983');
		expect(page.sections[0].heading).toBe('3. Wildplassen');
	});

	it('drops the navigation link every page carries', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><b>KOP</b></p>' +
				'<p><a href="index.htm">terug naar de startpagina</a></p><p>Tekst.</p></td>'
		);

		const text = page.sections.flatMap((section) => section.parts);
		expect(text).toEqual([{ kind: 'paragraph', text: 'Tekst.' }]);
	});

	it('leaves the logo and banner out of the images', () => {
		const page = parse(
			'<td><!-- MSCellType="ContentBody" --><p><img src="gzvka-logo.JPG"></p>' +
				'<p><img src="Foto.jpg"></p></td>'
		);

		expect(page.images).toEqual(['Foto.jpg']);
	});
});

// These read the committed corpus. They are what keeps a change to the classification
// rules from quietly rewriting the archive's text: the numbers below were checked against
// the source pages by hand.
describe('the committed legacy corpus', () => {
	const hasCorpus = fs.existsSync(LEGACY_DIR);
	const maybe = hasCorpus ? describe : describe.skip;

	maybe('Pancras.htm', () => {
		const page = parseLegacyHtml(
			'Pancras.htm',
			fs.readFileSync(path.join(LEGACY_DIR, 'Pancras.htm'))
		);

		it('reads the page title from the page itself', () => {
			expect(page.title).toBe('CAFÉ PANCRAS');
		});

		it('finds the three parts of the myth, in order', () => {
			expect(page.sections.map((section) => section.heading)).toEqual([
				undefined,
				'De Mythe van de Pancras (deel 1).',
				'De Mythe van de Pancras (deel 2)',
				'De Mythe van de Pancras (deel 3)'
			]);
		});

		it('keeps the writing itself', () => {
			expect(page.proseLength).toBeGreaterThan(13000);
			const opening = page.sections[1].parts[0];
			expect(opening.kind).toBe('paragraph');
			if (opening.kind !== 'paragraph') throw new Error('expected a paragraph');
			expect(opening.text).toContain('Vertellen over dorpsfiguren');
		});

		it('references the four photographs the page shows, with their captions', () => {
			expect(page.images).toEqual([
				'Cafe De Pancras - Marc Brans - 10.04.2014.jpg',
				'Jaak Van den Bleeken - Gustaaf Donckers - 26.08.2014.PNG',
				'Cafe De Pancras - Robert Vingerhoed - 23.04.2014.jpg',
				'Cafe De Pancras en frituur - Rudi Staute - 20.09.2015.jpg'
			]);
		});

		it('credits Rudi Staute rather than starting a section named after him', () => {
			const credits = page.sections
				.flatMap((section) => section.parts)
				.filter((part) => part.kind === 'paragraph' && part.credit);

			expect(credits.length).toBeGreaterThan(0);
			expect(page.sections.map((section) => section.heading)).not.toContain('Rudi Staute');
		});
	});

	maybe('every page', () => {
		const files = fs.readdirSync(LEGACY_DIR).filter((name) => /\.html?$/i.test(name));

		it('is present in full', () => {
			expect(files).toHaveLength(101);
		});

		it("parses without throwing, and together holds the site's writing", () => {
			const total = files.reduce(
				(sum, name) =>
					sum + parseLegacyHtml(name, fs.readFileSync(path.join(LEGACY_DIR, name))).proseLength,
				0
			);

			// 290,389 at the time of writing. The bound catches a classification change that
			// silently drops paragraphs without breaking on ordinary editing.
			expect(total).toBeGreaterThan(280000);
		});

		it('never leaves a caption attached to the wrong photograph', () => {
			for (const name of files) {
				const page = parseLegacyHtml(name, fs.readFileSync(path.join(LEGACY_DIR, name)));

				for (const section of page.sections) {
					for (const part of section.parts) {
						// A caption only exists on an image part, so this asserts the invariant
						// the classifier relies on rather than a property of the corpus.
						if (part.kind === 'image' && part.caption !== undefined) {
							expect(part.caption.trim()).not.toBe('');
						}
					}
				}
			}
		});
	});
});
