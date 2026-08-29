/**
 * A brake on the public endpoints.
 *
 * `submitCorrection` needs no account, which is the point - the people who know where
 * Kasteel Beaulieu stood are not the people with a login. It also means one anonymous POST
 * is one unconditional Firestore write, and a script can make that call as fast as the
 * network allows. The archive would not be damaged, but the bill would be, and the
 * curator's queue would be buried under thousands of records nobody wrote.
 *
 * This is deliberately crude. A counter per caller per window, in Firestore, with the write
 * done in a transaction so two requests at once cannot both read three and both write four.
 * It will not stop somebody determined to get around it - a changed address is a new
 * bucket - and it is not trying to. It stops the accident and the idle script, which is
 * what actually happens to a village photo archive.
 */

import { firestore } from './externalServices';

export const THROTTLE_COLLECTION = 'throttle';

/** Long enough to be a real limit, short enough that a family sharing an address is fine. */
const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 12;

export class TooMany extends Error {
	readonly status = 429;
}

/**
 * The caller's address, as the proxy in front of Cloud Functions reports it.
 *
 * `x-forwarded-for` is a list and the client can prepend to it, so only the last entry -
 * the one Google's own proxy appended - can be trusted. Reading the first would let anyone
 * pick their own bucket and walk straight past this.
 */
export function callerKey(headers: Record<string, unknown>): string {
	const forwarded = headers['x-forwarded-for'];
	const chain = Array.isArray(forwarded) ? forwarded.join(',') : String(forwarded ?? '');
	const parts = chain
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part !== '');

	const address = parts.length > 0 ? parts[parts.length - 1] : 'onbekend';

	// A document id may not contain a slash, and an IPv6 address with a zone can.
	return address.replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 120);
}

function windowStart(now: number): number {
	const size = WINDOW_MINUTES * 60 * 1000;
	return Math.floor(now / size) * size;
}

/**
 * Counts one request against the caller, and throws once they are over the limit.
 *
 * Failing open is deliberate: if Firestore is unavailable this lets the request through
 * rather than turning a rate limiter into an outage. The limiter protects against volume,
 * and losing it briefly is a smaller problem than refusing every contribution.
 */
export async function countRequest(
	key: string,
	now: number = Date.now(),
	limit: number = MAX_PER_WINDOW
): Promise<void> {
	const start = windowStart(now);
	const reference = firestore.collection(THROTTLE_COLLECTION).doc(`${key}_${start}`);

	try {
		await firestore.runTransaction(async (transaction) => {
			const document = await transaction.get(reference);
			const used = document.exists ? (document.data()?.count as number) ?? 0 : 0;

			if (used >= limit) {
				throw new TooMany(
					'U hebt net al een paar meldingen gestuurd. Probeer het over een kwartier opnieuw.'
				);
			}

			transaction.set(reference, { count: used + 1, window: start, key }, { merge: true });
		});
	} catch (error) {
		if (error instanceof TooMany) throw error;
		// Anything else is the database being unreachable. Let the contribution through.
	}
}
