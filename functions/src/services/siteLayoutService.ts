/**
 * Where a page's arrangement lives once a curator has changed one.
 *
 * One document per page, keyed by its route with the slashes replaced: Firestore document
 * ids cannot contain a slash, and "/" - the home page, the one most likely to be
 * rearranged - is the first id anybody would try.
 */

import type { PageLayout } from '../../../sharedModels/site-layout';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const SITE_LAYOUT_COLLECTION = 'site-layout';

/** A ceiling, not a cursor: the registry decides how many pages can be rearranged. */
const MAX_PAGES = 200;

export interface StoredLayout extends PageLayout {
	page: string;
	editedBy: string;
	editedAt: string;
}

/**
 * A route as a document id.
 *
 * "/" becomes "index" and "/over-ons" becomes "over-ons", which is both legal and readable
 * in the Firebase console - somebody looking at the collection should be able to tell which
 * page a row is about without decoding it.
 */
export function documentIdFor(page: string): string {
	const trimmed = page.replace(/^\/+|\/+$/g, '');
	return trimmed === '' ? 'index' : trimmed.replace(/\//g, '--');
}

/** Stores one page's arrangement. */
export async function save(
	page: string,
	layout: PageLayout,
	curator: AdminIdentity
): Promise<StoredLayout> {
	const stored: StoredLayout = {
		page,
		order: layout.order,
		hidden: layout.hidden,
		editedBy: curator.name,
		editedAt: new Date().toISOString()
	};

	await firestore.collection(SITE_LAYOUT_COLLECTION).doc(documentIdFor(page)).set(stored);
	return stored;
}

/** Puts one page back to the arrangement it ships with. */
export async function remove(page: string): Promise<void> {
	await firestore.collection(SITE_LAYOUT_COLLECTION).doc(documentIdFor(page)).delete();
}

/** Every rearranged page, keyed by route. Public. */
export async function all(): Promise<Record<string, PageLayout>> {
	const snapshot = await firestore.collection(SITE_LAYOUT_COLLECTION).limit(MAX_PAGES).get();

	const layout: Record<string, PageLayout> = {};
	for (const document of snapshot.docs) {
		const stored = document.data() as StoredLayout;
		if (typeof stored?.page !== 'string') continue;

		layout[stored.page] = {
			order: Array.isArray(stored.order) ? stored.order : [],
			hidden: Array.isArray(stored.hidden) ? stored.hidden : []
		};
	}

	return layout;
}

/** The same, with who last changed each one, for the curator's desk. */
export async function allStored(): Promise<Record<string, StoredLayout>> {
	const snapshot = await firestore.collection(SITE_LAYOUT_COLLECTION).limit(MAX_PAGES).get();

	const stored: Record<string, StoredLayout> = {};
	for (const document of snapshot.docs) {
		const row = document.data() as StoredLayout;
		if (typeof row?.page === 'string') stored[row.page] = row;
	}

	return stored;
}
