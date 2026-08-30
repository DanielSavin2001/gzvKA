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
import type { PlaceFamily } from './archive';
import {
	loadArchive,
	photoAlt,
	placesInFamily,
	placesWithPhotos,
	sortForDisplay,
	thumbUrl
} from './archive';

/** The shape of the archive, for the home page: what there is, and what to call it. */
export interface ArchiveSummary {
	imageCount: number;
	streets: { id: string; name: string; count: number }[];
	areas: { id: string; name: string; count: number }[];
}

/**
 * The browse lists, without the archive behind them.
 *
 * Names and counts for 121 places, roughly 8 KB - against the 1.1 MB index the browser
 * fetches to build the same lists a moment later. The home page is where a crawler starts
 * and these are the only links out of it, so they cannot wait for that download.
 */
export async function archiveSummary(fetcher: typeof fetch): Promise<ArchiveSummary> {
	const archive = await loadArchive(fetcher);
	const named = ({ id, name, count }: { id: string; name: string; count: number }) => ({
		id,
		name,
		count
	});

	return {
		imageCount: archive.imageCount,
		streets: placesWithPhotos(archive, true).map(named),
		areas: placesWithPhotos(archive)
			.filter((place) => !place.isStreet && place.count >= 8)
			.map(named)
	};
}

/**
 * One family of places - the streets, the castles, or the districts - for its index page.
 *
 * Names and counts only. These three pages are what the menu's "Alle ..." entries point at
 * and the only complete lists on the site, so they have to be in the HTML rather than
 * appear once the archive has downloaded.
 */
export async function placeFamily(
	fetcher: typeof fetch,
	family: PlaceFamily
): Promise<{ id: string; name: string; count: number }[]> {
	const archive = await loadArchive(fetcher);

	return placesInFamily(archive, family).map(({ id, name, count }) => ({ id, name, count }));
}

/** One photograph as a place page lists it. */
export interface PhotoLink {
	id: string;
	title: string;
	alt: string;
	image: string;
	year?: string;
	houseNumber?: number;
}

/** A place, and the photographs it holds. */
export interface PlaceSummary {
	id: string;
	name: string;
	count: number;
	/**
	 * The photographs, in the order the page shows them.
	 *
	 * Here rather than left to the browser because these 121 pages are the only route to
	 * 4,504 photographs, and they were rendering their grids from an index fetched after
	 * the HTML had been served - so what a crawler received was a heading and the words
	 * "Bezig met laden ...". Every photograph was an orphan, reachable through the sitemap
	 * and nothing else, and a sitemap is a hint where a link is a path.
	 *
	 * About 200 bytes per photograph, so a typical street costs 5 KB and the largest 30 KB.
	 * That is the page's actual content; it is the one thing worth inlining.
	 */
	photos: PhotoLink[];
}

export async function placeSummary(
	fetcher: typeof fetch,
	slug: string
): Promise<PlaceSummary | null> {
	const archive = await loadArchive(fetcher);
	const place = archive.placeById.get(slug);
	if (!place) return null;

	const photos = sortForDisplay(archive.photosByPlace.get(slug) ?? []).map((photo) => ({
		id: photo.id,
		title: photo.t,
		alt: photoAlt(archive, photo),
		image: thumbUrl(archive, photo),
		...(photo.y ? { year: photo.y } : {}),
		...(photo.hn ? { houseNumber: photo.hn } : {})
	}));

	return { id: place.id, name: place.name, count: place.count, photos };
}

/** Just enough of a photograph for the head tags. */
export interface PhotoSummary {
	id: string;
	title: string;
	place: string | null;
	/** That place's own page, so a photograph is a way in rather than a dead end. */
	placeId?: string;
	/** The shared alt rule, so the picture describes itself the same way everywhere. */
	alt: string;
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

	// The street if there is one, the first place otherwise - the same choice `photoAlt`
	// makes, so the caption and the alt text name the same place.
	const places = (photo.st ?? []).map((id) => archive.placeById.get(id)).filter(Boolean);
	const found = places.find((place) => place?.isStreet) ?? places[0];

	return {
		id: photo.id,
		title: photo.t,
		place: found?.name ?? null,
		...(found ? { placeId: found.id } : {}),
		alt: photoAlt(archive, photo),
		image: thumbUrl(archive, photo),
		...(photo.y ? { year: photo.y } : {}),
		...(photo.d ? { donor: photo.d } : {}),
		...(photo.desc ? { description: photo.desc } : {})
	};
}
