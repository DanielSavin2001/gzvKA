/**
 * Two places holding the same photographs.
 *
 * `npm run duplicates` finds identical *files*, by hashing them. It has never found this,
 * and it never could: Ertbrand and Fort van Ertbrand are two entries in the gazetteer with
 * 62 and 55 photographs, 55 of which are the same 55 photographs. Not one file is
 * duplicated. What is duplicated is the place - two bubbles on the map, a few hundred
 * metres apart, showing you the same pictures, with nothing to say which one you want.
 *
 * The distinction this file exists to draw is between that and an ordinary nesting. A
 * castle stands on a street; a chapel stands in a district; every photograph of Kasteel
 * Haezeldonck is also a photograph in Hoogboom, and that is correct and useful. What makes
 * Ertbrand different is that the containment runs both ways: take the fort's photographs
 * out of the district and there are seven left. The two entries are not a place and the
 * area around it, they are one place under two names.
 *
 * So overlap is measured twice.
 *
 *   containment  how much of the smaller side is inside the larger
 *   overlap      how much of the two together is in both (Jaccard)
 *
 * High containment with low overlap is a nesting. High containment with high overlap is one
 * place wearing two names, and that is the thing worth interrupting somebody about.
 *
 * Nothing here decides anything. Which of two names is right, whether a place should be
 * nested under another or merged into it, whether Heidestraat and Christiaan
 * Pallemansstraat are the same street before and after a renaming - those are questions
 * about Kapellen, and the answer is not in the photograph counts. This says where to look.
 *
 * Lives in `sharedModels/` so the jest suite in `functions/` can reach it, and so the admin
 * page can run the same rule the report does rather than a second version of it.
 */

/** Enough of a photograph to know which places it is filed under. */
export interface OverlapPhoto {
	id: string;
	/** Gazetteer ids, the archive's short field name for them. */
	st: string[];
}

/** Enough of a place to name it in a report. */
export interface OverlapPlace {
	id: string;
	name: string;
}

export type OverlapKind =
	/** One place under two names: nearly all of both sides are the same photographs. */
	| 'zelfde'
	/** A nesting: the smaller sits inside the larger, which is usually correct. */
	| 'binnen';

export interface PlaceOverlap {
	kind: OverlapKind;
	/** The larger side, by photograph count. */
	a: OverlapPlace & { count: number };
	/** The smaller side. */
	b: OverlapPlace & { count: number };
	shared: number;
	/** Share of the smaller side that is inside the larger, 0-1. */
	containment: number;
	/** Share of the two together that is in both, 0-1. */
	overlap: number;
}

export interface OverlapOptions {
	/**
	 * How much of the smaller side must be inside the larger before this is worth a line.
	 *
	 * 0.9 rather than 1.0 because a single mis-filed photograph should not hide a pair -
	 * that one exception is the kind of thing a curator wants to see, not the thing that
	 * stops them seeing it.
	 */
	containment?: number;
	/** Above this, the two sides are the same set and the pair is called `zelfde`. */
	sameness?: number;
	/**
	 * Pairs where the smaller side has fewer photographs than this are left out.
	 *
	 * A place with one photograph is inside whatever else that photograph is filed under,
	 * always, and by definition at 100%. Reporting those would bury the real pairs in a
	 * list of arithmetic.
	 */
	minimum?: number;
}

const DEFAULTS: Required<OverlapOptions> = { containment: 0.9, sameness: 0.6, minimum: 3 };

/** Photograph ids per place id, for every place any photograph names. */
export function photosByPlace(photos: OverlapPhoto[]): Map<string, Set<string>> {
	const byPlace = new Map<string, Set<string>>();

	for (const photo of photos) {
		for (const placeId of photo.st ?? []) {
			let set = byPlace.get(placeId);
			if (!set) {
				set = new Set<string>();
				byPlace.set(placeId, set);
			}
			set.add(photo.id);
		}
	}

	return byPlace;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
	// Walk the smaller one: the archive has places with 349 photographs and places with 3.
	const [small, large] = a.size <= b.size ? [a, b] : [b, a];
	let shared = 0;
	for (const id of small) if (large.has(id)) shared += 1;
	return shared;
}

/**
 * Every pair of places whose photographs overlap enough to be worth a look.
 *
 * Sorted by how much is at stake: the `zelfde` pairs first, because those are the ones a
 * reader trips over, then by how many photographs are involved. A report nobody reads to
 * the bottom should have the worst thing at the top.
 */
export function overlappingPlaces(
	photos: OverlapPhoto[],
	places: OverlapPlace[],
	options: OverlapOptions = {}
): PlaceOverlap[] {
	const { containment, sameness, minimum } = { ...DEFAULTS, ...options };

	const byPlace = photosByPlace(photos);
	const named = new Map(places.map((place) => [place.id, place.name]));

	// Largest first, so `a` is always the larger side and each pair is considered once.
	const ids = [...byPlace.keys()]
		.filter((id) => (byPlace.get(id)?.size ?? 0) >= minimum)
		.sort((left, right) => (byPlace.get(right)?.size ?? 0) - (byPlace.get(left)?.size ?? 0));

	const found: PlaceOverlap[] = [];

	for (let i = 0; i < ids.length; i += 1) {
		const bigger = byPlace.get(ids[i])!;

		for (let j = i + 1; j < ids.length; j += 1) {
			const smaller = byPlace.get(ids[j])!;

			const shared = intersectionSize(bigger, smaller);
			if (shared === 0) continue;

			const inside = shared / smaller.size;
			if (inside < containment) continue;

			const union = bigger.size + smaller.size - shared;
			const overlap = shared / union;

			found.push({
				kind: overlap >= sameness ? 'zelfde' : 'binnen',
				a: { id: ids[i], name: named.get(ids[i]) ?? ids[i], count: bigger.size },
				b: { id: ids[j], name: named.get(ids[j]) ?? ids[j], count: smaller.size },
				shared,
				containment: inside,
				overlap
			});
		}
	}

	return found.sort(
		(left, right) =>
			Number(right.kind === 'zelfde') - Number(left.kind === 'zelfde') ||
			right.shared - left.shared ||
			left.a.name.localeCompare(right.a.name, 'nl')
	);
}

/** Only the pairs that are one place under two names - what a curator has to decide about. */
export function sameplaceOverlaps(overlaps: PlaceOverlap[]): PlaceOverlap[] {
	return overlaps.filter((overlap) => overlap.kind === 'zelfde');
}
