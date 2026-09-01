import * as fs from 'fs';
import * as path from 'path';

import {
	WITHHELD_SUBJECTS,
	subjectsWithPages,
	warrantsOwnPage
} from '../../../sharedModels/subject-pages';

/**
 * Which subject folders get a page.
 *
 * The rule is small and the cost of getting it wrong is not: build all 79 and the site ships
 * 42 pairs of near-duplicate pages, each pair the same name with two different numbers.
 */

const place = (...ids: string[]) => new Set(ids);

describe('warrantsOwnPage', () => {
	it('gives a page to a folder the gazetteer has no place for', () => {
		expect(warrantsOwnPage({ slug: 'klasfotos', name: "Klasfoto's", count: 259 }, place())).toBe(
			true
		);
	});

	it('withholds one whose slug is a place, because the place page is better', () => {
		// /straat/hoevensebaan holds the same photographs plus a map, house numbers and the
		// stories written about the street.
		expect(
			warrantsOwnPage(
				{ slug: 'hoevensebaan', name: 'Hoevensebaan', count: 104 },
				place('hoevensebaan')
			)
		).toBe(false);
	});

	it('withholds an empty folder', () => {
		expect(warrantsOwnPage({ slug: 'leeg', name: 'Leeg', count: 0 }, place())).toBe(false);
	});

	it('withholds the folders held back on purpose', () => {
		for (const slug of WITHHELD_SUBJECTS) {
			expect(warrantsOwnPage({ slug, name: slug, count: 555 }, place())).toBe(false);
		}
	});

	it('orders the pages busiest first', () => {
		const ordered = subjectsWithPages(
			[
				{ slug: 'a', name: 'A', count: 3 },
				{ slug: 'b', name: 'B', count: 90 },
				{ slug: 'c', name: 'C', count: 12 }
			],
			place()
		);

		expect(ordered.map((subject) => subject.slug)).toEqual(['b', 'c', 'a']);
	});
});

describe('the shipped index', () => {
	const index = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'static', 'data', 'archive-index.json'),
			'utf8'
		)
	) as {
		subjects: { slug: string; name: string; count: number }[];
		places: { id: string }[];
		photos: { s: string; st?: string[] }[];
	};

	const placeIds = new Set(index.places.map((entry) => entry.id));
	const pages = subjectsWithPages(index.subjects, placeIds);

	it('builds a page for every folder holding photographs that match no place', () => {
		// The whole reason for this feature. A photograph with no place is on no street page
		// and no map, so its folder is the only handle the archive has on it - and every one
		// of those folders must therefore end up with a page.
		const holdingPlaceless = new Set(
			index.photos.filter((photo) => (photo.st ?? []).length === 0).map((photo) => photo.s)
		);

		const built = new Set(pages.map((subject) => subject.name));
		const stranded = [...holdingPlaceless].filter(
			(name) =>
				!built.has(name) && !WITHHELD_SUBJECTS.some((slug) => pages.every((p) => p.slug !== slug))
		);

		// Withheld folders are the known exception and are named, not silently dropped.
		const withheldNames = new Set(
			index.subjects.filter((s) => WITHHELD_SUBJECTS.includes(s.slug)).map((s) => s.name)
		);

		expect(stranded.filter((name) => !withheldNames.has(name))).toEqual([]);
	});

	it('never builds a page whose slug is already a place page', () => {
		expect(pages.filter((subject) => placeIds.has(subject.slug))).toEqual([]);
	});

	it('gives every built page a unique slug', () => {
		// `build-archive-index.ts` does not de-duplicate subject slugs, so two folders whose
		// names slugify alike would silently collapse into one page holding half of each.
		expect(new Set(pages.map((subject) => subject.slug)).size).toBe(pages.length);
	});

	it('matches every page to photographs by folder NAME, not slug', () => {
		// `?lijst=onderwerp:` compares against `photo.s`, which is the name. A page whose name
		// matches nothing would render empty and give the arrows nothing to walk.
		const names = new Set(index.photos.map((photo) => photo.s));
		expect(pages.filter((subject) => !names.has(subject.name))).toEqual([]);
	});
});
