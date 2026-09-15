/**
 * The site's own words, as the curators have rewritten them.
 *
 * A store rather than a one-off fetch, because the pages that render this text are
 * prerendered: the flat HTML a visitor receives already carries the words the site shipped
 * with, and this swaps in anything a curator has changed once it arrives. That ordering is
 * the whole design. A search engine, a cold load and a browser with no JavaScript all get
 * real prose; nobody ever sees an empty heading while an overlay is in flight.
 *
 * Fails soft like every other overlay here. No backend, no network, or a nonsense answer all
 * mean "nothing has been rewritten", and the site reads exactly as it was built.
 */

import { derived, writable } from 'svelte/store';

import { readCopyFile, say } from '../../sharedModels/site-copy';

export type { CopySlot } from '../../sharedModels/site-copy';
export { COPY_LIMITS, COPY_SLOTS, copyPages, slotFor } from '../../sharedModels/site-copy';

import { functionsBase, overlayInit, overlayUrl } from './overlay';

/** Bounded like the others: a visitor is waiting on it, and prose is not worth a stall. */
const TIMEOUT_MS = 3_000;

let cache: Record<string, string> | null = null;

/**
 * The last copy `npm run archive:pull` wrote.
 *
 * Missing is not an error - the file only exists once somebody has pulled - but when it is
 * there it is what makes a fresh clone reproduce the site the curators actually made,
 * without a Firebase project.
 */
async function committed(fetcher: typeof fetch): Promise<Record<string, string>> {
	try {
		const response = await fetcher('/data/site-copy.json');
		if (!response.ok) return {};

		return readCopyFile(await response.json());
	} catch {
		return {};
	}
}

/**
 * Everything the curators have rewritten.
 *
 * `fresh: true` bypasses the endpoint's cache as well as this module's, which the curator's
 * own desk needs: without it they save a sentence, reload to check, and are shown the answer
 * from before their change - the exact shape of bug the donor merge already taught this
 * codebase once.
 */
export async function loadSiteCopy(
	fetcher: typeof fetch = fetch,
	options: { fresh?: boolean } = {}
): Promise<Record<string, string>> {
	if (cache && !options.fresh) return cache;

	if (!functionsBase()) return committed(fetcher);

	try {
		const response = await fetcher(
			overlayUrl('siteCopy', options.fresh),
			overlayInit(Boolean(options.fresh), TIMEOUT_MS)
		);
		if (!response.ok) return committed(fetcher);

		cache = readCopyFile(await response.json());
		return cache;
	} catch {
		return committed(fetcher);
	}
}

/** Forgets what was fetched, so a curator sees their own rewrite without a reload. */
export function forgetSiteCopy(): void {
	cache = null;
}

/**
 * What the curators have rewritten, as the pages see it.
 *
 * A writable behind a derived store rather than a `readable` with the fetch inside it,
 * because a revert has to be able to empty it and the curator's desk has to be able to push
 * a fresh answer in. A `readable` only hands its `set` to the subscriber that started it,
 * which makes both of those impossible - and quietly: the save would succeed and the page
 * would go on showing the old sentence.
 */
const overrides = writable<Record<string, string>>({});

/**
 * `$copy('over-ons.intro')` gives the curator's words if there are any and the shipped ones
 * otherwise.
 *
 * A function rather than a map so a page writes one expression and re-renders when the
 * overlay lands, without every page having to know that an overlay exists at all.
 */
export const copy = derived(overrides, ($overrides) => (id: string) => say($overrides, id));

let started = false;

/**
 * Fetches the overlay once and pushes it into `copy`.
 *
 * Called from the root layout on mount. Never on the server: prerendering has no `window`,
 * and rendering the shipped words into the flat files is exactly what should happen - they
 * are what a search engine, a cold load and a browser without JavaScript get.
 */
export async function startSiteCopy(): Promise<void> {
	if (started || typeof window === 'undefined') return;
	started = true;

	try {
		overrides.set(await loadSiteCopy());
	} catch {
		// Fails soft: the shipped words are already on the screen.
	}
}

/** Re-reads past every cache and pushes the result in, for the curator's desk after a save. */
export async function refreshSiteCopy(): Promise<void> {
	forgetSiteCopy();
	overrides.set(await loadSiteCopy(fetch, { fresh: true }));
}
