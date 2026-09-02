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
function asArchivePhoto(published: PublishedPhoto): ArchivePhoto | null {
	// Validated rather than trusted. This runs outside the fetch's try/catch, and a payload
	// that is valid JSON but the wrong shape - `places` missing, say - would put an
	// ArchivePhoto with no `st` into the array that `buildArchive` iterates, throwing where
	// nothing catches it and taking down every page that awaits the archive. The contract
	// this file promises is "a nonsense answer means nothing new since the build".
	if (typeof published?.id !== 'string' || typeof published.url !== 'string') return null;

	const photo: ArchivePhoto = {
		id: published.id,
		p: published.url,
		u: published.url,
		t: typeof published.title === 'string' ? published.title : published.id,
		// Its own heading in the browse pages, so a photograph that arrived this way is never
		// silently mixed into a subject folder that does not contain it.
		s: 'Ingestuurd door bezoekers',
		st: Array.isArray(published.places)
			? published.places.filter((place): place is string => typeof place === 'string')
			: []
	};

	if (typeof published.houseNumber === 'number') photo.hn = published.houseNumber;
	if (typeof published.donor === 'string') photo.d = published.donor;
	if (typeof published.year === 'string') photo.y = published.year;
	if (typeof published.description === 'string') photo.desc = published.description;
	// The date it was approved, shown where a corpus photograph shows the date the archive
	// received it - so an uploaded photograph does not sit among them with a blank there.
	if (typeof published.publishedAt === 'string') photo.a = published.publishedAt.slice(0, 10);
	if (typeof published.lat === 'number' && typeof published.lng === 'number') {
		photo.lat = published.lat;
		photo.lng = published.lng;
	}

	return photo;
}

/**
 * The approved uploads.
 *
 * `fresh: true` bypasses the endpoint's HTTP cache as well as this module's, which is what
 * a curator needs immediately after approving a photograph: the browser would otherwise
 * answer the refetch from the response it fetched before the approval, and the archive
 * would rebuild without the photograph that was just published.
 */
export async function loadPublished(
	fetcher: typeof fetch = fetch,
	options: { fresh?: boolean } = {}
): Promise<ArchivePhoto[]> {
	if (cache && !options.fresh) return cache;

	// No backend configured: the normal state for a fresh clone.
	if (!FUNCTIONS_BASE) return [];

	try {
		const response = await fetcher(`${FUNCTIONS_BASE}publishedPhotos`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			...(options.fresh ? { cache: 'reload' as RequestCache } : {})
		});
		if (!response.ok) return [];

		const parsed = (await response.json()) as { photos?: PublishedPhoto[] };
		cache = (Array.isArray(parsed?.photos) ? parsed.photos : [])
			.map(asArchivePhoto)
			.filter((photo): photo is ArchivePhoto => photo !== null);
		return cache;
	} catch {
		return [];
	}
}

/** Forgets what was fetched, so a curator sees their own approval without a reload. */
export function forgetPublished(): void {
	cache = null;
}
