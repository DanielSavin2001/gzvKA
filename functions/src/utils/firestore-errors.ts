/**
 * Turning one Firestore failure into something a person can act on.
 *
 * Firestore refuses a query that filters on one field and orders by another unless a
 * composite index exists for exactly that pair. The refusal is a normal runtime error, so
 * it fell through to the catch-all and reached the browser as 500 "Er ging iets mis.
 * Probeer het later opnieuw." - which is wrong twice over: it is not intermittent, and
 * trying again later will never help. It cost a real debugging session to find.
 *
 * The message Firestore itself produces is genuinely useful: it names the collection and
 * the fields, and carries a console link that creates the index in one click. It is worth
 * passing through rather than swallowing.
 */

/** Firestore's code for "this query needs an index that does not exist". */
const FAILED_PRECONDITION = 9;

export function isMissingIndex(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;

	const code = (error as { code?: unknown }).code;
	const message = String((error as { message?: unknown }).message ?? '');

	return code === FAILED_PRECONDITION || /requires an index/i.test(message);
}

/**
 * What to tell the caller. The console link is included deliberately: only somebody with
 * access to the project can act on this, and they are the only person who ever sees it.
 */
export function missingIndexMessage(error: unknown): string {
	const message = String((error as { message?: unknown })?.message ?? '');

	return (
		'Deze query heeft een Firestore-index nodig die nog niet bestaat. ' +
		'Draai `firebase deploy --only firestore:indexes`, of gebruik de link in deze melding.\n\n' +
		message
	);
}
