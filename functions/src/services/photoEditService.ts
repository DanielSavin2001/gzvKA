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

/** Puts a photograph back to whatever the generated index says about it. */
export async function remove(photoId: string): Promise<void> {
	await firestore.collection(PHOTO_EDIT_COLLECTION).doc(photoId).delete();
}
