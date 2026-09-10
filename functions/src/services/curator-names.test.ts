/**
 * The rule this file holds: no read path hands out a curator's email address.
 *
 * `sharedModels/curator.test.ts` proves the resolution itself. This proves it is actually
 * wired into every function that reads a stored decision back - which is the half that was
 * wrong. `photoEdits`, `placePins` and `placeRecords` are public, unauthenticated endpoints
 * and each of them answered with the whole stored record, so the address of whoever
 * corrected a photograph was served to every visitor and written into a public repository
 * by the nightly `archive:pull`.
 *
 * The records these tests set up are the ones that were already in Firestore before names
 * existed: stamped with an address, and not going to be rewritten. Every one of them has to
 * come back out as a name.
 *
 * Firestore is stubbed rather than emulated. There are no project credentials here, and what
 * is being checked is this repository's own plumbing rather than the database's behaviour.
 */

import { UNNAMED_CURATOR } from '../../../sharedModels/curator';

const DANIEL = 'boatingdruid315@outlook.be';
const HUGO = 'hugodehoon@gmail.com';

/** A document as the Firestore client hands one over. */
function doc(id: string, data: Record<string, unknown>) {
	return { id, data: () => data, exists: true };
}

const collections: Record<string, ReturnType<typeof doc>[]> = {
	admins: [doc(DANIEL, { name: 'Daniel Savin' }), doc(HUGO, { name: 'Hugo De Hoon' })],
	'photo-edits': [
		doc('foto-1', { id: 'foto-1', title: 'De Hoek', editedBy: DANIEL }),
		// A curator the roster cannot resolve. This is not a hypothetical: until somebody puts
		// a `name` on their document in `admins`, every stamp in the database is one of these.
		doc('foto-2', { id: 'foto-2', title: 'De Kerk', editedBy: 'someone@else.test' })
	],
	'place-pins': [doc('ertbrand', { lat: 51.3, lng: 4.4, by: HUGO, on: '2026-01-02' })],
	places: [doc('ertbrand', { id: 'ertbrand', name: 'Ertbrand', by: DANIEL, on: '2026-01-02' })],
	corrections: [doc('c1', { id: 'c1', status: 'accepted', reviewedBy: DANIEL })],
	'photo-facts': [doc('f1', { id: 'f1', status: 'accepted', reviewedBy: HUGO })],
	'removal-requests': [doc('r1', { id: 'r1', status: 'accepted', reviewedBy: DANIEL })],
	submissions: [
		doc('s1', { id: 's1', status: 'approved', reviewedBy: DANIEL }),
		// Never reviewed. It must come back without a `reviewedBy` at all rather than gaining
		// one that says a curator decided about it.
		doc('s2', { id: 's2', status: 'pending' })
	]
};

/** Just enough of a Firestore query to answer the reads these services make. */
const mockFirestore = {
	collection(name: string) {
		const docs = collections[name] ?? [];
		const query: Record<string, unknown> = {
			docs,
			get: async () => ({ docs, empty: docs.length === 0, size: docs.length })
		};
		for (const chained of ['limit', 'orderBy', 'where', 'startAfter', 'select']) {
			query[chained] = () => query;
		}
		query.doc = (id: string) => ({
			get: async () => docs.find((entry) => entry.id === id) ?? { exists: false }
		});
		return query;
	}
};

jest.mock('./externalServices', () => ({
	firestore: mockFirestore,
	storage: { name: 'test-bucket', file: () => ({}) },
	auth: {}
}));

import * as corrections from './correctionService';
import * as photoEdits from './photoEditService';
import * as photoFacts from './photoFactService';
import * as placePins from './placePinService';
import * as placeRecords from './placeRecordService';
import * as removals from './removalRequestService';
import * as submissions from './submissionService';

describe('what the public endpoints answer with', () => {
	it('names the curator on a correction instead of addressing them', async () => {
		const all = await photoEdits.all();

		expect(all['foto-1'].editedBy).toBe('Daniel Savin');
		// The rest of the record is untouched: this resolves a stamp, it does not filter.
		expect(all['foto-1'].title).toBe('De Hoek');
	});

	it('names the curator who dropped a pin', async () => {
		// These go straight into `static/data/place-coordinates.json` on the nightly pull.
		expect((await placePins.all()).ertbrand.by).toBe('Hugo De Hoon');
	});

	it('names the curator who described a place', async () => {
		expect((await placeRecords.all()).ertbrand.by).toBe('Daniel Savin');
	});

	it('withholds a stamp it cannot resolve rather than publishing it', async () => {
		expect((await photoEdits.all())['foto-2'].editedBy).toBe(UNNAMED_CURATOR);
	});

	it('lets no address through any of them', async () => {
		const answered = [await photoEdits.all(), await placePins.all(), await placeRecords.all()];

		// Checked before the assertion that matters, because three empty objects contain no
		// address either and would pass this without proving anything.
		expect(answered.map((records) => Object.keys(records).length)).toEqual([2, 1, 1]);
		expect(JSON.stringify(answered)).not.toContain('@');
	});

	it('stubs the collections these services actually read', () => {
		// Named as string literals above, because the stub has to exist before the services
		// are imported. This is what stops a renamed collection from turning every test in
		// this file into a test of an empty database - which is how the place records went
		// green while proving nothing.
		expect(Object.keys(collections).sort()).toEqual(
			[
				'admins',
				photoEdits.PHOTO_EDIT_COLLECTION,
				placePins.PLACE_PIN_COLLECTION,
				placeRecords.PLACE_RECORD_COLLECTION,
				corrections.CORRECTION_COLLECTION,
				photoFacts.PHOTO_FACT_COLLECTION,
				removals.REMOVAL_REQUEST_COLLECTION,
				submissions.SUBMISSION_COLLECTION
			].sort()
		);
	});
});

describe("what the curators' own queues show", () => {
	it('says which curator handled a report', async () => {
		expect((await corrections.list('accepted'))[0].reviewedBy).toBe('Daniel Savin');
	});

	it('says which curator judged a suggested year', async () => {
		expect((await photoFacts.list('accepted'))[0].reviewedBy).toBe('Hugo De Hoon');
	});

	it('says which curator answered a removal request', async () => {
		expect((await removals.list('accepted'))[0].reviewedBy).toBe('Daniel Savin');
	});

	it('says which curator reviewed a submission', async () => {
		const reviewed = await submissions.list('all');

		expect(reviewed[0].reviewedBy).toBe('Daniel Savin');
	});

	it('leaves an undecided submission undecided', async () => {
		const reviewed = await submissions.list('all');

		expect(reviewed[1].reviewedBy).toBeUndefined();
		expect('reviewedBy' in reviewed[1]).toBe(false);
	});
});
