/**
 * Light or dark, and remembering which.
 *
 * Three states rather than two. "System" is the honest default: a visitor who has told
 * their operating system they prefer dark has already answered this question once, and
 * asking again by starting light is ignoring them. A visitor who picks light or dark here
 * has overruled that, and the override is what gets stored.
 *
 * The value lives under `color-theme`, the key flowbite-svelte's toggle used back when
 * that library was in the project. Kept so nobody's stored preference is forgotten.
 *
 * The class is put on `<html>` by a blocking script in `app.html` before anything paints.
 * Doing it here instead would mean every page renders light for a frame and then flips,
 * which is worse on this site than most: it is prerendered, so the white page is already
 * on screen before any JavaScript has run at all.
 */

export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'color-theme';

const THEMES: Theme[] = ['light', 'dark', 'system'];

export function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && THEMES.includes(value as Theme);
}

/** What was chosen, or "system" when nothing was. */
export function stored(): Theme {
	try {
		const value = localStorage.getItem(THEME_KEY);
		return isTheme(value) ? value : 'system';
	} catch {
		// Private browsing, or storage switched off. Follow the system and forget it.
		return 'system';
	}
}

/** Whether the system asks for dark. False anywhere `matchMedia` is unavailable. */
export function systemPrefersDark(): boolean {
	try {
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	} catch {
		return false;
	}
}

/** What a choice actually resolves to right now. */
export function resolve(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
	return theme;
}

/**
 * Puts the choice on the document and stores it.
 *
 * `color-scheme` is set alongside the class so the browser's own furniture follows:
 * scrollbars, and the inside of every text input and select, which Tailwind's preflight
 * leaves on the user-agent white otherwise.
 */
export function apply(theme: Theme): void {
	const dark = resolve(theme) === 'dark';
	const root = document.documentElement;

	root.classList.toggle('dark', dark);
	root.style.colorScheme = dark ? 'dark' : 'light';

	try {
		if (theme === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, theme);
	} catch {
		// Nothing to store into. The choice still holds for this page.
	}
}

/**
 * Calls back when the system preference changes, but only while following it.
 *
 * Someone whose machine switches to dark at sunset should see the site follow, unless they
 * have said otherwise here.
 */
export function watchSystem(onChange: () => void): () => void {
	try {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	} catch {
		return () => undefined;
	}
}
