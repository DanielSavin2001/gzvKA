/**
 * How the curators have arranged the pages.
 *
 * The companion to `site-copy`: that one carries the words, this one carries the order they
 * come in and whether a block appears at all. Same shape, same guarantees - the page renders
 * its shipped arrangement until the overlay lands, so the prerendered HTML is complete and
 * an unreachable overlay costs nothing.
 */

import { derived, writable } from 'svelte/store';

import type { PageLayout } from '../../sharedModels/site-layout';
import { arrange, readLayoutFile } from '../../sharedModels/site-layout';

export type { PageBlock, PageLayout } from '../../sharedModels/site-layout';
export { blockFor, blocksOf, layoutPages, PAGE_BLOCKS } from '../../sharedModels/site-layout';

import { functionsBase, overlayInit, overlayUrl } from './overlay';

const TIMEOUT_MS = 3_000;

let cache: Record<string, PageLayout> | null = null;

/** The last copy `npm run archive:pull` wrote, for a clone with no Firebase project. */
async function committed(fetcher: typeof fetch): Promise<Record<string, PageLayout>> {
	try {
		const response = await fetcher('/data/site-layout.json');
		if (!response.ok) return {};

		return readLayoutFile(await response.json());
	} catch {
		return {};
	}
}

/** Every rearranged page. */
export async function loadSiteLayout(
	fetcher: typeof fetch = fetch,
	options: { fresh?: boolean } = {}
): Promise<Record<string, PageLayout>> {
	if (cache && !options.fresh) return cache;

	if (!functionsBase()) return committed(fetcher);

	try {
		const response = await fetcher(
			overlayUrl('siteLayout', options.fresh),
			overlayInit(Boolean(options.fresh), TIMEOUT_MS)
		);
		if (!response.ok) return committed(fetcher);

		cache = readLayoutFile(await response.json());
		return cache;
	} catch {
		return committed(fetcher);
	}
}

/** Forgets what was fetched, so a curator sees their own change without a reload. */
export function forgetSiteLayout(): void {
	cache = null;
}

const stored = writable<Record<string, PageLayout>>({});

/**
 * `$blocks('/')` gives the ids to render, in order.
 *
 * A function rather than a map for the same reason `$copy` is: a page writes one expression,
 * re-renders when the overlay lands, and needs to know nothing about overlays.
 */
export const blocks = derived(stored, ($stored) => (page: string) => arrange(page, $stored));

let started = false;

/** Fetches once, from the root layout on mount. Never on the server. */
export async function startSiteLayout(): Promise<void> {
	if (started || typeof window === 'undefined') return;
	started = true;

	try {
		stored.set(await loadSiteLayout());
	} catch {
		// Fails soft: the page is already drawn as it ships.
	}
}

/** Re-reads past every cache and pushes the result in, for the curator's desk. */
export async function refreshSiteLayout(): Promise<void> {
	forgetSiteLayout();
	stored.set(await loadSiteLayout(fetch, { fresh: true }));
}
