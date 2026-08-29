/**
 * Signing in as a curator, and the calls only a curator may make.
 *
 * Contributing a photograph needs no account. Deciding what is published does, and that
 * decision is made on the server: this module only obtains a Google ID token and sends it
 * along. Nothing here grants anything - if the browser lied about who it was, every call
 * below would come back 401 or 403, because `functions/src/services/admin-auth.ts` verifies
 * the token's signature against Google and checks the address against a list in Firestore.
 *
 * Firebase is loaded on demand. It is a large dependency and the overwhelming majority of
 * visitors are here to look at photographs of their street, not to sign in.
 */

import type { Submission } from '../../sharedModels/submission';

/** A submission with a link a curator can actually open while it is still private. */
export type QueuedSubmission = Submission & { previewUrl: string };

export interface Curator {
	uid: string;
	email: string;
	name?: string;
}

/**
 * The Firebase project this site belongs to. These are not secrets - Firebase publishes
 * them in every client app - and what protects the archive is the rules and the token
 * check, not the obscurity of a project id.
 */
const FIREBASE_CONFIG = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
};

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

export function isConfigured(): boolean {
	return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId);
}

let authPromise: Promise<import('firebase/auth').Auth> | null = null;

async function getAuthClient() {
	if (!isConfigured()) {
		throw new Error(
			'Firebase is niet ingesteld. Zet VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN en ' +
				'VITE_FIREBASE_PROJECT_ID in .env - zie .env.example.'
		);
	}

	if (!authPromise) {
		authPromise = (async () => {
			const { initializeApp, getApps } = await import('firebase/app');
			const { getAuth } = await import('firebase/auth');

			const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
			return getAuth(app);
		})();
	}

	return authPromise;
}

/** Opens Google's sign-in and returns the resulting token, or throws if it was dismissed. */
export async function signIn(): Promise<void> {
	const auth = await getAuthClient();
	const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

	await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOut(): Promise<void> {
	const auth = await getAuthClient();
	const { signOut: firebaseSignOut } = await import('firebase/auth');

	await firebaseSignOut(auth);
}

/** Calls back whenever the signed-in user changes, including once on load. */
export async function watchSignIn(onChange: (email: string | null) => void): Promise<() => void> {
	const auth = await getAuthClient();
	const { onAuthStateChanged } = await import('firebase/auth');

	return onAuthStateChanged(auth, (user) => onChange(user?.email ?? null));
}

async function token(): Promise<string> {
	const auth = await getAuthClient();
	const user = auth.currentUser;
	if (!user) throw new Error('Niet aangemeld.');

	return user.getIdToken();
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${FUNCTIONS_BASE}${path}`, {
		...init,
		headers: {
			...(init.headers ?? {}),
			Authorization: `Bearer ${await token()}`
		}
	});

	if (!response.ok) throw new Error((await response.text()) || `Mislukt (${response.status})`);
	return (await response.json()) as T;
}

/** Confirms this account curates the archive. Throws with the server's reason if not. */
export function whoAmI(): Promise<Curator> {
	return call<Curator>('whoAmI');
}

export async function queue(status = 'pending'): Promise<QueuedSubmission[]> {
	const result = await call<{ submissions: QueuedSubmission[] }>(
		`listSubmissions?status=${encodeURIComponent(status)}`
	);
	return result.submissions;
}

export interface Decision {
	id: string;
	status: 'approved' | 'rejected' | 'pending';
	title?: string;
	places?: string[];
	houseNumber?: number;
	year?: string;
	donor?: string;
	lat?: number;
	lng?: number;
	rejectionReason?: string;
}

export function review(decision: Decision): Promise<Submission> {
	return call<Submission>('reviewSubmission', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(decision)
	});
}
