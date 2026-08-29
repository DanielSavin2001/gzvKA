import type { PhotoEdit } from '../../../sharedModels/photo-edit';
import {
	applyPhotoEdit,
	isEmpty,
	PhotoEditError,
	readPhotoFields
} from '../../../sharedModels/photo-edit';

/**
 * The two things that must hold: a request cannot write a field a curator is not allowed to
 * change, and clearing a field has to be possible. The second is easy to lose - a truth
 * test instead of an `in` check silently puts a wrong year back every time.
 */

function photo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: 'hoevensebaan-frituur',
		p: 'Hoevensebaan/Hoevensebaan - Frituur - zn - zd.jpg',
		t: 'Frituur',
		s: 'Hoevensebaan',
		st: ['hoevensebaan'],
		y: '1968',
		d: 'Vandoorne Rudy',
		hn: 12,
		...overrides
	} as {
		id: string;
		p: string;
		t: string;
		s: string;
		st: string[];
		hn?: number;
		y?: string;
		d?: string;
		desc?: string;
	};
}

function edit(fields: Partial<PhotoEdit> = {}): PhotoEdit {
	return {
		id: 'hoevensebaan-frituur',
		editedBy: 'daniel@example.test',
		editedAt: '2026-08-29T00:00:00.000Z',
		...fields
	};
}

describe('readPhotoFields', () => {
	it('takes the fields a curator may set', () => {
		const fields = readPhotoFields({
			title: '  De   frituur ',
			subject: 'Hoevensebaan',
			year: '1968',
			houseNumber: 12,
			donor: 'Rudy',
			description: 'De frituur op de hoek, gesloten in 1974.'
		});

		expect(fields.title).toBe('De frituur');
		expect(fields.year).toBe('1968');
		expect(fields.houseNumber).toBe(12);
	});

	it('ignores everything else the request carried', () => {
		// A projection, not a filter: the path on disk, the id and the editor are not a
		// curator's to set, and a crafted request must not be able to reach them.
		const fields = readPhotoFields({
			title: 'Fine',
			id: 'somewhere-else',
			p: '../../etc/passwd',
			editedBy: 'someone@else.test',
			s: 'raw field name'
		}) as Record<string, unknown>;

		expect(Object.keys(fields)).toEqual(['title']);
	});

	it('lets a curator clear a field', () => {
		// The archive guessed 1968 from a filename. Removing a wrong guess has to be
		// possible, and is not the same as leaving the field alone.
		const fields = readPhotoFields({ year: null, houseNumber: null });

		expect('year' in fields).toBe(true);
		expect(fields.year).toBeUndefined();
		expect('houseNumber' in fields).toBe(true);
		expect(fields.houseNumber).toBeUndefined();
	});

	it('leaves an omitted field alone', () => {
		const fields = readPhotoFields({ title: 'Only this' });
		expect('year' in fields).toBe(false);
	});

	it('refuses a year that is not one', () => {
		expect(() => readPhotoFields({ year: 'ergens in de jaren zestig' })).toThrow(PhotoEditError);
		expect(readPhotoFields({ year: '1935-1936' }).year).toBe('1935-1936');
	});

	it('refuses a house number that is not one', () => {
		expect(() => readPhotoFields({ houseNumber: 'twaalf' })).toThrow(PhotoEditError);
		expect(() => readPhotoFields({ houseNumber: 1.5 })).toThrow(PhotoEditError);
	});

	it('de-duplicates places and keeps an empty list', () => {
		expect(readPhotoFields({ places: ['a', 'b', 'a', ' '] }).places).toEqual(['a', 'b']);
		// "This belongs nowhere" is a real answer, and different from not saying.
		expect(readPhotoFields({ places: [] }).places).toEqual([]);
	});
});

describe('isEmpty', () => {
	it('knows when there is nothing to store', () => {
		expect(isEmpty(readPhotoFields({ nothing: 'useful' }))).toBe(true);
		expect(isEmpty(readPhotoFields({ title: 'something' }))).toBe(false);
	});
});

describe('applyPhotoEdit', () => {
	it('leaves an unedited photograph exactly as it was', () => {
		const original = photo();
		expect(applyPhotoEdit(original, undefined)).toEqual(original);
	});

	it('changes only what the edit names', () => {
		const after = applyPhotoEdit(photo(), edit({ title: 'De frituur' }));

		expect(after.t).toBe('De frituur');
		expect(after.s).toBe('Hoevensebaan');
		expect(after.y).toBe('1968');
		expect(after.d).toBe('Vandoorne Rudy');
	});

	it('actually clears a field the curator removed', () => {
		// The failure this guards: a truth test here puts 1968 back every page load, and the
		// curator's correction looks like it never saved.
		const after = applyPhotoEdit(photo(), edit({ year: undefined, houseNumber: undefined }));

		expect(after.y).toBeUndefined();
		expect(after.hn).toBeUndefined();
	});

	it('refiles a photograph under a different place', () => {
		const after = applyPhotoEdit(photo(), edit({ places: ['dorpsstraat'] }));
		expect(after.st).toEqual(['dorpsstraat']);
	});

	it('adds a description, which no filename could ever hold', () => {
		const after = applyPhotoEdit(photo(), edit({ description: 'Gesloten in 1974.' }));
		expect(after.desc).toBe('Gesloten in 1974.');
	});

	it('never lets an edit rewrite the path or the id', () => {
		const after = applyPhotoEdit(
			photo(),
			edit({ id: 'hoevensebaan-frituur', title: 'x' } as Partial<PhotoEdit>)
		);

		expect(after.id).toBe('hoevensebaan-frituur');
		expect(after.p).toBe('Hoevensebaan/Hoevensebaan - Frituur - zn - zd.jpg');
	});
});
