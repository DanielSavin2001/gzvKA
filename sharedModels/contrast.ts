/**
 * How readable a colour is on the ground it sits on, in numbers.
 *
 * This archive is read by people in their seventies and eighties looking for the street they
 * grew up in, and the thing they are reading is usually the small grey line: the photograph
 * count beside a street, "Foto 12 van 216", the subject under a card. So the small grey line
 * is the one that has to be legible, and "looks fine on my screen" is not a measurement.
 *
 * The warm paper ground is what made this worth computing rather than eyeballing. Tailwind's
 * `text-gray-500` is a perfectly ordinary secondary colour and it passes on white - 4.83
 * against the 4.5 the standard asks for. On this site's #f7f4ec it measures 4.40 and fails,
 * and it fails by so little that nobody would ever catch it by looking. The paper is the
 * cause, and the paper is not going anywhere: it is what makes the site feel like a photo
 * album instead of a database.
 *
 * Lives here rather than in `src/lib` for the reason written at the top of `locate.ts`: this
 * is a pure function, and the jest suite in `functions/` cannot reach `src/lib`. A contrast
 * rule nobody can run is a contrast rule that quietly stops being true.
 */

/** One channel of an sRGB colour, linearised. The 0.03928 branch is the sRGB transfer curve. */
function linearise(channel: number): number {
	const value = channel / 255;
	return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** `#rgb` or `#rrggbb` to its three channels. */
export function channelsOf(hex: string): [number, number, number] {
	const text = hex.trim().replace(/^#/, '');
	const full =
		text.length === 3
			? text
					.split('')
					.map((character) => character + character)
					.join('')
			: text;

	if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a colour: ${hex}`);

	return [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16)
	];
}

/** WCAG relative luminance. */
export function luminanceOf(hex: string): number {
	const [red, green, blue] = channelsOf(hex);
	return 0.2126 * linearise(red) + 0.7152 * linearise(green) + 0.0722 * linearise(blue);
}

/**
 * The WCAG contrast ratio between two colours, 1 to 21.
 *
 * Symmetric: which one is the text and which the background does not change the number.
 */
export function contrastRatio(one: string, two: string): number {
	const first = luminanceOf(one);
	const second = luminanceOf(two);
	const lighter = Math.max(first, second);
	const darker = Math.min(first, second);

	return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for body text. Large text is allowed 3.0, and none of the greys here are large. */
export const AA_NORMAL = 4.5;

/** True when this pairing is readable enough for the small print. */
export function passesAA(text: string, ground: string): boolean {
	// Rounded to two places first, deliberately: a ratio of 4.4999 is 4.50 to everyone who
	// checks it in a browser tool, and a rule that disagrees with the tool the next person
	// reaches for is a rule they will stop believing.
	return Math.round(contrastRatio(text, ground) * 100) / 100 >= AA_NORMAL;
}

/** The grounds this site actually paints text on. */
export const GROUNDS = {
	/** The page itself. `paper` in tailwind.config. */
	paper: '#f7f4ec',
	/** The band behind the hero. `paper-base`. */
	paperBase: '#fcf9f0',
	white: '#ffffff',
	gray50: '#f9fafb',
	gray100: '#f3f4f6',
	amber50: '#fffbeb',
	red50: '#fef2f2',
	blue50: '#eff6ff',
	/** Dark mode. */
	gray800: '#1f2937',
	gray900: '#111827'
} as const;

/** The Tailwind greys this site sets text in. */
export const GRAYS = {
	gray400: '#9ca3af',
	gray500: '#6b7280',
	gray600: '#4b5563',
	gray700: '#374151'
} as const;
