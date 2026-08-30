import { extensionOf, keepsakeName } from '../../../src/lib/keepsake';

/**
 * Saving a photograph.
 *
 * The filename is the part that outlives the visit: it is what somebody sees in their
 * downloads folder a year later, and it has to say what the picture is and where it came
 * from without them having to remember.
 */
describe('keepsakeName', () => {
	it('uses the title, the year and the archive', () => {
		expect(keepsakeName('Akkerstraat 1', '1962')).toBe('Akkerstraat 1 - 1962 - gzvKA.webp');
	});

	it('leaves the year out when the archive does not know it', () => {
		expect(keepsakeName('Akkerstraat 1')).toBe('Akkerstraat 1 - gzvKA.webp');
	});

	it('strips what a filesystem will not take', () => {
		// Archive titles carry slashes and colons: "Kerk O.L.V. / Sint-Jozef", "12:00".
		expect(keepsakeName('Kerk O.L.V. / Sint-Jozef')).toBe('Kerk O.L.V. Sint-Jozef - gzvKA.webp');
		expect(keepsakeName('a\\b:c*d?e"f<g>h|i')).toBe('a b c d e f g h i - gzvKA.webp');
	});

	it('never produces a nameless file', () => {
		expect(keepsakeName('')).toBe('foto - gzvKA.webp');
		expect(keepsakeName('   ')).toBe('foto - gzvKA.webp');
	});

	it('takes the extension it is given, so the file opens', () => {
		expect(keepsakeName('Akkerstraat 1', undefined, 'jpg')).toBe('Akkerstraat 1 - gzvKA.jpg');
	});
});

describe('extensionOf', () => {
	it('reads the extension actually served', () => {
		expect(extensionOf('/foto/Straat/Foto.jpg.thumb.webp')).toBe('webp');
		expect(extensionOf('/foto/Straat/Foto.JPG')).toBe('jpg');
	});

	it('ignores a query string or a fragment', () => {
		expect(extensionOf('/foto/a.webp?v=2')).toBe('webp');
		expect(extensionOf('/foto/a.png#x')).toBe('png');
	});

	it('falls back to webp rather than writing a file with no extension', () => {
		expect(extensionOf('/foto/no-extension-here')).toBe('webp');
	});
});
