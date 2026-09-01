import * as fs from 'fs';
import * as path from 'path';

import { buildIndex, matchImagePath, matchPlacesInText } from './match';

/**
 * A folder that names two places with "en" holds both. It does not mean both.
 *
 * "Dorpsstraat en Geuzenhoek" put BOTH ids on all 215 of its photographs, so both pages
 * counted 215, both pins carried it, and the menu offered the Geuzenhoek as one of the ten
 * busiest places in Kapellen. 28 of those photographs are of the Kerkstraat and say so in
 * their own filename.
 *
 * "Mastenbos en Loopgravenpad" did the same to 173. Exactly one of them names the
 * Loopgravenpad - so the archive advertised 173 photographs of a footpath it has one
 * photograph of, and the menu listed it as the second busiest street in the municipality.
 *
 * The matcher's own docstring already said the filename is trusted over the folder. This was
 * the one shape where the code did the opposite.
 */

const read = <T>(...file: string[]): T =>
	JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', ...file), 'utf8')) as T;

const gazetteer = read<Parameters<typeof buildIndex>[0]>(
	'functions',
	'src',
	'data',
	'kapellen-gazetteer.json'
);
const index = buildIndex(gazetteer);

const idsFor = (relativePath: string) =>
	new Set(matchImagePath(relativePath, index).matches.map((match) => match.entryId));

describe('a folder that joins two places with "en"', () => {
	it('lets the filename decide which of the two a photograph is of', () => {
		const ids = idsFor('Mastenbos en Loopgravenpad/Mastenbos - An Heremans 1 - 05.11.2018.jpg');

		expect(ids.has('mastenbos')).toBe(true);
		expect(ids.has('loopgravenpad')).toBe(false);
	});

	it('does the same in the other direction', () => {
		const ids = idsFor(
			'Mastenbos en Loopgravenpad/Loopgravenpad - Marianne Verschueren - 09.11.2021.JPG'
		);

		expect(ids.has('loopgravenpad')).toBe(true);
		expect(ids.has('mastenbos')).toBe(false);
	});

	it('does not put the folder onto a photograph of a third street', () => {
		// The 28 Kerkstraat photographs, which used to be filed under the Dorpsstraat AND the
		// Geuzenhoek and not under the street they name.
		const ids = idsFor('Dorpsstraat en Geuzenhoek/Kerkstraat - Sint-Jacobuskerk - zn - zd.jpg');

		expect(ids.has('dorpsstraat')).toBe(false);
		expect(ids.has('geuzenhoek')).toBe(false);
	});

	it('still supplies both when the filename names no place at all', () => {
		// Losing the only placing a photograph has would be a worse answer than a broad one.
		const ids = idsFor('Mastenbos en Loopgravenpad/zn - zd.jpg');

		expect(ids.has('mastenbos')).toBe(true);
		expect(ids.has('loopgravenpad')).toBe(true);
	});

	it('leaves the nine folders that name two places for a good reason alone', () => {
		// A fort really is in Ertbrand, a castle really is in that park, and a corner really is
		// two streets. Only "en" means "either of these".
		expect(idsFor('Fort van Ertbrand/Fort van Ertbrand - zn - zd.jpg')).toEqual(
			expect.objectContaining(new Set(['fort-van-ertbrand', 'ertbrand']))
		);

		const corner = idsFor('Chr. Pallemansstraat-Heidestraat/Hoek - zn - zd.jpg');
		expect(corner.has('christiaan-pallemansstraat')).toBe(true);
		expect(corner.has('heidestraat')).toBe(true);
	});

	it('finds exactly two such folders in the corpus', () => {
		// If a third appears, this rule should be looked at again rather than assumed.
		const archive = read<{ photos: { s: string }[] }>('static', 'data', 'archive-index.json');
		const folders = [...new Set(archive.photos.map((photo) => photo.s))];

		const conjunctions = folders.filter((folder) => {
			if (!/\s+en\s+/i.test(folder)) return false;

			const matched = matchPlacesInText(folder, index, {
				source: 'folder',
				segmentIndex: 0,
				guardContext: folder
			});

			return new Set(matched.map((match) => match.entryId)).size >= 2;
		});

		expect(conjunctions.sort()).toEqual([
			'Dorpsstraat en Geuzenhoek',
			'Mastenbos en Loopgravenpad'
		]);
	});
});

describe('the shipped index', () => {
	const archive = read<{
		photos: { p: string; s: string; st?: string[] }[];
		places: { id: string; count: number }[];
	}>('static', 'data', 'archive-index.json');

	const countOf = (id: string) => archive.places.find((place) => place.id === id)?.count ?? 0;

	it('no longer claims 173 photographs of a footpath it has one of', () => {
		expect(countOf('loopgravenpad')).toBe(1);
		expect(countOf('mastenbos')).toBe(172);
	});

	it('no longer counts every photograph of the village centre twice', () => {
		expect(countOf('geuzenhoek')).toBe(41);
		expect(countOf('dorpsstraat')).toBe(141);
	});

	it('gives no photograph both halves of a conjunction folder when its name picks one', () => {
		const offenders = archive.photos
			.filter((photo) => photo.s === 'Mastenbos en Loopgravenpad')
			.filter((photo) => {
				const name = photo.p.slice(photo.s.length + 1).toLowerCase();
				const namesOne = name.includes('mastenbos') !== name.includes('loopgravenpad');
				const carriesBoth =
					(photo.st ?? []).includes('mastenbos') && (photo.st ?? []).includes('loopgravenpad');

				return namesOne && carriesBoth;
			});

		expect(offenders).toEqual([]);
	});
});
