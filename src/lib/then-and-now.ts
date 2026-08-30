/**
 * Pairs of photographs of the same view, decades apart.
 *
 * The effect this feature exists for comes entirely from the two pictures being the *same
 * view*. Two photographs of the same building from different angles slid over one another
 * do not read as time passing; they read as two pictures fighting, and they assert a
 * correspondence that is not there.
 *
 * That is why this file is data rather than something derived. The archive cannot work out
 * which of its photographs match: it holds an 1909 postcard of Kasteel Irishof from the
 * garden and a 2013 photograph of it from the street, and nothing short of a person looking
 * at both can say that those are not a pair. So a pair is asserted by a curator, and the
 * list starts empty rather than starting wrong.
 */

/** One curated pairing. Both halves are archive photographs, referenced by id. */
export interface ThenAndNowPair {
	/** Archive id of the older photograph. */
	then: string;
	/** Archive id of the newer one, taken from as close to the same spot as possible. */
	now: string;
	/**
	 * What is worth noticing between the two - the tram that is gone, the tree that grew.
	 * The pairing shows the change; this says what the change was.
	 */
	note?: string;
}

export interface ThenAndNowFile {
	version: number;
	pairs: ThenAndNowPair[];
}

/**
 * Fails soft, like the photo-edit overlay does. A missing or unreadable file means the page
 * says there are no pairings yet, which is true, rather than failing to render.
 */
export async function loadPairs(fetcher: typeof fetch = fetch): Promise<ThenAndNowPair[]> {
	try {
		const response = await fetcher('/data/toen-en-nu.json');
		if (!response.ok) return [];

		const parsed = (await response.json()) as Partial<ThenAndNowFile>;
		return parsed.pairs ?? [];
	} catch {
		return [];
	}
}
