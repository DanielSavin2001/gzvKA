import * as fs from 'fs';
import * as path from 'path';

import { readSuppressions, staleSuppressions } from '../../../sharedModels/suppression';

/**
 * The photographs that must not be published.
 *
 * `/contact` says: "Staat u op een foto en wilt u dat ze weggaat? Dan gaat ze weg." A rule
 * that keeps a promise like that is the last place in this repository where a quiet failure
 * is acceptable - a suppression that is skipped rather than refused republishes a photograph
 * somebody asked to have removed, and nobody finds out until they see it again.
 */

const good = { reason: 'verzoek', by: 'Daniel Savin', on: '2026-09-01' };

describe('readSuppressions', () => {
	it('reads an entry', () => {
		const read = readSuppressions({ version: 1, suppressed: { 'Map/foto.jpg': good } });
		expect(read['Map/foto.jpg']).toEqual(good);
	});

	it('keeps a note when there is one, and leaves the key off when there is not', () => {
		const withNote = readSuppressions({
			version: 1,
			suppressed: { 'Map/foto.jpg': { ...good, note: 'op verzoek verwijderd' } }
		});
		expect(withNote['Map/foto.jpg'].note).toBe('op verzoek verwijderd');
		expect(
			'note' in readSuppressions({ suppressed: { 'Map/foto.jpg': good } })['Map/foto.jpg']
		).toBe(false);
	});

	it('reads an empty file as nothing suppressed', () => {
		expect(readSuppressions({ version: 1, suppressed: {} })).toEqual({});
		expect(readSuppressions({ version: 1 })).toEqual({});
		expect(readSuppressions(null)).toEqual({});
	});

	it('refuses an entry with no reason rather than skipping it', () => {
		expect(() =>
			readSuppressions({ suppressed: { 'Map/foto.jpg': { by: 'D', on: '2026-09-01' } } })
		).toThrow(/needs a reason/);
	});

	it('refuses a reason it does not know', () => {
		expect(() =>
			readSuppressions({ suppressed: { 'Map/foto.jpg': { ...good, reason: 'zomaar' } } })
		).toThrow(/needs a reason/);
	});

	it('refuses an entry with nobody behind it', () => {
		expect(() =>
			readSuppressions({ suppressed: { 'Map/foto.jpg': { ...good, by: '  ' } } })
		).toThrow(/needs "by"/);
	});

	it('refuses a date that is not one', () => {
		expect(() =>
			readSuppressions({ suppressed: { 'Map/foto.jpg': { ...good, on: 'vorige week' } } })
		).toThrow(/needs "on"/);
	});

	it('refuses a list where an object keyed by path belongs', () => {
		expect(() => readSuppressions({ suppressed: ['Map/foto.jpg'] })).toThrow(
			/keyed by corpus path/
		);
	});
});

describe('staleSuppressions', () => {
	it('names a suppression that matches no file', () => {
		const read = readSuppressions({ suppressed: { 'Weg/al.jpg': good, 'Er/is.jpg': good } });
		expect(staleSuppressions(read, ['Er/is.jpg'])).toEqual(['Weg/al.jpg']);
	});

	it('says nothing when every suppression matches', () => {
		const read = readSuppressions({ suppressed: { 'Er/is.jpg': good } });
		expect(staleSuppressions(read, ['Er/is.jpg', 'Ook/deze.jpg'])).toEqual([]);
	});
});

describe('the committed suppressions file', () => {
	const file = path.join(__dirname, 'suppressed.json');

	it('exists and parses', () => {
		// A missing file read as "nothing is suppressed" is the silent republication this
		// whole mechanism exists to prevent, so the builder does not guard against its
		// absence - which makes the file's presence something to hold onto.
		expect(fs.existsSync(file)).toBe(true);
		expect(() => readSuppressions(JSON.parse(fs.readFileSync(file, 'utf8')))).not.toThrow();
	});

	it('matches the index: nothing suppressed is in it', () => {
		const suppressed = readSuppressions(JSON.parse(fs.readFileSync(file, 'utf8')));
		const index = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, '..', '..', '..', 'static', 'data', 'archive-index.json'),
				'utf8'
			)
		) as { photos: { p: string }[] };

		const published = new Set(index.photos.map((photo) => photo.p));
		const leaked = Object.keys(suppressed).filter((photoPath) => published.has(photoPath));

		expect(leaked).toEqual([]);
	});
});
