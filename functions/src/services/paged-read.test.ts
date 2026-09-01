import { readAllPages } from './paged-read';

/**
 * The overlay used to be read with one `.limit(5000).get()` against 4,504 photographs, with
 * no `orderBy`. Past the line Firestore would have handed back whichever 5,000 ids sorted
 * first by `__name__` and said nothing about the rest, so a curator's corrections would have
 * started disappearing from the site in an order nobody would recognise as an order.
 *
 * What matters here is exactly that: everything comes back, and when something cannot, the
 * caller is told.
 */

/** A fake collection that hands out pages the way a Firestore cursor would. */
function pagesOf(ids: string[], size: number): () => Promise<{ id: string; value: number }[]> {
	let at = 0;
	return async () => {
		const page = ids.slice(at, at + size).map((id, index) => ({ id, value: at + index }));
		at += page.length;
		return page;
	};
}

const ids = (count: number) =>
	Array.from({ length: count }, (_, i) => `foto-${String(i).padStart(4, '0')}`);

describe('readAllPages', () => {
	it('reads a collection larger than one page', () => {
		return readAllPages(pagesOf(ids(2500), 1000), { ceiling: 25000, pageSize: 1000 }).then(
			(read) => {
				expect(Object.keys(read.items)).toHaveLength(2500);
				expect(read.complete).toBe(true);
				expect(read.items['foto-2499']).toBe(2499);
			}
		);
	});

	it('reads an empty collection', async () => {
		const read = await readAllPages(pagesOf([], 1000), { ceiling: 25000, pageSize: 1000 });
		expect(read.items).toEqual({});
		expect(read.complete).toBe(true);
	});

	it('stops at the ceiling and says it did', async () => {
		const read = await readAllPages(pagesOf(ids(2500), 1000), { ceiling: 2000, pageSize: 1000 });
		expect(Object.keys(read.items)).toHaveLength(2000);
		expect(read.complete).toBe(false);
	});

	it('calls a collection of exactly the ceiling complete, so the alarm cannot cry wolf', async () => {
		// The day the archive holds exactly as many corrections as the ceiling allows is not
		// the day to start logging that corrections are being dropped.
		const read = await readAllPages(pagesOf(ids(2000), 1000), { ceiling: 2000, pageSize: 1000 });
		expect(Object.keys(read.items)).toHaveLength(2000);
		expect(read.complete).toBe(true);
	});

	it('stops on a short page rather than asking for an empty one', async () => {
		let calls = 0;
		const page = pagesOf(ids(1500), 1000);
		await readAllPages(
			async () => {
				calls += 1;
				return page();
			},
			{ ceiling: 25000, pageSize: 1000 }
		);

		// A full page and a half one. A third call would be a round trip per request that
		// can only ever answer "nothing", on the endpoint every visitor waits for.
		expect(calls).toBe(2);
	});

	it('still ends on an empty page when the collection divides evenly', async () => {
		let calls = 0;
		const page = pagesOf(ids(2000), 1000);
		const read = await readAllPages(
			async () => {
				calls += 1;
				return page();
			},
			{ ceiling: 25000, pageSize: 1000 }
		);

		expect(Object.keys(read.items)).toHaveLength(2000);
		expect(read.complete).toBe(true);
		expect(calls).toBe(3);
	});
});
