import { applyPhotoEdit, readPhotoFields } from '../../../sharedModels/photo-edit';
import {
	GROUNDS,
	GROUND_LABELS,
	RemovalRequestError,
	canDecide,
	isGround,
	readNote,
	readRemovalRequest
} from '../../../sharedModels/removal-request';

/**
 * Asking to be taken out of the archive.
 *
 * `/contact` promised this from the day the site went up and could not do it: the page names
 * no address by design, and the comment box it pointed at refuses to send without a
 * photograph attached, so a person who wanted out had to put something in first.
 */

describe('reading a request', () => {
	it('takes a photograph and a ground and nothing else', () => {
		const read = readRemovalRequest({
			photoId: 'dorpsstraat-1962',
			photoTitle: 'Dorpsstraat - Bewoners',
			ground: 'ikzelf'
		});

		expect(read).toEqual({
			photoId: 'dorpsstraat-1962',
			photoTitle: 'Dorpsstraat - Bewoners',
			ground: 'ikzelf',
			message: ''
		});
	});

	it('never requires an explanation', () => {
		// The page said "dat is geen discussie". A required reason would be the discussion.
		const read = readRemovalRequest({ photoId: 'x', ground: 'ikzelf' });

		expect(read.message).toBe('');
	});

	it('falls back to the id when the title is missing, so a queue still reads', () => {
		expect(readRemovalRequest({ photoId: 'x', ground: 'familie' }).photoTitle).toBe('x');
	});

	it('refuses a request that names no photograph', () => {
		expect(() => readRemovalRequest({ ground: 'ikzelf' })).toThrow(RemovalRequestError);
		expect(() => readRemovalRequest({ photoId: '   ', ground: 'ikzelf' })).toThrow(
			RemovalRequestError
		);
	});

	it('refuses a ground it does not know', () => {
		expect(() => readRemovalRequest({ photoId: 'x', ground: 'omdat-het-kan' })).toThrow(
			RemovalRequestError
		);
		expect(() => readRemovalRequest({ photoId: 'x' })).toThrow(RemovalRequestError);
	});

	it('gives every ground a sentence a person would recognise', () => {
		for (const ground of GROUNDS) {
			expect(isGround(ground)).toBe(true);
			expect(GROUND_LABELS[ground]).toBeTruthy();
		}
	});

	it('trims a note and drops an empty one', () => {
		expect(readNote('  te weinig gegevens  ')).toBe('te weinig gegevens');
		expect(readNote('   ')).toBeUndefined();
		expect(readNote(undefined)).toBeUndefined();
	});

	it('knows which decisions a curator may record', () => {
		expect(canDecide('accepted')).toBe(true);
		expect(canDecide('rejected')).toBe(true);
		expect(canDecide('pending')).toBe(true);
		expect(canDecide('weggegooid')).toBe(false);
	});
});

describe('hiding a photograph through the overlay', () => {
	const photo = {
		id: 'dorpsstraat-1962',
		t: 'Dorpsstraat - Bewoners',
		s: 'Dorpsstraat en Geuzenhoek',
		st: ['dorpsstraat'],
		y: '1962',
		d: 'Swatti Alix'
	};

	it('reads the flag off the wire only when it is sent', () => {
		expect(readPhotoFields({ hidden: true }).hidden).toBe(true);
		expect(readPhotoFields({ hidden: false }).hidden).toBe(false);
		// Absent means "this edit says nothing about it", which is what lets an edit about a
		// title leave a hidden photograph hidden.
		expect('hidden' in readPhotoFields({ title: 'Iets' })).toBe(false);
	});

	it('takes only booleans, so a stray string cannot hide a photograph', () => {
		expect(readPhotoFields({ hidden: 'ja' }).hidden).toBe(false);
		expect(readPhotoFields({ hidden: 1 }).hidden).toBe(false);
	});

	it('is reversible, which is why it hides rather than deletes', () => {
		const hide = readPhotoFields({ hidden: true });
		const restore = readPhotoFields({ hidden: false });

		expect(hide.hidden).toBe(true);
		expect(restore.hidden).toBe(false);
	});

	it('leaves everything else about the photograph intact', () => {
		// The service sends the whole existing patch alongside `hidden`, because `save` writes
		// a whole patch - so restoring a photograph later brings back the corrected version of
		// it rather than a worse one.
		const edit = {
			id: photo.id,
			editedBy: 'curator@example.com',
			editedAt: '2026-09-01T00:00:00.000Z',
			title: 'Dorpsstraat - Bewoners voor het gemeentehuis',
			hidden: true
		};

		const patched = applyPhotoEdit(photo, edit);
		expect(patched.t).toBe('Dorpsstraat - Bewoners voor het gemeentehuis');
		expect(patched.y).toBe('1962');
	});
});
