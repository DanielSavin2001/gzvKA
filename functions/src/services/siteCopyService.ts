/**
 * Where the site's own words live once a curator has rewritten one.
 *
 * One document per slot rather than one document holding them all, for the reason the photo
 * edits are keyed by photograph: two curators saving two different sentences at the same
 * moment must not overwrite each other, and with a single document the second save wins the
 * whole page.
 *
 * The previous text is kept on the document it replaced. Not a full history - that is a
 * feature nobody has asked for - but enough that a curator who has just mangled the front
 * page can put it back without knowing what it used to say, which they will not.
 */

import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const SITE_COPY_COLLECTION = 'site-copy';

/**
 * A ceiling, not a cursor. The registry decides how many slots exist; anything beyond that
 * many documents means something is writing that should not be, and the read is bounded so
 * one runaway writer cannot make every page load slow.
 */
const MAX_SLOTS = 500;

export interface StoredCopy {
	id: string;
	text: string;
	/** What it said before this edit, so one click puts it back. */
	was?: string;
	editedBy: string;
	editedAt: string;
}

function now(): string {
	return new Date().toISOString();
}

/** Stores one rewritten sentence, remembering what it replaced. */
export async function save(id: string, text: string, curator: AdminIdentity): Promise<StoredCopy> {
	const document = firestore.collection(SITE_COPY_COLLECTION).doc(id);
	const existing = (await document.get()).data() as StoredCopy | undefined;

	const stored: StoredCopy = {
		id,
		text,
		editedBy: curator.name,
		editedAt: now(),
		// Only a real previous edit is worth remembering. The shipped words are in the
		// registry and reverting to those is what deleting the document does.
		...(existing?.text ? { was: existing.text } : {})
	};

	await document.set(stored);
	return stored;
}

/** Puts one sentence back to the words the site shipped with. */
export async function remove(id: string): Promise<void> {
	await firestore.collection(SITE_COPY_COLLECTION).doc(id).delete();
}

/**
 * Every rewritten sentence, keyed by slot id. Public.
 *
 * Returns the text alone rather than the stored document: who edited a sentence and when is
 * the curators' business, and this answer is served to every visitor.
 */
export async function all(): Promise<Record<string, string>> {
	const snapshot = await firestore.collection(SITE_COPY_COLLECTION).limit(MAX_SLOTS).get();

	const copy: Record<string, string> = {};
	for (const document of snapshot.docs) {
		const stored = document.data() as StoredCopy;
		if (typeof stored?.text === 'string' && stored.text.trim() !== '')
			copy[document.id] = stored.text;
	}

	return copy;
}

/** The same, with the editing history, for the curator's own desk. */
export async function allStored(): Promise<Record<string, StoredCopy>> {
	const snapshot = await firestore.collection(SITE_COPY_COLLECTION).limit(MAX_SLOTS).get();

	const stored: Record<string, StoredCopy> = {};
	for (const document of snapshot.docs) stored[document.id] = document.data() as StoredCopy;

	return stored;
}
