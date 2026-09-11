/**
 * Turning the curator stamps already in Firestore into names on the way out.
 *
 * Every decision made from now on is stamped with a name - `requireAdmin` resolves one, and
 * the services write it. What this file is for is the decisions made before that: thousands
 * of corrections, pins and reviews stamped with a curator's email address.
 *
 * Rewriting them in place was the other option and is worse. It needs credentials somebody
 * has to run by hand, it has to be re-run for anything written in the meantime, and it
 * loses the one thing the address is genuinely good for - saying which of two curators made
 * a decision back when the archive did not record names at all. Resolving on read keeps that
 * and needs nobody to remember anything.
 *
 * The read side is the side that matters, because it is the side that leaks. `photoEdits`,
 * `placePins` and `placeRecords` are public, unauthenticated endpoints, and `npm run
 * archive:pull` writes the same records into a public repository. Both go through the
 * service functions here, which is why the resolution lives in the services rather than in
 * the controllers: a controller can be bypassed by a script, and a script was.
 */

import type { CuratorRoster } from '../../../sharedModels/curator';
import { curatorLabel, readCuratorName } from '../../../sharedModels/curator';
import { ADMIN_COLLECTION } from './admin-auth';
import { firestore } from './externalServices';

/**
 * How long a fetched roster is trusted.
 *
 * The roster is read on public endpoints, so it is worth not asking Firestore for a
 * two-document collection on every request. A minute is short enough that a curator fixing
 * their own name in the console sees it while they are still looking at the page, and long
 * enough that a burst of traffic reads it once.
 */
const TTL_MS = 60_000;

let cached: { at: number; names: CuratorRoster } | null = null;

/**
 * Every curator's name, keyed by their address.
 *
 * Fails soft, and the direction it fails in is the one that matters: with no roster nothing
 * resolves and every old stamp reads as "Een beheerder". A Firestore hiccup costs a name,
 * never an address.
 */
export async function roster(): Promise<CuratorRoster> {
	if (cached && Date.now() - cached.at < TTL_MS) return cached.names;

	try {
		const snapshot = await firestore.collection(ADMIN_COLLECTION).get();

		const names: CuratorRoster = {};
		for (const document of snapshot.docs) {
			const name = readCuratorName((document.data() ?? {}).name);
			if (name) names[document.id.trim().toLowerCase()] = name;
		}

		cached = { at: Date.now(), names };
		return names;
	} catch {
		return cached?.names ?? {};
	}
}

/**
 * The same rows, with one curator stamp resolved to a name.
 *
 * A row whose stamp is missing is left exactly as it was rather than gaining a field: an
 * unreviewed submission has no `reviewedBy`, and writing "Een beheerder" into it would say
 * somebody had decided about it.
 */
export async function named<T>(rows: T[], field: keyof T): Promise<T[]> {
	const names = await roster();

	return rows.map((row) =>
		row[field] === undefined ? row : { ...row, [field]: curatorLabel(row[field], names) }
	) as T[];
}

/** The same, for the overlays, which are keyed by photograph or place id rather than listed. */
export async function namedIn<T>(
	rows: Record<string, T>,
	field: keyof T
): Promise<Record<string, T>> {
	const names = await roster();

	const resolved: Record<string, T> = {};
	for (const [key, row] of Object.entries(rows)) {
		resolved[key] =
			row[field] === undefined ? row : ({ ...row, [field]: curatorLabel(row[field], names) } as T);
	}

	return resolved;
}
