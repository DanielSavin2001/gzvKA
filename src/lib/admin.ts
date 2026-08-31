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

import type { PlaceCorrection } from '../../sharedModels/correction';
import type { PhotoFact } from '../../sharedModels/photo-fact';
import type { PhotoEdit, PhotoFields } from '../../sharedModels/photo-edit';
import type { Submission } from '../../sharedModels/submission';

/**
 * A submission with a link a curator can actually open while it is still private.
 *
 * `previewUrl` is nullable because signing that link is the one part of the queue that can
 * fail on its own - it needs a permission the runtime service account may not have - and a
 * row without its picture is still a row a curator can read and approve. It used to be
 * typed as always present, which is how a single unsignable file took the whole queue down.
 */
export type QueuedSubmission = Submission & { previewUrl: string | null };

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
	description?: string;
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

/**
 * Reports that a place is in the wrong spot.
 *
 * Accepting one marks the report as good; it does not move the pin. The map is built from
 * `plaatsen.geojson` in the repository, so applying a correction is a commit somebody can
 * read - which is what stops a point relocating quietly while the warning beside it still
 * says the location is a guess.
 */
export async function corrections(status = 'pending'): Promise<PlaceCorrection[]> {
	const result = await call<{ corrections: PlaceCorrection[] }>(
		`listCorrections?status=${encodeURIComponent(status)}`
	);
	return result.corrections;
}

export function judgeCorrection(decision: {
	id: string;
	status: 'pending' | 'accepted' | 'rejected';
	rejectionReason?: string;
}): Promise<PlaceCorrection> {
	return call<PlaceCorrection>('reviewCorrection', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(decision)
	});
}

/**
 * Placing a whole place on the map.
 *
 * Takes effect at once: the site merges these pins over the committed
 * `place-coordinates.json`, and a pin wins. The beheer page can export the merged set for
 * a commit, so the repository stays the durable record.
 */
export function savePlacePin(
	placeId: string,
	lat: number,
	lng: number
): Promise<{ id: string; pin: { lat: number; lng: number; by: string; on: string } }> {
	return call('savePlacePin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ placeId, lat, lng })
	});
}

/** Drops the pin, so the place falls back to the register or the research. */
export function removePlacePin(placeId: string): Promise<{ id: string; removed: boolean }> {
	return call('savePlacePin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ placeId, remove: true })
	});
}

/**
 * Correcting a photograph that is already in the archive.
 *
 * Unlike a submission, this takes effect at once - the site fetches the edits and lays them
 * over the generated index, so a wrong street is right for the next visitor rather than for
 * the next deploy.
 */
export function savePhotoEdit(photoId: string, fields: PhotoFields): Promise<PhotoEdit> {
	return call<PhotoEdit>('savePhotoEdit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ photoId, ...fields })
	});
}

/**
 * Writes one donor's name onto many photographs at once - a rename, or a merge of two
 * spellings of one person.
 *
 * The ids are worked out here rather than on the server, because a donor is not a record
 * anywhere: it is the string on each photograph, and only the archive index knows which
 * photographs carry it. The page is already holding that index; the functions never load it.
 */
export function renameDonor(photoIds: string[], donor: string): Promise<{ changed: number }> {
	return call<{ changed: number }>('renameDonor', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ photoIds, donor })
	});
}

/** Drops the correction, so the photograph goes back to what the index says. */
export function revertPhotoEdit(photoId: string): Promise<{ id: string }> {
	return call<{ id: string }>('deletePhotoEdit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ photoId })
	});
}

/**
 * Suggestions from the public about when a photograph was taken.
 *
 * Unlike a pin correction, accepting one takes effect at once: the year is written into the
 * photo-edit overlay, which the site lays over the generated index. A year has no radius,
 * grade or doubt text that could fall out of step with it, so there is nothing here for a
 * human to carry across in a commit.
 */
export async function photoFacts(status = 'pending'): Promise<PhotoFact[]> {
	const result = await call<{ facts: PhotoFact[] }>(
		`listPhotoFacts?status=${encodeURIComponent(status)}`
	);
	return result.facts;
}

export function judgePhotoFact(decision: {
	id: string;
	status: 'pending' | 'accepted' | 'rejected';
	reason?: string;
}): Promise<PhotoFact> {
	return call<PhotoFact>('reviewPhotoFact', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(decision)
	});
}
