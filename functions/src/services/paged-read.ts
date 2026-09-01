/**
 * Reading a whole collection without a ceiling that drops things quietly.
 *
 * A Firestore `.limit(n).get()` past the end of the data is fine; a `.limit(n).get()` on a
 * collection with more than `n` documents in it is a silent partial answer. There is no
 * error, no flag, and nothing in the response that says anything was left out - and with no
 * `orderBy` the sort is implicitly by `__name__`, so what disappears is whichever ids sort
 * last. For the photo-edit overlay that meant the corrections on the alphabetically last
 * photographs would vanish from the site one day, in an order nobody would recognise as an
 * order, with no message anywhere.
 *
 * This pages until the collection runs out and says whether it got to the end. The ceiling
 * stays - an overlay shipped to every visitor cannot be unbounded - but hitting it is now an
 * event that can be reported rather than a number that quietly truncates.
 */

/** One document, reduced to what a caller stores. */
export interface PagedEntry<T> {
	id: string;
	value: T;
}

export interface PagedResult<T> {
	items: Record<string, T>;
	/** False when the ceiling stopped the read before the collection ran out. */
	complete: boolean;
}

/**
 * Everything `nextPage` yields, up to `ceiling`.
 *
 * `nextPage` is a closure that remembers its own cursor, which is deliberate: a Firestore
 * cursor is a document snapshot rather than an id, and threading that through here would
 * make this untestable without a database.
 *
 * A page shorter than `pageSize` is the end, so a collection that divides evenly is the only
 * one that costs an extra empty round trip. This is on the public overlay endpoint that every
 * visitor waits for, so a round trip that answers nothing is worth not making.
 *
 * `complete` is false only when there was genuinely another document to read - a collection
 * holding exactly `ceiling` documents reads as complete, so the alarm cannot cry wolf on the
 * day the archive reaches a round number.
 */
export async function readAllPages<T>(
	nextPage: () => Promise<PagedEntry<T>[]>,
	{ ceiling, pageSize }: { ceiling: number; pageSize: number }
): Promise<PagedResult<T>> {
	const items: Record<string, T> = {};
	let stored = 0;

	for (;;) {
		const page = await nextPage();

		for (const { id, value } of page) {
			if (stored >= ceiling) return { items, complete: false };
			items[id] = value;
			stored += 1;
		}

		if (page.length < pageSize) return { items, complete: true };
	}
}
