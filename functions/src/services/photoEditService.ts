/**
 * Where a curator's corrections to existing photographs live.
 *
 * Firestore rather than the repository, because a correction has to show up on the site the
 * moment it is made - waiting for a rebuild and a deploy to fix a wrong street means the
 * wrong street stays up for a week, and nobody corrects anything twice.
 *
 * The edits are readable by anyone, which sounds wrong for an admin feature and is not:
 * they *are* the site's content once made, exactly like the photographs themselves. What is
 * protected is writing them.
 */

import type { PhotoEdit, PhotoFields } from '../../../sharedModels/photo-edit';
import { isEmpty, PhotoEditError } from '../../../sharedModels/photo-edit';
import type { AdminIdentity } from './admin-auth';
import { firestore } from './externalServices';

export const PHOTO_EDIT_COLLECTION = 'photo-edits';

/**
 * How many the site will fetch at once.
 *
 * This is a real ceiling rather than a paging cursor, and it is deliberate: past a few
 * thousand hand-corrections the right move is to fold them back into the generated index
 * with a build, not to ship an ever-growing overlay to every visitor.
 */
const MAX_EDITS = 5000;

function now(): string {
	return new Date().toISOString();
}

/** Stores a curator's patch. An edit that changes nothing is refused rather than stored. */
export async function save(
	photoId: string,
	fields: PhotoFields,
	curator: AdminIdentity
): Promise<PhotoEdit> {
	if (!photoId.trim()) throw new PhotoEditError('Geen foto opgegeven.');
	if (isEmpty(fields)) throw new PhotoEditError('Er is niets gewijzigd.');

	const edit: PhotoEdit = {
		...fields,
		id: photoId,
		editedBy: curator.email,
		editedAt: now()
	};

	// `set` without merge, so an edit is the whole patch and clearing a field actually
	// removes it. Merging would make a cleared field impossible to express.
	await firestore.collection(PHOTO_EDIT_COLLECTION).doc(photoId).set(edit);
	return edit;
}

/** Everything the site needs to overlay. Public. */
export async function all(): Promise<Record<string, PhotoEdit>> {
	const snapshot = await firestore.collection(PHOTO_EDIT_COLLECTION).limit(MAX_EDITS).get();

	const edits: Record<string, PhotoEdit> = {};
	for (const document of snapshot.docs) {
		edits[document.id] = document.data() as PhotoEdit;
	}

	return edits;
}

/**
 * How many photographs one rename may touch.
 *
 * Firestore commits at most 500 writes per batch, so this is chunked rather than capped at
 * 500 - the biggest donor in the archive has 362 photographs and a merge of two of them
 * could exceed it. The ceiling exists to stop a malformed request rewriting the archive.
 */
const MAX_RENAME = 1000;

/** Firestore's own limit on one committed batch. */
const BATCH_LIMIT = 500;

/**
 * Puts one donor's name on many photographs at once - a rename, or a merge of two spellings.
 *
 * A donor is not a record anywhere: it is the string `d` on each photograph, and identity is
 * `slugify(d)` computed when the site builds its list. So renaming somebody, or merging
 * "J. Van Elst" into "Johan Van Elst", is exactly this - the same string written onto every
 * photograph that carried the old one. Doing it one save at a time from the browser meant 88
 * round trips for one man, which is why nobody did it.
 *
 * Which photographs those are is decided by the caller, not here. The archive index is a
 * static file the website fetches; the functions never load it, and the curator's page is
 * already holding it. Sending the ids is honest about where that knowledge lives.
 *
 * `merge: true`, unlike `save` above, and the difference matters. `save` writes a whole patch
 * and clearing a field there has to mean something. This changes one field on photographs
 * that may already carry a corrected title, place or year, and a plain `set` would silently
 * throw those away - a donor rename that quietly undid nine other corrections would be a
 * far worse bug than the one it fixes.
 */
export async function renameDonor(
	photoIds: string[],
	donor: string,
	curator: AdminIdentity
): Promise<number> {
	const name = donor.trim();
	if (!name) throw new PhotoEditError('Geen naam opgegeven.');
	if (name.length > 200) throw new PhotoEditError('Die naam is te lang.');

	const ids = [...new Set(photoIds.map((id) => id.trim()).filter(Boolean))];
	if (ids.length === 0) throw new PhotoEditError("Geen foto's opgegeven.");
	if (ids.length > MAX_RENAME) {
		throw new PhotoEditError(`Dat zijn er te veel in één keer (maximaal ${MAX_RENAME}).`);
	}

	const stamped = { donor: name, editedBy: curator.email, editedAt: now() };

	for (let start = 0; start < ids.length; start += BATCH_LIMIT) {
		const batch = firestore.batch();
		for (const id of ids.slice(start, start + BATCH_LIMIT)) {
			batch.set(
				firestore.collection(PHOTO_EDIT_COLLECTION).doc(id),
				{ id, ...stamped },
				{ merge: true }
			);
		}
		await batch.commit();
	}

	return ids.length;
}

/** Puts a photograph back to whatever the generated index says about it. */
export async function remove(photoId: string): Promise<void> {
	await firestore.collection(PHOTO_EDIT_COLLECTION).doc(photoId).delete();
}
