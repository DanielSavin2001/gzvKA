/**
 * Photographs a curator approved since the last build.
 *
 * The upload queue ends here. Somebody sends a photograph in, a curator titles it, places
 * it, dates it and approves it - and until this file existed, nothing on the website ever
 * asked for the result. The photograph moved into the public bucket and appeared nowhere:
 * not in the search, not on its street's page, not on the map, not on the donor's page.
 * The upload page told the contributor it would take a few days, and the README said
 * approving publishes immediately; both were describing an endpoint nobody called.
 *
 * Fails soft, like the photo-edit overlay and the place pins: no backend, no network, or a
 * nonsense answer all mean "nothing new since the build", and the archive is exactly the
 * generated index.
 */

import type { PublishedPhoto } from '../../sharedModels/submission';
import type { ArchivePhoto } from './archive';

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/** Bounded for the same reason the edits overlay is: a visitor is waiting on it. */
const TIMEOUT_MS = 3_000;

let cache: ArchivePhoto[] | null = null;

/**
 * An approved submission as the archive's own photograph.
 *
 * `u` carries the absolute Cloud Storage URL, because these bytes are not under
 * `static/foto/` and no thumbnail was ever generated for them - the image functions return
 * this instead of composing a path.
 */
function asArchivePhoto(published: PublishedPhoto): ArchivePhoto {
	const photo: ArchivePhoto = {
		id: published.id,
		p: published.url,
		u: published.url,
		t: published.title,
		// Its own heading in the browse pages, so a photograph that arrived this way is never
		// silently mixed into a subject folder that does not contain it.
		s: 'Ingestuurd door bezoekers',
		st: published.places,
		nieuw: true
	};

	if (published.houseNumber != null) photo.hn = published.houseNumber;
	if (published.donor) photo.d = published.donor;
	if (published.year) photo.y = published.year;
	if (published.description) photo.desc = published.description;

	return photo;
}

export async function loadPublished(fetcher: typeof fetch = fetch): Promise<ArchivePhoto[]> {
	if (cache) return cache;

	// No backend configured: the normal state for a fresh clone.
	if (!FUNCTIONS_BASE) return [];

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}publishedPhotos`, {
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) return [];

		const parsed = (await response.json()) as { photos?: PublishedPhoto[] };
		cache = (parsed.photos ?? []).map(asArchivePhoto);
		return cache;
	} catch {
		return [];
	}
}

/** Forgets what was fetched, so a curator sees their own approval without a reload. */
export function forgetPublished(): void {
	cache = null;
}
