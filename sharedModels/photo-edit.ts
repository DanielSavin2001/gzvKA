/**
 * A curator correcting a photograph that is already in the archive.
 *
 * Everything the archive knows about its 4,504 photographs was read out of a filename:
 * `Hoevensebaan - Frituur - zn - zd.jpg` gives a street, a subject and a donor, and the
 * rest is guesswork or absent. That got the archive built, and it is wrong often enough
 * that somebody has to be able to say so - a title that reads badly, a photograph filed
 * under the wrong street, a year nobody could infer, a description no filename could hold.
 *
 * An edit is stored as a *patch*, not as a replacement photograph. Only the fields somebody
 * actually changed are kept, and everything else keeps coming from the generated index. So
 * re-running `npm run archive:index` after adding photographs cannot silently revert a
 * curator's work, and a curator's work cannot freeze a photograph's other fields at
 * whatever they happened to be on the day it was edited.
 */

/** The fields of a photograph a curator may change. Everything else is derived. */
export interface PhotoFields {
	/** The title shown on the site. */
	title?: string;
	/** Subject folder - what the archive calls a category. */
	subject?: string;
	/** Gazetteer ids this photograph belongs to, best first. */
	places?: string[];
	houseNumber?: number;
	/** Year taken, as text: often "1935" or "1935-1936". */
	year?: string;
	donor?: string;
	/** Free text. Nothing in a filename can hold this, so nothing ever has. */
	description?: string;
}

export interface PhotoEdit extends PhotoFields {
	/** The archive id of the photograph this patches. */
	id: string;
	editedBy: string;
	/** ISO timestamp. */
	editedAt: string;
}

/** What the site fetches: every edit, keyed by photograph id. */
export interface PhotoEditFile {
	version: number;
	edits: Record<string, PhotoEdit>;
}

export class PhotoEditError extends Error {}

const LIMITS = { title: 200, subject: 200, donor: 200, description: 4000 };
const MAX_PLACES = 12;

function clean(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().replace(/[ \t]+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, limit);
}

/**
 * Reads an edit off the wire.
 *
 * A projection rather than a filter: a field that is not named here cannot be written,
 * whatever the request carries. That is what stops a crafted request from rewriting the
 * photograph's path on disk, its id, or who edited it.
 *
 * An explicit `null` means "clear this field", which is different from omitting it. Without
 * that difference a curator could add a year but never remove a wrong one.
 */
export function readPhotoFields(input: Record<string, unknown>): PhotoFields {
	const fields: PhotoFields = {};

	const strings: [keyof PhotoFields, number][] = [
		['title', LIMITS.title],
		['subject', LIMITS.subject],
		['donor', LIMITS.donor],
		['description', LIMITS.description]
	];

	for (const [name, limit] of strings) {
		if (!(name in input)) continue;
		const value = clean(input[name], limit);
		// `null` clears; a value sets; anything else is ignored.
		(fields as Record<string, unknown>)[name] = input[name] === null ? undefined : value;
	}

	if ('year' in input) {
		if (input.year === null) fields.year = undefined;
		else {
			const year = clean(input.year, 20);
			if (year && !/^\d{4}(\s?-\s?\d{4})?$/.test(year)) {
				throw new PhotoEditError('Een jaartal ziet eruit als 1935, of als 1935-1936.');
			}
			fields.year = year;
		}
	}

	if ('houseNumber' in input) {
		if (input.houseNumber === null || input.houseNumber === '') fields.houseNumber = undefined;
		else {
			const number = Number(input.houseNumber);
			if (!Number.isInteger(number) || number < 0 || number > 9999) {
				throw new PhotoEditError('Een huisnummer is een heel getal.');
			}
			fields.houseNumber = number;
		}
	}

	if ('places' in input) {
		if (input.places === null) fields.places = undefined;
		else if (Array.isArray(input.places)) {
			const places = input.places
				.filter((place): place is string => typeof place === 'string' && place.trim() !== '')
				.map((place) => place.trim())
				.slice(0, MAX_PLACES);

			// Deliberately keeps an empty array, which means "this belongs nowhere" - a real
			// answer, and different from "leave the places alone".
			fields.places = [...new Set(places)];
		}
	}

	return fields;
}

/** True when an edit would change nothing, so nothing needs storing. */
export function isEmpty(fields: PhotoFields): boolean {
	return Object.keys(fields).length === 0;
}

/**
 * The photograph as the site should show it.
 *
 * Written against the archive's short field names (`t`, `s`, `st`, `hn`, `y`, `d`) because
 * that is what the generated index uses; the long names live on the edit, where a person
 * reads them.
 */
export function applyPhotoEdit<
	T extends {
		id: string;
		t: string;
		s: string;
		st: string[];
		hn?: number;
		y?: string;
		d?: string;
		desc?: string;
	}
>(photo: T, edit: PhotoEdit | undefined): T {
	if (!edit) return photo;

	const patched = { ...photo };

	// `in` rather than a truth test, so clearing a field works: an edit that carries
	// `year: undefined` means the curator removed a wrong year, and a truth test would
	// quietly put it back.
	if ('title' in edit) patched.t = edit.title ?? photo.t;
	if ('subject' in edit) patched.s = edit.subject ?? photo.s;
	if ('places' in edit) patched.st = edit.places ?? photo.st;
	if ('houseNumber' in edit) patched.hn = edit.houseNumber;
	if ('year' in edit) patched.y = edit.year;
	if ('donor' in edit) patched.d = edit.donor;
	if ('description' in edit) patched.desc = edit.description;

	return patched;
}
