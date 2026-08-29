/**
 * The little bit of the archive a page needs before it renders.
 *
 * Prerendering happens with no browser, so anything a page reaches for in `onMount` is
 * absent when the HTML is written - which is why the street pages first came out titled
 * with their own slug. The title, the description and the share image have to come from
 * `load`, and this is what they come from.
 *
 * Only the record for the one place or photograph is returned, never the whole index. That
 * matters twice over. SvelteKit serialises whatever `load` returns into the page, so
 * inlining a 1.1 MB index into each of 4,700 pages would add gigabytes to the site to save
 * one fetch the browser makes anyway - and these pages are prerendered, so their `load`
 * runs again in the browser on every client-side navigation.
 *
 * Which is also why this goes through `loadArchive` rather than fetching the index itself.
 * A second cache here would mean a visitor clicking through to a photograph downloaded the
 * same 1.1 MB twice: once for the head, once for the page. One cache, one download, and
 * the head says the same thing the page does about a photograph a curator has corrected.
 */

import type { Archive } from './archive';
import { loadArchive, thumbUrl } from './archive';

/** Just enough of a place for the head tags. */
export interface PlaceSummary {
	id: string;
	name: string;
	count: number;
}

export async function placeSummary(
	fetcher: typeof fetch,
	slug: string
): Promise<PlaceSummary | null> {
	const archive = await loadArchive(fetcher);
	const place = archive.placeById.get(slug);

	return place ? { id: place.id, name: place.name, count: place.count } : null;
}

/** Just enough of a photograph for the head tags. */
export interface PhotoSummary {
	id: string;
	title: string;
	place: string | null;
	year?: string;
	donor?: string;
	description?: string;
	/**
	 * The share image, root-relative.
	 *
	 * The thumbnail, not the larger copy. Both sizes together come to 443 MB and hosting
	 * keeps every version, so the deploy generates thumbnails only - which means an
	 * og:image pointing at the 1400 px file is a 404 for every link preview on the live
	 * site. It would have looked perfectly correct in the HTML.
	 *
	 * Built here rather than in the page, because the rule for turning a corpus path into
	 * an image URL lives in `archive.ts`, and a second copy of it in a head tag is how a
	 * preview quietly starts pointing at nothing.
	 */
	image: string;
}

export async function photoSummary(
	fetcher: typeof fetch,
	id: string
): Promise<PhotoSummary | null> {
	const archive = await loadArchive(fetcher);
	return summarisePhoto(archive, id);
}

/**
 * The first photograph in a story, for its link preview.
 *
 * A story shared on WhatsApp with no picture is a line of text among a hundred other lines
 * of text. The opening photograph is the one the writer chose to lead with, so it is the
 * one worth showing.
 */
export async function storyImage(
	fetcher: typeof fetch,
	photoIds: string[]
): Promise<string | null> {
	if (photoIds.length === 0) return null;

	const archive = await loadArchive(fetcher);
	for (const id of photoIds) {
		const photo = archive.photoById.get(id);
		if (photo) return thumbUrl(archive, photo);
	}

	return null;
}

function summarisePhoto(archive: Archive, id: string): PhotoSummary | null {
	const photo = archive.photoById.get(id);
	if (!photo) return null;

	const first = (photo.st ?? [])[0];
	const place = first ? archive.placeById.get(first)?.name ?? null : null;

	return {
		id: photo.id,
		title: photo.t,
		place,
		image: thumbUrl(archive, photo),
		...(photo.y ? { year: photo.y } : {}),
		...(photo.d ? { donor: photo.d } : {}),
		...(photo.desc ? { description: photo.desc } : {})
	};
}
