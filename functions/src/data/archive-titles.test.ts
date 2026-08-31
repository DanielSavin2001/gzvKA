import * as fs from 'fs';
import * as path from 'path';

import { normalizeText } from '../../../sharedModels/text';

/**
 * What a photograph says about itself, and whether a visitor can find it by saying it back.
 *
 * A display title is the filename with the donor and the date trimmed off, and the trimmer
 * used to decide "donor" from shape alone: two capitalised words, none of them
 * street-shaped. That is also the shape of every café, garage, chapel and family name in
 * Kapellen, so 360 photographs were shown as bare street names with their caption deleted -
 * and because the search index was built from the title rather than the filename, the
 * deleted words were unfindable too. Somebody looking for the garage their father worked at
 * was told the archive had no such photograph while it held one.
 *
 * These read the generated index rather than calling the builder, the way the
 * approximations test does: the file is what the site actually ships.
 */

const index = JSON.parse(
	fs.readFileSync(
		path.join(__dirname, '..', '..', '..', 'static', 'data', 'archive-index.json'),
		'utf8'
	)
) as { photos: { id: string; p: string; t: string; s: string; st: string[]; d?: string }[] };

describe('display titles', () => {
	it('keeps a caption that only looks like a person', () => {
		const titleOf = (pathEnding: string): string => {
			const photo = index.photos.find((candidate) => candidate.p.endsWith(pathEnding));
			if (!photo) throw new Error(`No photograph at ${pathEnding}`);
			return photo.t;
		};

		expect(titleOf('Antwerpsesteenweg - Garage Meyvis - Nicole Verstrepen - 31.12.2015.jpg')).toBe(
			'Antwerpsesteenweg - Garage Meyvis'
		);
		expect(titleOf('Kapellenbos - Grand Hotel Kapellenbosch - Karel Jespers - 16.04.2024.JPG')).toBe(
			'Kapellenbos - Grand Hotel Kapellenbosch'
		);
		expect(titleOf('Waterstraat - Kapel van de Heuvels - Luc De Cock - 15.05.2020.jpg')).toBe(
			'Waterstraat - Kapel van de Heuvels'
		);
	});

	it('still trims a donor the archive knows, when the date convention broke down', () => {
		const photo = index.photos.find((candidate) =>
			candidate.p.endsWith('Kasteel Bunderhof/Bunderhof - Johan Theeuws - z.d (11).jpg')
		);

		expect(photo?.t).toBe('Bunderhof');
	});

	it('leaves no word in a filename that the search cannot reach', () => {
		// The site searches title, subject, place names, donor, year, house number and the
		// path (src/lib/archive.ts). This asserts the last of those is actually enough: every
		// word a volunteer typed into a filename must be reachable by typing it back.
		const ignorable = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'zd', 'zn']);
		const words = (text: string): string[] =>
			normalizeText(text)
				.split(' ')
				.filter((word) => word.length > 2 && !/^\d+$/.test(word) && !ignorable.has(word));

		const unreachable = index.photos.filter((photo) => {
			const haystack = new Set(
				words([photo.t, photo.s, photo.d ?? '', photo.p].join(' '))
			);
			return words(photo.p).some((word) => !haystack.has(word));
		});

		expect(unreachable).toEqual([]);
	});
});
