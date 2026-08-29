/**
 * Who is allowed to decide what goes into the archive.
 *
 * Contributing is open to anyone; deciding what gets published is not. A curator signs in
 * with Google, the browser sends the resulting ID token, and this verifies it and checks
 * the address against a list held in Firestore.
 *
 * The list lives in the database rather than in this file so that adding a second curator
 * is a row rather than a deploy - and rather than in an environment variable, so there is a
 * record of who added whom and when.
 */

import { auth, firestore } from './externalServices';

/** Collection holding one document per curator, keyed by their lower-cased email. */
export const ADMIN_COLLECTION = 'admins';

export interface AdminIdentity {
	uid: string;
	email: string;
	name?: string;
}

export class NotAuthorised extends Error {
	constructor(
		message: string,
		/** 401 when we do not know who this is, 403 when we do and they may not. */
		readonly status: 401 | 403
	) {
		super(message);
	}
}

/** Pulls the bearer token out of an Authorization header. */
export function bearerToken(header: string | undefined): string | null {
	if (!header) return null;

	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
}

/**
 * Verifies the caller and confirms they curate this archive.
 *
 * `verifyIdToken` does the work that matters: it checks the signature against Google's
 * public keys, the audience against this project, and the expiry. A token from another
 * Firebase project, or one that has been tampered with, or an expired one, all fail here -
 * which is why the email address is only trusted after this call and never before.
 */
export async function requireAdmin(authorization: string | undefined): Promise<AdminIdentity> {
	const token = bearerToken(authorization);
	if (!token) throw new NotAuthorised('Aanmelden is vereist.', 401);

	let decoded;
	try {
		decoded = await auth.verifyIdToken(token);
	} catch {
		throw new NotAuthorised('Aanmelding is verlopen of ongeldig.', 401);
	}

	// Google gives us a verified address only when the provider verified it. An
	// unverified one must not be matched against the list, or anyone able to set an
	// arbitrary email on an account could let themselves in.
	if (!decoded.email || decoded.email_verified !== true) {
		throw new NotAuthorised('Dit account heeft geen bevestigd e-mailadres.', 403);
	}

	const email = decoded.email.toLowerCase();
	const record = await firestore.collection(ADMIN_COLLECTION).doc(email).get();

	if (!record.exists) {
		throw new NotAuthorised('Dit account beheert dit archief niet.', 403);
	}

	return {
		uid: decoded.uid,
		email,
		...(decoded.name ? { name: String(decoded.name) } : {})
	};
}
