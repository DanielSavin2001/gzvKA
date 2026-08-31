/**
 * The archive, as the browser sees it.
 *
 * Everything needed to browse and search all 4,504 photographs is in one generated file,
 * `static/data/archive-index.json`: 1.1 MB, about 100 KB gzipped. It is fetched once, kept
 * in memory, and every subsequent search is a scan over an array - which for four thousand
 * items is faster than a network round trip, and works with no backend, no credentials and
 * no connection.
 *
 * That is a real download, so nothing a page needs before it can be read should wait on it.
 * The prerendered pages carry their own titles, headings and lists from `load`; this fills
 * in the neighbours, the map and the search behind them.
 *
 * Rebuild the index with `npm run archive:index` after adding photographs.
 */

import { encodePath } from '../../sharedModels/image-path';
import type { PlaceFamily } from '../../sharedModels/place-family';
import { familyOfPlace, isPersonKind } from '../../sharedModels/place-family';
import { normalizeText, slugify } from '../../sharedModels/text';
import { applyPhotoEdit, loadPhotoEdits } from './photo-edits';
import { loadPublished } from './published';

/** One photograph. The keys are short because the file holds 2948 of them. */
export interface ArchivePhoto {
	id: string;
	/** Path under the corpus, e.g. "Hoevensebaan/Hoevensebaan - Frituur - zn - zd.jpg". */
	p: string;
	/** Display title, with the donor and date removed. */
	t: string;
	/** Subject folder. */
	s: string;
	/** Gazetteer ids matched to this photograph, best first. */
	st: string[];
	/** House number, when the archive recorded one. */
	hn?: number;
	/** Donor. */
	d?: string;
	/** Year the photograph was taken. */
	y?: string;
	/** Date the archive received it. */
	a?: string;
	/** Prize-draw photography, browsed by event rather than by place. */
	ev?: boolean;
	/**
	 * A curator's description. Never present in the generated index - no filename can hold a
	 * sentence - and laid over it by `loadPhotoEdits` when somebody has written one.
	 */
	desc?: string;
	/**
	 * An absolute image URL, for a photograph that is not in the corpus on disk: one a
	 * visitor sent in and a curator approved since the last build. The image functions
	 * return this rather than composing `imageBase + p`.
	 */
	u?: string;
	/** True for such a photograph, so a page can say where it came from. */
	nieuw?: boolean;
}

/** A place in Kapellen, with how many photographs it has. */
export interface ArchivePlace {
	id: string;
	name: string;
	kind: string;
	district: string;
	isStreet: boolean;
	count: number;
}

export interface ArchiveSubject {
	slug: string;
	name: string;
	count: number;
}

export interface ArchiveIndex {
	version: number;
	imageCount: number;
	imageBase: string;
	places: ArchivePlace[];
	subjects: ArchiveSubject[];
	photos: ArchivePhoto[];
}

/** The index plus the lookups the pages need, built once on load. */
export interface Archive extends ArchiveIndex {
	placeById: Map<string, ArchivePlace>;
	photoById: Map<string, ArchivePhoto>;
	/** Photograph ids per place id. */
	photosByPlace: Map<string, ArchivePhoto[]>;
	/** Lowercased, accent-free haystack per photograph, in the same order as `photos`. */
	haystacks: string[];
}

let cached: Archive | null = null;
let inFlight: Promise<Archive> | null = null;

/**
 * Loads the archive index, building the lookups once.
 *
 * Pass SvelteKit's `fetch` from a load function so the request participates in its
 * caching; the plain global works too.
 */
export async function loadArchive(fetcher: typeof fetch = fetch): Promise<Archive> {
	if (cached) return cached;
	if (inFlight) return inFlight;

	inFlight = (async () => {
		const response = await fetcher('/data/archive-index.json');
		if (!response.ok) {
			throw new Error(
				`Kon het fotoarchief niet laden (${response.status}). ` +
					'Voer "npm run archive:index" uit om het opnieuw te genereren.'
			);
		}

		const index = (await response.json()) as ArchiveIndex;

		// A curator's corrections are laid over the generated index before anything else
		// sees it, so every page, the search and the map all agree about a photograph
		// without each having to remember to ask. Failing to fetch either of these is not an
		// error: both return nothing and the archive is exactly what it always was.
		//
		// The approved uploads are concatenated rather than overlaid: they are photographs
		// the generated index has never heard of, and appending them here is what puts them
		// in the search, on their street's page, on the map and on the donor's page at once.
		const [edits, published] = await Promise.all([loadPhotoEdits(fetcher), loadPublished(fetcher)]);
		const photos = [...index.photos, ...published].map((photo) =>
			applyPhotoEdit(photo, edits[photo.id])
		);

		cached = buildArchive({ ...index, imageCount: photos.length, photos });
		return cached;
	})();

	try {
		return await inFlight;
	} finally {
		inFlight = null;
	}
}

