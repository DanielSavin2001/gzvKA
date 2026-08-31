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

import type { Archive, ArchivePhoto } from './archive';
import { loadPairs } from './then-and-now';
import type { PlaceFamily } from './archive';
import {
	isPerson,
	loadArchive,
	photoAlt,
	placesInFamily,
	placesWithPhotos,
	sortForDisplay,
	thumbUrl,
	cardUrl,
	donors
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

/** A place a page draws on its own map. */
export interface MappablePlace {
	id: string;
	name: string;
	count: number;
	/** Decides the marker colour: blue for a street or square, green for everything else. */
	isStreet: boolean;
}

/**
 * The places the old site wrote about, for the map on `/verhalen`.
 *
 * The story index knows which place each story belongs to but not what that place is called
 * or how many photographs it holds - it is keyed by gazetteer id, and a map of a hundred
 * points labelled `kasteel-oude-gracht` is not a map. The names come from the archive here,
 * at prerender time, so they are in the HTML rather than behind a 1.1 MB download.
 *
 * About 5 KB for the whole list, once. Cheaper than the alternative and considerably cheaper
 * than the map having to wait for the index before it can draw anything.
 */
export async function storyPlaces(
	fetcher: typeof fetch,
	byPlace: Record<string, unknown[]>
): Promise<MappablePlace[]> {
	const archive = await loadArchive(fetcher);

	return Object.keys(byPlace)
		.map((id) => archive.placeById.get(id))
		.filter((place): place is NonNullable<typeof place> => place !== undefined)
		.map(({ id, name, count, isStreet }) => ({ id, name, count, isStreet }))
		.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** One decade of the archive, for the timeline. */
export interface Decade {
	/** Anchor and key, e.g. `1960` or `voor-1900`. */
	key: string;
	/** The big numeral: `1960`, or `Voor 1900`. */
	label: string;
	/** The years actually present in this band, e.g. `1960 – 1969`. */
	span: string;
	count: number;
	photos: PhotoLink[];
}

/**
 * The archive arranged by decade.
 *
 * 608 of the 4,504 photographs carry a year. That is the honest denominator and the page
 * says so: a timeline that quietly showed an eighth of the archive as though it were all
 * of it would be worse than no timeline.
 *
 * Everything before 1900 is one band. Seven photographs are spread across seventy years
 * there - maps from 1841 and 1846, a barn dated 1886 - and a row of decade bars each
 * holding one photograph says nothing except that the archive is old, which the single
 * band says better.
 */
export async function decades(fetcher: typeof fetch): Promise<{
	decades: Decade[];
	dated: number;
	total: number;
	/** The most recent dated photograph, as a link-preview card. */
	card: string | null;
}> {
	const archive = await loadArchive(fetcher);

	const dated = archive.photos
		.filter((photo) => /^\d{4}$/.test(photo.y ?? ''))
		.map((photo) => ({ photo, year: Number(photo.y) }));

	const bands = new Map<string, { year: number; photo: ArchivePhoto }[]>();
	for (const entry of dated) {
		const key = entry.year < 1900 ? 'voor-1900' : String(Math.floor(entry.year / 10) * 10);
		const band = bands.get(key);
		if (band) band.push(entry);
		else bands.set(key, [entry]);
	}

	const ordered = [...bands.entries()].sort(([a], [b]) => {
		if (a === 'voor-1900') return -1;
		if (b === 'voor-1900') return 1;
		return Number(a) - Number(b);
	});

	// The newest dated photograph leads the preview. The page itself is a century of
	// pictures and any one of them is arbitrary, so the most recent is at least a rule.
	const newest = dated.length
		? dated.reduce((latest, entry) => (entry.year >= latest.year ? entry : latest)).photo
		: null;

	return {
		dated: dated.length,
		total: archive.photos.length,
		card: newest ? cardUrl(archive, newest) : null,
		decades: ordered.map(([key, entries]) => {
			const years = entries.map((entry) => entry.year);
			const from = Math.min(...years);
			const to = Math.max(...years);

			return {
				key,
				label: key === 'voor-1900' ? 'Voor 1900' : key,
				span: from === to ? String(from) : `${from} \u2013 ${to}`,
				count: entries.length,
				photos: entries
					// Oldest first inside a decade, as everywhere else in the archive.
					.sort((a, b) => a.year - b.year || a.photo.t.localeCompare(b.photo.t))
					.map(({ photo }) => ({
						id: photo.id,
						title: photo.t,
						alt: photoAlt(archive, photo),
						image: thumbUrl(archive, photo),
						...(photo.y ? { year: photo.y } : {}),
						...(photo.hn ? { houseNumber: photo.hn } : {})
					}))
			};
		})
	};
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
	 * Someone the archive photographed, not somewhere it photographed.
	 *
	 * Needed in the head rather than only on the page: the structured data used to tell
	 * search engines that "Tajje de Kotter" was a Place with a postal address in Kapellen.
	 * He was a man who turned a hundred in 1976.
	 */
	person: boolean;
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
	/**
	 * The first photograph as a link-preview card.
	 *
	 * The page used to build this from the archive, which the browser fetches - so at
	 * prerender time it was null, and all 121 place pages went out with no share image at
	 * all. A street pasted into WhatsApp was a bare link.
	 */
	card: string | null;
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

	const first = sortForDisplay(archive.photosByPlace.get(slug) ?? [])[0];

	return {
		id: place.id,
		name: place.name,
		count: place.count,
		person: isPerson(place),
		photos,
		card: first ? cardUrl(archive, first) : null
	};
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
	 * The picture the page paints first, root-relative.
	 *
	 * The thumbnail, not the larger copy. Both sizes together come to 443 MB and hosting
	 * keeps every version, so the deploy does not generate the 1400 px file - which means
	 * pointing at it here would be a 404 on the live site. It would have looked perfectly
	 * correct in the HTML.
	 *
	 * Built here rather than in the page, because the rule for turning a corpus path into
	 * an image URL lives in `archive.ts`, and a second copy of it is how a page quietly
	 * starts pointing at nothing.
	 */
	image: string;
	/**
	 * The link preview, root-relative. A different picture from `image` on purpose.
	 *
	 * These two were one field, which meant whichever size satisfied the page lost the
	 * share and vice versa. The page wants the photograph's own shape; a preview wants a
	 * fixed 1200x630, because that is the floor under which Facebook and WhatsApp stop
	 * drawing the large card - and at 480 px on its long edge, the thumbnail was always
	 * under it.
	 */
	card: string;
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
		if (photo) return cardUrl(archive, photo);
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
		card: cardUrl(archive, photo),
		...(photo.y ? { year: photo.y } : {}),
		...(photo.d ? { donor: photo.d } : {}),
		...(photo.desc ? { description: photo.desc } : {})
	};
}

/** One donor, as the index page lists them. */
export interface DonorLink {
	slug: string;
	name: string;
	count: number;
}

/**
 * Everyone who gave the archive a photograph.
 *
 * From `load` rather than the browser, for the same reason the place lists are: this page
 * is the only route to 298 donor pages, and a crawler that receives a heading and the word
 * "Bezig met laden ..." finds none of them.
 */
export async function donorIndex(fetcher: typeof fetch): Promise<DonorLink[]> {
	const archive = await loadArchive(fetcher);

	return donors(archive).map(({ slug, name, photos }) => ({
		slug,
		name,
		count: photos.length
	}));
}

/** One donor, and everything they gave. */
export interface DonorSummary {
	slug: string;
	name: string;
	count: number;
	photos: PhotoLink[];
	/** The first of them, as a link-preview card. */
	card: string | null;
	/**
	 * The places they photographed, biggest first - what this person's giving amounts to.
	 *
	 * All of them, not the dozen the chips under the heading show: the map below draws from
	 * the same list, and a map that stops at twelve would leave a donor's quieter streets off
	 * it with nothing to say they were missing. The count is this person's photographs of that
	 * place, not the archive's.
	 */
	places: MappablePlace[];
	/** The years their photographs span, when enough of them are dated to say. */
	span: string | null;
}

export async function donorSummary(
	fetcher: typeof fetch,
	slug: string
): Promise<DonorSummary | null> {
	const archive = await loadArchive(fetcher);
	const donor = donors(archive).find((candidate) => candidate.slug === slug);
	if (!donor) return null;

	const ordered = sortForDisplay(donor.photos);

	// Which places this person photographed. A donor page that is only a grid of pictures
	// says what they gave; this says what they were interested in, which is the more
	// human fact about them.
	const counts = new Map<string, number>();
	for (const photo of donor.photos) {
		for (const placeId of photo.st) counts.set(placeId, (counts.get(placeId) ?? 0) + 1);
	}

	const places = [...counts.entries()]
		.map(([id, count]) => ({ place: archive.placeById.get(id), count }))
		// Tajje is filed as a place so his photographs stay findable, but "photographed
		// Tajje 4 times" is not a place somebody went.
		.filter(({ place }) => place !== undefined && !isPerson(place))
		.map(({ place, count }) => ({
			id: place!.id,
			name: place!.name,
			count,
			isStreet: place!.isStreet
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'));

	const years = donor.photos
		.map((photo) => Number(photo.y))
		.filter((year) => Number.isFinite(year))
		.sort((a, b) => a - b);

	return {
		slug: donor.slug,
		name: donor.name,
		count: donor.photos.length,
		photos: ordered.map((photo) => ({
			id: photo.id,
			title: photo.t,
			alt: photoAlt(archive, photo),
			image: thumbUrl(archive, photo),
			...(photo.y ? { year: photo.y } : {}),
			...(photo.hn ? { houseNumber: photo.hn } : {})
		})),
		card: ordered[0] ? cardUrl(archive, ordered[0]) : null,
		places,
		span: years.length
			? years[0] === years[years.length - 1]
				? String(years[0])
				: `${years[0]} \u2013 ${years[years.length - 1]}`
			: null
	};
}

/** One curated pairing, with both photographs resolved. */
export interface ThenAndNowView {
	then: PhotoLink & { label: string };
	now: PhotoLink & { label: string };
	note?: string;
}

/**
 * The curated then-and-now pairings.
 *
 * A pair whose photographs are not both in the archive is dropped rather than half-drawn -
 * an id can go stale when the index is rebuilt, and half a comparison is worse than none.
 */
export async function thenAndNow(fetcher: typeof fetch): Promise<{
	pairs: ThenAndNowView[];
	card: string | null;
}> {
	const [archive, curated] = await Promise.all([loadArchive(fetcher), loadPairs(fetcher)]);

	// The thumbnail, not the larger copy. The deploy ships thumbnails and cards only, so
	// `detailUrl` is a 404 on the live site - and unlike the photo page, which falls back
	// when the large file is missing, a slider would simply show two broken images. It is
	// the same trap the share image fell into.
	const link = (photo: ArchivePhoto) => ({
		id: photo.id,
		title: photo.t,
		alt: photoAlt(archive, photo),
		image: thumbUrl(archive, photo),
		...(photo.y ? { year: photo.y } : {}),
		// The year if there is one, the title if there is not. A slider handle labelled
		// "toen" and "nu" says less than one labelled "1912" and "2018".
		label: photo.y ?? photo.t
	});

	const pairs: ThenAndNowView[] = [];
	for (const pair of curated) {
		const before = archive.photoById.get(pair.then);
		const after = archive.photoById.get(pair.now);
		if (!before || !after) continue;

		pairs.push({
			then: link(before),
			now: link(after),
			...(pair.note ? { note: pair.note } : {})
		});
	}

	return {
		pairs,
		card: pairs[0] ? cardUrl(archive, archive.photoById.get(curated[0].then)!) : null
	};
}
