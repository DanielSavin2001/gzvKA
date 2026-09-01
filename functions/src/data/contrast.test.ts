import * as fs from 'fs';
import * as path from 'path';

import {
	AA_NORMAL,
	GRAYS,
	GROUNDS,
	contrastRatio,
	luminanceOf,
	passesAA
} from '../../../sharedModels/contrast';

/**
 * Whether the small grey print is actually readable.
 *
 * The archive's readers are mostly in their seventies, and what they are squinting at is the
 * small grey line: the photograph count beside a street name, "Foto 12 van 216", the subject
 * under a card. Those lines were set in `text-gray-500`, which is a fine secondary colour and
 * passes on white at 4.83 - and measures 4.40 on this site's warm paper, which fails. It
 * fails by a tenth of a point, on a ground chosen to make the site feel like a photo album.
 * Nobody was ever going to catch that by looking at it.
 *
 * So the numbers are asserted rather than quoted, and the one rule that holds on every ground
 * this site paints is enforced over the real files.
 */

describe('the contrast arithmetic', () => {
	it('agrees with the reference values for black and white', () => {
		expect(luminanceOf('#000000')).toBeCloseTo(0, 10);
		expect(luminanceOf('#ffffff')).toBeCloseTo(1, 10);
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
	});

	it('does not care which colour is the text', () => {
		expect(contrastRatio(GRAYS.gray500, GROUNDS.paper)).toBeCloseTo(
			contrastRatio(GROUNDS.paper, GRAYS.gray500),
			10
		);
	});

	it('reads three-digit hex the same as six', () => {
		expect(luminanceOf('#fff')).toBeCloseTo(luminanceOf('#ffffff'), 10);
	});

	it('refuses something that is not a colour', () => {
		expect(() => luminanceOf('paper')).toThrow();
	});
});

describe('the greys this site sets text in', () => {
	it('fails gray-500 on the paper ground, and only just', () => {
		// The whole reason this file exists. 4.40 against a bar of 4.5.
		const ratio = contrastRatio(GRAYS.gray500, GROUNDS.paper);
		expect(ratio).toBeCloseTo(4.3985, 3);
		expect(passesAA(GRAYS.gray500, GROUNDS.paper)).toBe(false);
	});

	it('passes gray-500 on white, which is why nobody noticed', () => {
		expect(contrastRatio(GRAYS.gray500, GROUNDS.white)).toBeCloseTo(4.8345, 3);
		expect(passesAA(GRAYS.gray500, GROUNDS.white)).toBe(true);
	});

	it('passes gray-600 on the paper ground with room to spare', () => {
		expect(contrastRatio(GRAYS.gray600, GROUNDS.paper)).toBeCloseTo(6.8759, 3);
		expect(passesAA(GRAYS.gray600, GROUNDS.paper)).toBe(true);
	});

	it('fails gray-400 on every ground this site has, light or dark card', () => {
		// 2.31 on paper, 2.54 on white. There is no ground in this palette where it passes,
		// which is what makes the rule below expressible as a rule.
		for (const ground of [GROUNDS.paper, GROUNDS.paperBase, GROUNDS.white, GROUNDS.gray50]) {
			expect(passesAA(GRAYS.gray400, ground)).toBe(false);
		}
		expect(contrastRatio(GRAYS.gray400, GROUNDS.white)).toBeCloseTo(2.5388, 3);
	});

	it('fails gray-500 in dark mode too', () => {
		// The measurement that corrected the plan for this work, which had it at 4.5 and
		// therefore left the footer's `dark:text-gray-500` alone. It is 3.67.
		expect(contrastRatio(GRAYS.gray500, GROUNDS.gray900)).toBeCloseTo(3.6694, 3);
		expect(passesAA(GRAYS.gray500, GROUNDS.gray900)).toBe(false);

		// And gray-400, which fails in light mode, is the right answer in dark.
		expect(contrastRatio(GRAYS.gray400, GROUNDS.gray900)).toBeCloseTo(6.9873, 3);
		expect(passesAA(GRAYS.gray400, GROUNDS.gray900)).toBe(true);
	});

	it('puts the bar where the standard puts it', () => {
		expect(AA_NORMAL).toBe(4.5);
	});
});

describe('the public pages', () => {
	const routes = path.join(__dirname, '..', '..', '..', 'src', 'routes');

	/** Every .svelte file a visitor can reach. `/beheer` is a curator's tool, not a public page. */
	function publicFiles(directory: string, found: string[] = []): string[] {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === 'beheer') continue;
				publicFiles(full, found);
			} else if (entry.name.endsWith('.svelte')) {
				found.push(full);
			}
		}

		return found;
	}

	/**
	 * Components only `/beheer` renders, which happen to live in the shared components folder.
	 *
	 * Excluding by directory is not enough and the difference is not cosmetic: seven of the
	 * files that match live beside the public components and are imported by the curator's
	 * page alone.
	 */
	const CURATOR_ONLY = [
		'PinPicker.svelte',
		'PlaceChooser.svelte',
		'PhotoEditor.svelte',
		'DonorDesk.svelte',
		'PlaceDesk.svelte',
		'PlaceShapeEditor.svelte',
		'DonorPicker.svelte',
		'DatingDesk.svelte'
	];

	it('sets no light-mode text in gray-400', () => {
		// The one rule that can be checked from the source alone, because it holds on every
		// ground in the palette: 2.31 on paper, 2.54 on white, 2.41 on paper-base.
		//
		// It is not hypothetical. The footer carried `text-gray-400 dark:text-gray-500` on two
		// lines - "Met dank aan" and the copyright - which is the worst contrast on the site
		// in BOTH themes at once, 2.54 light and 3.67 dark. Neither the design review nor the
		// improvement notes caught it; the arithmetic did.
		const offenders: string[] = [];

		for (const file of publicFiles(routes)) {
			if (CURATOR_ONLY.includes(path.basename(file))) continue;

			const lines = fs.readFileSync(file, 'utf8').split('\n');
			lines.forEach((line, index) => {
				// `dark:text-gray-400` is correct and common - 6.99 on gray-900. Only the
				// unprefixed class is the failure.
				const light = line.replace(/\bdark:text-gray-400\b/g, '');
				if (/\btext-gray-400\b/.test(light)) {
					offenders.push(`${path.relative(routes, file)}:${index + 1}`);
				}
			});
		}

		expect(offenders).toEqual([]);
	});
});