function buildArchive(index: ArchiveIndex): Archive {
	const photoById = new Map(index.photos.map((photo) => [photo.id, photo]));
	const photosByPlace = new Map<string, ArchivePhoto[]>();

	for (const photo of index.photos) {
		for (const placeId of photo.st) {
			const existing = photosByPlace.get(placeId);
			if (existing) existing.push(photo);
			else photosByPlace.set(placeId, [photo]);
		}
	}

	// Counted from the photographs in hand rather than carried from the generated file,
	// because the two can differ: an approved upload is a photograph the generator has
	// never seen. A street page listing 217 photographs under a heading that says 216 is
	// the kind of small lie that makes a reader distrust the rest of the page.
	const places = index.places.map((place) => ({
		...place,
		count: photosByPlace.get(place.id)?.length ?? 0
	}));
	const placeById = new Map(places.map((place) => [place.id, place]));

	// One normalized string per photograph, searched directly. Built once so that typing
	// costs nothing: 4504 substring checks are well under a millisecond.
	//
	// The path is in here as well as the title, and that is the point: a display title is
	// the filename with its donor and date trimmed off, and the trimmer is not perfect.
	// 894 photographs carry a word in their filename that reaches no other field -
	// "Garage Meyvis", "Hotel-Cafe De Zwaan", "St. Jozefkapel", "Familie Bourlet-Luyckx".
	// Somebody searching for the café their grandfather kept was told the archive has no
	// such photograph while it held one. Whatever a volunteer typed is searchable.
	const haystacks = index.photos.map((photo) => {
		const placeNames = photo.st.map((id) => placeById.get(id)?.name ?? '').join(' ');
		return normalizeText(
			[photo.t, photo.s, placeNames, photo.d ?? '', photo.y ?? '', photo.hn ?? '', photo.p].join(
				' '
			)
		);
	});

	return { ...index, places, placeById, photoById, photosByPlace, haystacks };
}

/**
 * The URL of a photograph's browse-sized image.
 *
 * A photograph a visitor sent in carries its own absolute URL: it lives in Cloud Storage
 * rather than in `static/foto/`, and no thumbnail was ever generated beside it, so all
 * three sizes are the one file.
 */
export function thumbUrl(archive: ArchiveIndex, photo: ArchivePhoto): string {
	return photo.u ?? `${archive.imageBase}/${encodePath(photo.p)}.thumb.webp`;
}

/**
 * The order photographs are shown in, everywhere.
 *
 * Oldest first - this is a history archive - with the undated ones after them, then by
 * house number so a street reads as a walk down it. Shared rather than repeated because the
 * previous/next arrows on a photograph have to step through exactly the order the visitor
 * saw on the page they came from; two copies of this rule would drift and the arrows would
 * start skipping.
 */
export function sortForDisplay(photos: ArchivePhoto[]): ArchivePhoto[] {
	return [...photos].sort((a, b) => {
		const ay = a.y ? Number(a.y) : Number.POSITIVE_INFINITY;
		const by = b.y ? Number(b.y) : Number.POSITIVE_INFINITY;
		return ay - by || (a.hn ?? 0) - (b.hn ?? 0) || a.t.localeCompare(b.t);
	});
}

/**
 * How a photograph describes itself to a screen reader and to image search.
 *
 * Shared rather than written at each place that shows a picture, because the two used to
 * disagree: a thumbnail said "Akkerstraat - Bewoners in de Akkerstraat (1962)" and the
 * photograph the thumbnail linked to said "Akkerstraat - Bewoners". The page whose entire
 * purpose is the image had the thinner description of it.
 *
 * The house number is in here and not in the card's caption alone, because titles repeat:
 * a street can hold a hundred photographs called "Bewoners", and the number is often the
 * only thing that tells them apart.
 */
export function photoAlt(archive: Archive, photo: ArchivePhoto): string {
	const street = photo.st.map((id) => archive.placeById.get(id)).find((place) => place?.isStreet);

	const where = street ? `in de ${street.name}${photo.hn ? ` ${photo.hn}` : ''}` : '';

	return [photo.t, where, photo.y ? `(${photo.y})` : ''].filter(Boolean).join(' ');
}

/** The URL of a photograph's larger image. */
export function detailUrl(archive: ArchiveIndex, photo: ArchivePhoto): string {
	return photo.u ?? `${archive.imageBase}/${encodePath(photo.p)}.web.webp`;
}

/**
 * The URL of a photograph's link-preview card.
 *
 * A fixed 1200x630 image, which is the size Facebook, WhatsApp and LinkedIn require before
 * they will draw the large card rather than a thumbnail beside a line of text. The
 * thumbnails this used to point at are 480 on their long edge, so every share the archive
 * produced rendered as the small one.
 */
export function cardUrl(archive: ArchiveIndex, photo: ArchivePhoto): string {
	return photo.u ?? `${archive.imageBase}/${encodePath(photo.p)}.card.webp`;
}

/** A photograph with its relevance, for a result list. */
export interface SearchHit {
	photo: ArchivePhoto;
	score: number;
}

/**
 * Searches the archive.
 *
 * Ranking puts a photograph whose *place* matches above one that merely mentions the words
 * somewhere, because "Kapelsestraat" almost always means "show me that street" rather than
 * "find this word". Every term must match, so adding a word narrows rather than widens.
 */
