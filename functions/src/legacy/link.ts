/**
 * Joins the writing on the old website to the photographs in this repository.
 *
 * The old pages reference their images by bare filename - `src="Cafe De Pancras - Marc
 * Brans - 10.04.2014.jpg"` - and the archive stores that same photograph as
 * `Café Pancras/Cafe De Pancras - Marc Brans - 10.04.2014.jpg`. The filenames were never
 * renamed in between, so the basename is a real join key and not a guess: 2206 of the
 * references land on a file that is actually in the corpus.
 *
 * The remainder are photographs that exist on the live site but were never included in the
 * repository's `history-images` directory. They are reported by the build rather than
 * quietly dropped, because a missing photograph is a fact about the archive worth knowing.
 */

import { normalizeText } from '../../../sharedModels/text';

/**
 * The join key: a filename reduced to letters and digits.
 *
 * Case, accents, punctuation and the extension all vary between the page and the file on
 * disk - the page writes `.PNG` where the archive has `.png`, and `Café` where a filename
 * has `Cafe` - and none of that variation carries meaning.
 */
export function photoKey(reference: string): string {
	let name = reference;

	// A handful of references are percent-encoded, having been copied out of a URL bar.
	if (name.includes('%')) {
		try {
			name = decodeURIComponent(name);
		} catch {
			// Leave a malformed escape alone; the raw form still keys consistently.
		}
	}

	const base = name.split(/[\\/]/).pop() ?? name;
	return normalizeText(base.replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, '');
}

/** The little the linker needs to know about a photograph. */
export interface LinkablePhoto {
	id: string;
	/** Path under the corpus, e.g. "Café Pancras/Cafe De Pancras - Marc Brans - ....jpg". */
	p: string;
}

export interface PhotoLookup {
	byKey: Map<string, LinkablePhoto[]>;
}

export function buildPhotoLookup(photos: LinkablePhoto[]): PhotoLookup {
	const byKey = new Map<string, LinkablePhoto[]>();

	for (const photo of photos) {
		const key = photoKey(photo.p);
		if (key === '') continue;

		const existing = byKey.get(key);
		if (existing) existing.push(photo);
		else byKey.set(key, [photo]);
	}

	return { byKey };
}

/** The subject folder a corpus path sits in. */
export function folderOf(corpusPath: string): string {
	const parts = corpusPath.split('/');
	return parts.length > 1 ? parts[0] : '';
}

/**
 * Resolves one reference from a page to a photograph in the archive.
 *
 * A basename is not quite unique - the same photograph is occasionally filed under two
 * subjects - so when several candidates share a key the one in `preferredFolders` wins.
 * Those folders are the ones the rest of the same page resolved to unambiguously, which is
 * a far better tie-breaker than alphabetical order: a page about the Pancras means the copy
 * filed under "Café Pancras".
 */
export function resolvePhoto(
	reference: string,
	lookup: PhotoLookup,
	preferredFolders: ReadonlySet<string> = new Set()
): LinkablePhoto | null {
	const candidates = lookup.byKey.get(photoKey(reference));
	if (!candidates || candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];

	return (
		candidates.find((photo) => preferredFolders.has(folderOf(photo.p))) ??
		// Stable, so a rebuild does not silently move a story's photograph.
		[...candidates].sort((a, b) => a.p.localeCompare(b.p))[0]
	);
}

/**
 * The folders a page resolved to without ambiguity, used to settle the ambiguous ones.
 * Two passes, because the unambiguous references are what make the rest decidable.
 */
export function unambiguousFolders(references: string[], lookup: PhotoLookup): Set<string> {
	const folders = new Set<string>();

	for (const reference of references) {
		const candidates = lookup.byKey.get(photoKey(reference));
		if (candidates?.length === 1) folders.add(folderOf(candidates[0].p));
	}

	return folders;
}
