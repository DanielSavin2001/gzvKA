/**
 * Which subject folders are worth a page of their own.
 *
 * The archive has 79 subjects - the top-level folders of the corpus - and every photograph
 * carries one. They were read by exactly one page, the curator's, as a list of category
 * names. Meanwhile 793 photographs match no place at all, so they appear on no street page
 * and on no map, and 557 of those carry no year either, so they are not on the timeline. For
 * those photographs the subject is the only handle the archive has, and nothing used it.
 *
 * Not all 79 deserve a page, and building all 79 would make the site worse rather than
 * better. 42 of the slugs are also gazetteer place ids: "hoevensebaan" is a folder of 104
 * photographs AND a street with 128. Two pages, the same name, two different numbers, and
 * the smaller one has no map, no house numbers and no stories on it. Every one of those 42
 * is a subset - the place page's count is greater than or equal to the folder's in all 42
 * cases - so the place page is strictly the better page and the folder page would only
 * divide the reader's attention.
 *
 * That leaves 37 folders that name something the gazetteer has no place for: "Klasfoto's",
 * "Kerken en kapellen", "Sport in Kapellen". All twelve folders holding placeless
 * photographs are among them, which is the whole point.
 */

/** The little of a subject this rule reads. */
export interface SubjectLike {
	slug: string;
	name: string;
	count: number;
}

/**
 * Folders that are deliberately not given a browsable index.
 *
 * Empty, and that is a decision rather than an oversight. `Wedstrijden GZVKA` sat here for a
 * day: 555 photographs of the association's own events from 2014-2021, titled with the names
 * of living private individuals. A single browsable index of 555 named people is a different
 * kind of exposure from 555 separate pages nobody has collected, so it was withheld and the
 * question put to the archive. The archive said build it - they are its own events, its own
 * members, and its own photographs to show.
 *
 * The list stays because the next such folder deserves the same pause.
 */
export const WITHHELD_SUBJECTS: string[] = [];

/**
 * Whether this subject gets its own page.
 *
 * `placeIds` is the set of gazetteer place ids, which the caller already has.
 */
export function warrantsOwnPage(subject: SubjectLike, placeIds: Set<string>): boolean {
	if (subject.count <= 0) return false;
	if (WITHHELD_SUBJECTS.includes(subject.slug)) return false;

	// The place page is the better page, always: it carries the map, the house numbers and
	// the stories, and it holds at least the folder's photographs.
	return !placeIds.has(subject.slug);
}

/** The subjects to build, biggest first - the ones somebody is most likely to be after. */
export function subjectsWithPages(subjects: SubjectLike[], placeIds: Set<string>): SubjectLike[] {
	return subjects
		.filter((subject) => warrantsOwnPage(subject, placeIds))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'));
}