export function searchPhotos(archive: Archive, query: string, limit = 400): SearchHit[] {
	const normalized = normalizeText(query);
	if (normalized === '') return [];

	const terms = normalized.split(' ').filter(Boolean);
	if (terms.length === 0) return [];

	// A place whose name matches the whole query: its photographs rank first.
	const querySlug = slugify(query);
	const matchedPlaces = new Set(
		archive.places
			.filter((place) => place.id === querySlug || normalizeText(place.name) === normalized)
			.map((place) => place.id)
	);

	const hits: SearchHit[] = [];

	for (let i = 0; i < archive.photos.length; i += 1) {
		const haystack = archive.haystacks[i];

		let matchesAll = true;
		for (const term of terms) {
			if (!haystack.includes(term)) {
				matchesAll = false;
				break;
			}
		}
		if (!matchesAll) continue;

		const photo = archive.photos[i];
		let score = 1;

		if (photo.st.some((id) => matchedPlaces.has(id))) score += 100;
		// A word starting a title is a stronger signal than one buried in it.
		if (normalizeText(photo.t).startsWith(terms[0])) score += 20;
		if (photo.st.length > 0) score += 5;
		if (photo.y) score += 2;
		// Prize-draw photography is real archive content but rarely what a search is after.
		if (photo.ev) score -= 10;

		hits.push({ photo, score });
	}

	hits.sort((a, b) => b.score - a.score || a.photo.t.localeCompare(b.photo.t));
	return hits.slice(0, limit);
}

/** Street and square suggestions for an autocomplete, best first. */
export function suggestPlaces(archive: Archive, query: string, limit = 8): ArchivePlace[] {
	const normalized = normalizeText(query);
	if (normalized === '') return [];

	return archive.places
		.filter((place) => place.count > 0 && normalizeText(place.name).includes(normalized))
		.sort((a, b) => {
			const aStarts = normalizeText(a.name).startsWith(normalized) ? 1 : 0;
			const bStarts = normalizeText(b.name).startsWith(normalized) ? 1 : 0;
			return bStarts - aStarts || b.count - a.count;
		})
		.slice(0, limit);
}

/**
 * The three families the archive is browsed by.
 *
 * The menu and the three index pages have to agree about which places belong where, or a
 * place is reachable from one and missing from the other. Between them these cover every
 * place with photographs: 44 streets, 26 castles and forts, and 51 districts, buildings
 * and parks.
 */
export type { PlaceFamily } from '../../sharedModels/place-family';

/**
 * Someone the archive photographed rather than somewhere it photographed.
 *
 * The rule itself is in the shared models, because the build-time menu generator has to
 * classify places exactly as these pages do and cannot import anything from here.
 */
export function isPerson(place: ArchivePlace): boolean {
	return isPersonKind(place);
}

/** Which browse list a place belongs in, or null for anything that is not a place. */
export function familyOf(place: ArchivePlace): PlaceFamily | null {
	return familyOfPlace(place);
}

/** Everyone who gave the archive a photograph, and what they gave. */
export interface Donor {
	/** Identity. Two spellings of one name slug to the same thing and become one donor. */
	slug: string;
	/** The spelling to show: whichever the archive used most often for this person. */
	name: string;
	photos: ArchivePhoto[];
}

/**
 * The archive grouped by who gave it.
 *
 * 3,006 of the 4,504 photographs credit somebody, across 298 names, and until now that
 * credit was a line of text on a photo page - searchable, but not a place you could go.
 * These are the people the archive is made of; a page per person is the thanks it owes
 * them, and the thing somebody forwards to their family.
 *
 * The slug is the identity rather than the string, which merges the spelling variants the
 * corpus carries: "Johan Van Elst" and "Johan van Elst" are one man with 89 photographs,
 * not two men with 88 and 1. The displayed spelling is whichever the archive used most,
 * because that is evidence rather than a preference - it is what nearly every filename
 * actually says.
 */
export function donors(archive: Archive): Donor[] {
	const grouped = new Map<string, { photos: ArchivePhoto[]; spellings: Map<string, number> }>();

	for (const photo of archive.photos) {
		const name = photo.d?.trim();
		if (!name) continue;

		const slug = slugify(name);
		if (!slug) continue;

		let entry = grouped.get(slug);
		if (!entry) {
			entry = { photos: [], spellings: new Map() };
			grouped.set(slug, entry);
		}

		entry.photos.push(photo);
		entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
	}

	return [...grouped.entries()]
		.map(([slug, { photos, spellings }]) => ({
			slug,
			name: [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
			photos
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** Places of one family, with photographs, in alphabetical order. */
export function placesInFamily(archive: Archive, family: PlaceFamily): ArchivePlace[] {
	return archive.places
		.filter((place) => place.count > 0 && familyOf(place) === family)
		.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** Every place that has at least one photograph, grouped for the street index. */
export function placesWithPhotos(archive: Archive, onlyStreets = false): ArchivePlace[] {
	return archive.places
		.filter((place) => place.count > 0 && !isPerson(place) && (!onlyStreets || place.isStreet))
		.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}
