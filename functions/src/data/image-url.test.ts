import { encodePath } from '../../../sharedModels/image-path';

/**
 * How a corpus path becomes an image URL.
 *
 * These exist because 26 photographs were served the app shell instead of a picture, on a
 * live site, invisibly. `encodeURIComponent` per segment produces `%26` for an ampersand,
 * and Firebase Hosting normalises an incoming path with `decodeURI` semantics: `%20` comes
 * back as a space, `%26` does not come back at all. So it looked for a file whose name
 * contained a literal percent sign, failed, and fell through to the SPA rewrite - which
 * answers 200, so nothing anywhere reported an error.
 *
 * The rule these pin down is: encode what a URL cannot carry, and leave the sub-delimiters
 * alone, because the server will not give them back.
 */
describe('encodePath', () => {
	it('encodes spaces, which is most of the archive', () => {
		expect(encodePath('Akkerstraat - Nieuwe Wijk/Akkerstraat 1 - zd.jpg')).toBe(
			'Akkerstraat%20-%20Nieuwe%20Wijk/Akkerstraat%201%20-%20zd.jpg'
		);
	});

	it('keeps the separators as separators', () => {
		expect(encodePath('a/b/c.jpg')).toBe('a/b/c.jpg');
	});

	it('leaves the sub-delimiters raw, because the server will not decode them', () => {
		// The exact three that appear in the archive, and the exact bug.
		expect(encodePath('Hazenveld - Engel & Voelkers 1 - zd.jpg')).toContain('Engel%20&%20Voelkers');
		expect(encodePath('Postkaart Beukenhof + Logo.jpg')).toContain('Beukenhof%20+%20Logo');
		expect(encodePath('School, klooster - zd.JPG')).toContain('School,%20klooster');

		expect(encodePath('a & b')).not.toContain('%26');
		expect(encodePath('a + b')).not.toContain('%2B');
		expect(encodePath('a, b')).not.toContain('%2C');
	});

	it('encodes the accented characters, which the server does give back', () => {
		expect(encodePath('Café Pancras.jpg')).toBe('Caf%C3%A9%20Pancras.jpg');
		expect(encodePath('Kerstmarkt Kapellenbos ë.jpg')).toContain('%C3%AB');
	});

	it('encodes the two characters that would end the path early', () => {
		// No filename in the archive has either today. One that did would otherwise
		// truncate the URL silently, which is the failure mode this whole file is about.
		expect(encodePath('a#b.jpg')).toBe('a%23b.jpg');
		expect(encodePath('a?b.jpg')).toBe('a%3Fb.jpg');
	});

	it('leaves an apostrophe and brackets alone', () => {
		expect(encodePath("Klasfoto's/foto (1).jpg")).toBe("Klasfoto's/foto%20(1).jpg");
	});

	it('produces a path a URL parser accepts, for every shape in the archive', () => {
		const paths = [
			'Kasteel Hortensiahof/Hortensiahof Boomgaard & Groententuin - Frans Meeus - z.d.jpg',
			'Postkaarten - Groeten uit Kapellen/Postkaart Beukenhof + Logo.jpg',
			"Klasfoto's/Klasfoto - juf Mieke, meester De Sitter - 01.09.2016.jpg",
			'Café/Café Pancras é ë.jpg',
			'Wedstrijden GZVKA/Leo & Chris Beyers-Van Laer_1.jpg'
		];

		for (const path of paths) {
			const url = new URL(`https://gzvka.com/foto/${encodePath(path)}.thumb.webp`);
			// What the server decodes has to be the file we started from, or the lookup
			// misses and the visitor gets the app shell where a photograph should be.
			expect(decodeURI(url.pathname)).toBe(`/foto/${path}.thumb.webp`);
		}
	});
});
