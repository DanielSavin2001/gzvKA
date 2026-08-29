/**
 * The archive, as the browser sees it.
 *
 * Everything needed to browse and search all 2948 photographs is in one generated file,
 * `static/data/archive-index.json` (66 KB over the wire). It is fetched once, kept in
 * memory, and every subsequent search is a scan over an array - which for three thousand
 * items is faster than a network round trip, and works with no backend, no credentials and
 * no connection.
 *
 * Rebuild the index with `npm run archive:index` after adding photographs.
 */

import { normalizeText, slugify } from '../../sharedModels/text';
import { applyPhotoEdit, loadPhotoEdits } from './photo-edits';

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
		// without each having to remember to ask. Failing to fetch them is not an error:
		// `loadPhotoEdits` returns nothing and the archive is exactly what it always was.
		const edits = await loadPhotoEdits(fetcher);
		const photos = index.photos.map((photo) => applyPhotoEdit(photo, edits[photo.id]));

		cached = buildArchive({ ...index, photos });
		return cached;
	})();

	try {
		return await inFlight;
	} finally {
		inFlight = null;
	}
}

function buildArchive(index: ArchiveIndex): Archive {
	const placeById = new Map(index.places.map((place) => [place.id, place]));
	const photoById = new Map(index.photos.map((photo) => [photo.id, photo]));
	const photosByPlace = new Map<string, ArchivePhoto[]>();

	for (const photo of index.photos) {
		for (const placeId of photo.st) {
			const existing = photosByPlace.get(placeId);
			if (existing) existing.push(photo);
			else photosByPlace.set(placeId, [photo]);
		}
	}

	// One normalized string per photograph, searched directly. Built once so that typing
	// costs nothing: 2948 substring checks are well under a millisecond.
	const haystacks = index.photos.map((photo) => {
		const placeNames = photo.st.map((id) => placeById.get(id)?.name ?? '').join(' ');
		return normalizeText(
			[photo.t, photo.s, placeNames, photo.d ?? '', photo.y ?? '', photo.hn ?? ''].join(' ')
		);
	});

	return { ...index, placeById, photoById, photosByPlace, haystacks };
}

/** The URL of a photograph's browse-sized image. */
export function thumbUrl(archive: ArchiveIndex, photo: ArchivePhoto): string {
	return `${archive.imageBase}/${encodePath(photo.p)}.thumb.webp`;
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

/** The URL of a photograph's larger image. */
export function detailUrl(archive: ArchiveIndex, photo: ArchivePhoto): string {
	return `${archive.imageBase}/${encodePath(photo.p)}.web.webp`;
}

/** Percent-encodes each path segment, leaving the separators intact. */
function encodePath(relativePath: string): string {
	return relativePath.split('/').map(encodeURIComponent).join('/');
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

/** Every place that has at least one photograph, grouped for the street index. */
export function placesWithPhotos(archive: Archive, onlyStreets = false): ArchivePlace[] {
	return archive.places
		.filter((place) => place.count > 0 && (!onlyStreets || place.isStreet))
		.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}
