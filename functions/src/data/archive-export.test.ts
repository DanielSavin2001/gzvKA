import * as fs from 'fs';
import * as path from 'path';

import {
	coordinatesFile,
	coordinatesWithoutPins,
	differs,
	photoEditsFile,
	placeRecordsFile,
	sortedByKey,
	stableJson
} from '../../../sharedModels/archive-export';
import type { PlacePin } from '../../../sharedModels/place-pin';
import type { PhotoEdit } from '../../../sharedModels/photo-edit';
import type { PlaceRecord } from '../../../sharedModels/place-record';

/**
 * Getting the curators' work back out of Firestore and into files.
 *
 * The script that does it cannot be run here - it needs credentials for the live project -
 * so everything about it that can be a pure function is one, and this is where those are
 * held to their promises. Two of them matter more than the rest: a pull that finds nothing
 * must produce a byte-identical file, or the nightly workflow opens a pull request every
 * night that says nothing; and a pull must never delete a coordinate somebody placed by hand.
 */

const pin = (lat: number, lng: number): PlacePin => ({
	lat,
	lng,
	by: 'curator@example.org',
	on: '2026-09-01'
});

describe('stableJson', () => {
	it('writes tabs and one trailing newline, like the other committed data files', () => {
		expect(stableJson({ a: 1 })).toBe('{\n\t"a": 1\n}\n');
	});
});

describe('sortedByKey', () => {
	it('puts the keys in order, so a diff shows changes rather than reshuffling', () => {
		expect(Object.keys(sortedByKey({ zwaan: 1, aap: 2, muis: 3 }))).toEqual([
			'aap',
			'muis',
			'zwaan'
		]);
	});
});

describe('coordinatesFile', () => {
	const existing = {
		_comment: 'the instructions anybody opening this file gets',
		_format: '{ "<id>": { "lat": 51.3, "lng": 4.4 } }',
		places: { dorpsstraat: { lat: 51.31, lng: 4.43, by: 'hand', on: '2026-01-01' } }
	};

	it('folds a live pin in', () => {
		const written = JSON.parse(coordinatesFile(existing, { kerkstraat: pin(51.32, 4.44) }));
		expect(written.places.kerkstraat).toEqual({
			lat: 51.32,
			lng: 4.44,
			by: 'curator@example.org',
			on: '2026-09-01'
		});
	});

	it('never drops a coordinate somebody placed by hand', () => {
		// The file's own comment invites hand editing. A pull that replaced rather than
		// merged would quietly delete that work every night.
		const written = JSON.parse(coordinatesFile(existing, {}));
		expect(written.places.dorpsstraat).toEqual(existing.places.dorpsstraat);
	});

	it('lets a live pin win over what the file says', () => {
		const written = JSON.parse(coordinatesFile(existing, { dorpsstraat: pin(51.4, 4.5) }));
		expect(written.places.dorpsstraat.lat).toBe(51.4);
	});

	it('carries the comment and the format line across', () => {
		const written = JSON.parse(coordinatesFile(existing, {}));
		expect(written._comment).toBe(existing._comment);
		expect(written._format).toBe(existing._format);
	});

	it('produces the same bytes twice, so an unchanged pull opens no pull request', () => {
		const pins = { kerkstraat: pin(51.32, 4.44), dorpsstraat: pin(51.31, 4.43) };
		expect(coordinatesFile(existing, pins)).toBe(coordinatesFile(existing, pins));
	});

	it('does not depend on the order the pins arrived in', () => {
		const one = coordinatesFile(existing, { a: pin(51.3, 4.4), b: pin(51.31, 4.41) });
		const two = coordinatesFile(existing, { b: pin(51.31, 4.41), a: pin(51.3, 4.4) });
		expect(one).toBe(two);
	});
});

describe('coordinatesWithoutPins', () => {
	it('names the entries no live pin backs, and removes none of them', () => {
		const existing = { places: { bijhand: { lat: 1, lng: 2 }, gepind: { lat: 3, lng: 4 } } };
		expect(coordinatesWithoutPins(existing, { gepind: pin(3, 4) })).toEqual(['bijhand']);
		expect(JSON.parse(coordinatesFile(existing, { gepind: pin(3, 4) })).places.bijhand).toEqual({
			lat: 1,
			lng: 2
		});
	});
});

describe('photoEditsFile and placeRecordsFile', () => {
	const edit: PhotoEdit = {
		id: 'foto-1',
		title: 'Dorpsstraat',
		editedBy: 'curator@example.org',
		editedAt: '2026-09-01T10:00:00.000Z'
	};
	const record: PlaceRecord = {
		id: 'kasteel-appel',
		name: 'Kasteel Appel',
		kind: 'castle-estate',
		by: 'curator@example.org',
		on: '2026-09-01'
	};

	it('writes what the endpoint serves, under the key the loader reads', () => {
		expect(JSON.parse(photoEditsFile({ 'foto-1': edit })).edits['foto-1']).toEqual(edit);
		expect(
			JSON.parse(placeRecordsFile({ 'kasteel-appel': record })).places['kasteel-appel']
		).toEqual(record);
	});

	it('is stable across runs', () => {
		expect(photoEditsFile({ 'foto-1': edit })).toBe(photoEditsFile({ 'foto-1': edit }));
		expect(placeRecordsFile({ a: record })).toBe(placeRecordsFile({ a: record }));
	});
});

describe('differs', () => {
	it('treats a file that does not exist yet as different from anything', () => {
		expect(differs(null, '{}\n')).toBe(true);
		expect(differs('{}\n', '{}\n')).toBe(false);
	});
});

describe('the committed copies', () => {
	const data = path.join(__dirname, '..', '..', '..', 'static', 'data');

	it('are the shape the loaders read, and the shape a pull would write', () => {
		// Committed empty rather than absent: the loaders read them as the floor under the
		// live overlay, and a file that only appears after the first nightly pull is a
		// fallback nobody has ever exercised.
		const edits = JSON.parse(fs.readFileSync(path.join(data, 'photo-edits.json'), 'utf8'));
		const places = JSON.parse(fs.readFileSync(path.join(data, 'place-records.json'), 'utf8'));

		expect(edits.edits).toEqual({});
		expect(places.places).toEqual({});
		expect(fs.readFileSync(path.join(data, 'photo-edits.json'), 'utf8')).toBe(photoEditsFile({}));
		expect(fs.readFileSync(path.join(data, 'place-records.json'), 'utf8')).toBe(
			placeRecordsFile({})
		);
	});
});
