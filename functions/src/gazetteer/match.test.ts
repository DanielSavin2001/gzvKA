import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer } from '../../../sharedModels/gazetteer';
import {
	buildIndex,
	extractHouseNumber,
	GazetteerIndex,
	matchImagePath,
	matchPlacesInText,
	maxEdits
} from './match';
import { damerauLevenshtein, diceCoefficient } from './distance';
import { corePlace, streetSuffixFamily } from './normalize';
import { splitFilename, splitPathContext } from './segment';
import { SEED_ENTRIES } from './seed';
import { resolveGeometry } from '../../../sharedModels/gazetteer';

const gazetteer = JSON.parse(
	fs.readFileSync(path.join(__dirname, '..', 'data', 'kapellen-gazetteer.json'), 'utf8')
) as Gazetteer;

const index: GazetteerIndex = buildIndex(gazetteer);

/** The ids matched in a path, for compact assertions. */
function idsIn(relativePath: string): string[] {
	return matchImagePath(relativePath, index).matches.map((m) => m.entryId);
}

const CORPUS = 'src/lib/images/history-images';

describe('splitFilename', () => {
	it('splits the conventional three-part name', () => {
		const parts = splitFilename('Dorpsstraat 15 - Swatti Alix - zd.jpg');

		expect(parts.segments).toEqual(['Dorpsstraat 15', 'Swatti Alix', 'zd']);
		expect(parts.contributor).toBe('Swatti Alix');
		expect(parts.dateKnown).toBe(false);
		expect(parts.contributorKnown).toBe(true);
		expect(parts.placeSegments.map((s) => s.text)).toEqual(['Dorpsstraat 15']);
	});

	it('reads a full donation date', () => {
		const parts = splitFilename('Kasteel Bunderhof - Dirk Pelgrims - 16.01.2015.jpg');

		expect(parts.contributor).toBe('Dirk Pelgrims');
		expect(parts.dateOfAcquisition).toBe('16.01.2015');
		expect(parts.dateKnown).toBe(true);
	});

	it('pads a single-digit day and month', () => {
		expect(splitFilename('X - Y Z - 8.1.2015.jpg').dateOfAcquisition).toBe('08.01.2015');
	});

	it('understands the anonymity marker', () => {
		const parts = splitFilename('Kasteel Op den Wal 2 - Meidoornlaan 9 - zn - zd.jpg');

		expect(parts.contributorKnown).toBe(false);
		expect(parts.contributor).toBeNull();
		expect(parts.dateKnown).toBe(false);
	});

	it('splits when the space is only on one side of the hyphen', () => {
		// Both malformed shapes occur in the archive.
		expect(
			splitFilename('Medaille Inhuldiging Gemeentehuis 1907_2 -Dirk Van Laer - 07.02.2015.jpg')
				.contributor
		).toBe('Dirk Van Laer');
		expect(splitFilename('St. Jacobuskerk- Hugo De Hoon - z.d.jpg').contributor).toBe(
			'Hugo De Hoon'
		);
	});

	it('never splits a hyphen with no space on either side', () => {
		// Splitting these would destroy a name, a year range or a street corner.
		expect(
			splitFilename('Vaderdagwedstrijd 2016 Marie-Leen - winnaar Annick Paelman.jpg').segments[0]
		).toContain('Marie-Leen');
		expect(splitFilename('Broedersschool 2de lj 1969-1970.jpg').segments).toEqual([
			'Broedersschool 2de lj 1969-1970'
		]);
		expect(splitFilename('Chr. Pallemansstraat-Heidestraat - zn - zd.jpg').segments[0]).toBe(
			'Chr. Pallemansstraat-Heidestraat'
		);
	});

	it('tolerates the doubled dot in "z.d..jpg"', () => {
		const parts = splitFilename('Kasteel Op den Wal_5 - Hugo De Hoon - z.d..jpg');

		expect(parts.base).toBe('Kasteel Op den Wal_5 - Hugo De Hoon - z.d.');
		expect(parts.contributor).toBe('Hugo De Hoon');
		expect(parts.dateKnown).toBe(false);
	});

	it('strips a trailing duplicate marker from a donor name', () => {
		expect(splitFilename('Mastenbos - Robert Swiggers 11 - 16.11.2018.jpg').contributor).toBe(
			'Robert Swiggers'
		);
	});

	it('records an unexplained prefix code instead of guessing at it', () => {
		const parts = splitFilename(
			'OWNP - Kapelsestraat 246 - Home Philippe Speth - Swatti Alix - zd.jpg'
		);

		expect(parts.prefixCode).toBe('OWNP');
		expect(parts.placeSegments.map((s) => s.text)).toContain('Kapelsestraat 246');
	});

	it('assigns roles by pattern, not position, when donor and date are swapped', () => {
		const parts = splitFilename('Hoogboom - Hoogboomsesteenweg - 08.01.2015 - Johan Van Elst.jpg');

		expect(parts.dateOfAcquisition).toBe('08.01.2015');
		expect(parts.contributor).toBe('Johan Van Elst');
	});

	it('handles a filename with no separators at all', () => {
		const parts = splitFilename('Broedersschool 2de lj 1969-1970.jpg');

		expect(parts.contributor).toBeNull();
		expect(parts.placeSegments).toHaveLength(1);
	});

	it('captures the duplicate index in its several written forms', () => {
		expect(splitFilename('Kasteel Op den Wal_5 - x.jpg').indexSuffix).toBe(5);
		expect(splitFilename('Bunderhof - Johan Theeuws - z.d (11).jpg').indexSuffix).toBe(11);
	});
});

describe('splitPathContext', () => {
	it('flags the prize-draw subtree as topical rather than place photography', () => {
		const context = splitPathContext(
			`${CORPUS}/Wedstrijden GZVKA/Fietszoektocht 2014/Foto's/Leo Beyers_5.jpg`
		);

		expect(context.topicalOnly).toBe(true);
	});

	it('does not flag ordinary subject folders', () => {
		expect(splitPathContext(`${CORPUS}/Hoevensebaan/x.jpg`).topicalOnly).toBe(false);
	});
});

describe('matchImagePath - streets that must be found', () => {
	it('finds a street named exactly', () => {
		const result = matchImagePath(
			`${CORPUS}/Hoevensebaan/Hoevensebaan - Frituur - zn - zd.jpg`,
			index
		);

		expect(result.bestStreet?.entryId).toBe('hoevensebaan');
		expect(result.bestStreet?.method).toBe('exact');
	});

	it('finds a street through the misspellings the archive contains', () => {
		expect(
			idsIn(`${CORPUS}/Kalmhousesteenweg - Duitse Wijk/Kalmrhoutsesteenweg - x - zd.jpg`)
		).toContain('kalmthoutsesteenweg');
		expect(idsIn(`${CORPUS}/Dorpsstraat en Geuzenhoek/Dorpstraat 12 - zn - zd.jpg`)).toContain(
			'dorpsstraat'
		);
		expect(idsIn(`${CORPUS}/Station en omgeving/Hoogboomsesteenweg - zn - zd.jpg`)).toContain(
			'hoogboomsteenweg'
		);
	});

	it('finds a street through an abbreviated honorific', () => {
		expect(
			idsIn(`${CORPUS}/Koninklijke Straten/Kon. Astridlaan - Jan Verhelst 2 - z.d.jpg`)
		).toContain('koningin-astridlaan');
		expect(idsIn(`${CORPUS}/Koninklijke Straten/Koning Albertlei - zn - zd.png`)).toContain(
			'koning-albertlei'
		);
	});

	it('prefers the longer, more specific place name', () => {
		// "Kapellenbos" must win over the substring "Kapellen".
		const ids = idsIn(`${CORPUS}/Villa De Maretak - Kapellenbos/Villa - zn - zd.jpg`);
		expect(ids).toContain('kapellenbos');
	});
});

describe('matchImagePath - the false positives that must be rejected', () => {
	it('does not read an inflatable at a village fete as a castle', () => {
		const ids = idsIn(`${CORPUS}/Wedstrijden GZVKA/Springkasteel Sprookjesbos - Geert Stuer.jpg`);

		expect(ids.filter((id) => id.startsWith('kasteel-'))).toEqual([]);
	});

	it('does not read the football club as the municipality', () => {
		const ids = idsIn(
			`${CORPUS}/Sport in Kapellen/SP - FC Capellen 1928 - Heemkring Hoghescote - zd.png`
		);

		expect(ids).not.toContain('kapellen');
	});

	it('does not read the heritage society as the hamlet of Hoogboom', () => {
		const ids = idsIn(
			`${CORPUS}/Postkaarten - Groeten uit Kapellen/Groeten - Heemkring Hoghescote - zd.jpg`
		);

		expect(ids).not.toContain('hoogboom');
	});

	it('does not confuse a wood with a manor', () => {
		// Two edits apart, and both real places here. Only the suffix-family gate separates them.
		expect(
			idsIn(`${CORPUS}/Mastenbos en Loopgravenpad/Mastenbos - An Heremans 2 - 05.11.2018.jpg`)
		).toContain('mastenbos');
		expect(
			idsIn(`${CORPUS}/Mastenbos en Loopgravenpad/Mastenbos - An Heremans 2 - 05.11.2018.jpg`)
		).not.toContain('kasteel-mastenhof');
	});

	it('never reports a castle or a park as a street', () => {
		const result = matchImagePath(
			`${CORPUS}/Kasteel Op den Wal/Kasteel Op den Wal 4 - Swatti Alix - zd.jpg`,
			index
		);

		expect(result.matches.map((m) => m.entryId)).toContain('kasteel-op-den-wal');
		expect(result.bestStreet?.entryId).not.toBe('kasteel-op-den-wal');
	});

	it('does not treat a donor surname as a place', () => {
		const ids = idsIn(`${CORPUS}/Mensen uit Kapellen/Schoolfeest - Jelle Strybos - 12.03.2016.jpg`);

		expect(ids).not.toContain('mastenbos');
		expect(ids.some((id) => id.includes('strybos'))).toBe(false);
	});
});

describe('house numbers', () => {
	it('reads a number written after a street', () => {
		const result = matchImagePath(
			`${CORPUS}/Akkerstraat - Nieuwe Wijk/Akkerstraat 2 - zn - zd.jpg`,
			index
		);

		expect(result.bestStreet?.entryId).toBe('akkerstraat');
		expect(result.bestStreet?.houseNumber).toBe(2);
	});

	it('reads a three-digit number', () => {
		const result = matchImagePath(
			`${CORPUS}/Op weg naar Putte/OWNP - Kapelsestraat 246 - Home Philippe Speth - Swatti Alix - zd.jpg`,
			index
		);

		expect(result.bestStreet?.entryId).toBe('kapelsestraat');
		expect(result.bestStreet?.houseNumber).toBe(246);
	});

	it('never reads a four-digit year as a house number', () => {
		expect(
			extractHouseNumber('Dorpsstraat 1960', 'dorpsstraat', 'Dorpsstraat 1960').number
		).toBeNull();
		expect(
			extractHouseNumber('Stationsstraat 1931', 'stationsstraat', 'Stationsstraat 1931').number
		).toBeNull();
	});

	it('never reads a date fragment as a house number', () => {
		expect(
			extractHouseNumber('Dorpsstraat 09.07.1976', 'dorpsstraat', 'Dorpsstraat 09.07.1976').number
		).toBeNull();
	});

	it('never reads an underscore duplicate marker as a house number', () => {
		// "Kapelsestraat_2" is the second photograph, not number 2.
		expect(
			extractHouseNumber('Kapelsestraat_2', 'kapelsestraat', 'Kapelsestraat_2').number
		).toBeNull();
	});

	it('lets an explicit nr marker override a bare trailing digit', () => {
		const text = 'OWNP - Geelhanddreef 5 - nr 9 hoeve - Swatti Alix - zd';
		const extracted = extractHouseNumber('Geelhanddreef 5', 'geelhanddreef', text);

		expect(extracted.number).toBe(9);
		expect(extracted.confidence).toBe('high');
	});

	it('does not attach a house number to a park, where a number is a photo index', () => {
		const result = matchImagePath(
			`${CORPUS}/Gemeentepark Beaulieu/Gemeentepark 3 - Robert Beye - 15.01.2022.jpg`,
			index
		);

		const park = result.matches.find((m) => m.entryId === 'gemeentepark-beaulieu');
		expect(park).toBeDefined();
		expect(park?.houseNumber).toBeNull();
	});

	it('flags an implausibly high number as low confidence', () => {
		expect(extractHouseNumber('Dorpsstraat 950', 'dorpsstraat', 'Dorpsstraat 950').confidence).toBe(
			'low'
		);
	});
});

describe('corners', () => {
	it('recognises two streets joined by a bare hyphen', () => {
		const result = matchImagePath(
			`${CORPUS}/Chr. Pallemansstraat-Heidestraat/Chr. Pallemansstraat-Heidestraat - zn - zd.jpg`,
			index
		);

		const corner = result.corners[0];
		expect(corner).toBeDefined();
		expect([corner.aId, corner.bId].sort()).toEqual(['christiaan-pallemansstraat', 'heidestraat']);
	});
});

describe('matchPlacesInText', () => {
	it('returns nothing for text that names no place', () => {
		expect(matchPlacesInText('Swatti Alix', index, { source: 'filename' })).toEqual([]);
	});

	it('returns nothing for an empty string', () => {
		expect(matchPlacesInText('', index, { source: 'filename' })).toEqual([]);
	});

	it('trusts a filename above a folder name', () => {
		const fromFilename = matchPlacesInText('Dorpsstraat', index, { source: 'filename' })[0];
		const fromFolder = matchPlacesInText('Dorpsstraat', index, { source: 'folder' })[0];

		expect(fromFilename.confidence).toBeGreaterThan(fromFolder.confidence);
	});
});

describe('the gazetteer data itself', () => {
	it('ships no coordinates, so none can have been invented', () => {
		expect(gazetteer.entries.every((entry) => entry.manualGeometry === null)).toBe(true);
	});

	it('backs every entry with at least one real photograph', () => {
		for (const entry of gazetteer.entries) {
			expect(entry.evidence.corpusHits).toBeGreaterThan(0);
			expect(entry.evidence.sampleFile).not.toBe('');
		}
	});

	it('never marks a castle, park, area or fort as a street', () => {
		for (const entry of gazetteer.entries) {
			if (['castle-estate', 'park', 'area', 'fort'].includes(entry.kind)) {
				expect(entry.isStreet).toBe(false);
				expect(entry.allowHouseNumber).toBe(false);
			}
		}
	});

	it('has unique ids', () => {
		const ids = gazetteer.entries.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("carries a curator's manual coordinate through a rebuild", () => {
		// The generated JSON is rewritten wholesale by `npm run gazetteer:build`, so a
		// coordinate hand-edited into it would vanish on the next rebuild while
		// resolveGeometry still claims manual beats machine. The seed is therefore the
		// only place a human may record one, and the generator must carry it through.
		const seeded = SEED_ENTRIES.find((e) => e.manualGeometry != null);
		const generated = gazetteer.entries.find((e) => e.id === seeded?.id);

		if (seeded) {
			expect(generated?.manualGeometry).toEqual(seeded.manualGeometry);
		}

		// Whether or not one is set today, every generated entry must expose the field, so
		// that setting it in the seed is all a curator has to do.
		for (const entry of gazetteer.entries) {
			expect(entry).toHaveProperty('manualGeometry');
		}
	});

	it('lets a manual coordinate win over the OSM file', () => {
		const manual = {
			centroid: { lat: 51.3125, lng: 4.4295 },
			bbox: [4.42, 51.31, 4.44, 51.32] as [number, number, number, number],
			source: 'manual' as const
		};
		const entry = { ...gazetteer.entries[0], manualGeometry: manual };
		const osm = {
			version: 1,
			generatedAt: '2026-01-01',
			overpassQueryHash: 'x',
			municipality: {
				osmRelationId: 1,
				name: 'Kapellen',
				bbox: [0, 0, 0, 0] as [number, number, number, number]
			},
			byEntryId: {
				[entry.id]: {
					centroid: { lat: 0, lng: 0 },
					bbox: [0, 0, 0, 0] as [number, number, number, number],
					source: 'osm' as const
				}
			},
			unmatched: [],
			unresolved: [],
			needsReview: []
		};

		expect(resolveGeometry(entry, osm)).toEqual(manual);
		// And with no manual coordinate, OSM is used rather than nothing.
		expect(resolveGeometry({ ...entry, manualGeometry: null }, osm)?.source).toBe('osm');
	});

	it('ships no coordinates today, so none can have been invented', () => {
		expect(gazetteer.entries.every((e) => e.manualGeometry === null)).toBe(true);
	});

	it('has no two distinct places reachable from one another by fuzzy matching', () => {
		// The safety invariant for the whole gazetteer. If adding an entry ever makes one
		// real place a near-miss for another, a typo in a filename would silently attribute
		// a photograph to the wrong street or castle - so this fails loudly instead.
		// Kapellen's estate names are what make it necessary: Zilverhof/Vijverhof and
		// Ravenhof/Rozenhof are two edits apart and all share the "hof" suffix family, so
		// neither the family gate nor the length gate separates them - only the edit budget.
		const forms = gazetteer.entries.flatMap((entry) =>
			[entry.name, ...entry.aliases].map((form) => ({
				id: entry.id,
				form,
				core: corePlace(form),
				fuzzy: entry.fuzzy
			}))
		);

		const collisions: string[] = [];

		for (const a of forms) {
			if (a.core.length < 5) continue;

			for (const b of forms) {
				if (a.id === b.id || !b.fuzzy) continue;
				if (Math.abs(a.core.length - b.core.length) > 3) continue;
				if (streetSuffixFamily(a.core) !== streetSuffixFamily(b.core)) continue;
				if (diceCoefficient(a.core, b.core) < 0.55) continue;

				const budget = maxEdits(a.core.length);
				if (damerauLevenshtein(a.core, b.core, budget) <= budget) {
					collisions.push(`"${a.form}" (${a.id}) can reach "${b.form}" (${b.id})`);
				}
			}
		}

		expect(collisions).toEqual([]);
	});

	it('still reaches the correct street from the multi-edit misspellings in the archive', () => {
		// These are catalogued as aliases, so they resolve exactly rather than through the
		// fuzzy stage. Tightening the edit budget must not have cost us any of them.
		expect(idsIn(`${CORPUS}/x/Kalmhousesteenweg - zn - zd.jpg`)).toContain('kalmthoutsesteenweg');
		expect(idsIn(`${CORPUS}/x/Doprsstraat 12 - zn - zd.jpg`)).toContain('dorpsstraat');
		expect(idsIn(`${CORPUS}/x/Hoogboomsesteenweg - zn - zd.jpg`)).toContain('hoogboomsteenweg');
		expect(idsIn(`${CORPUS}/x/IJjzerenweglaan - zn - zd.jpg`)).toContain('ijzerenweglaan');
	});

	it('still tolerates a single-character typo in the stem of a name', () => {
		// One edit in the stem is the case fuzzy matching exists for: an uncatalogued slip.
		expect(idsIn(`${CORPUS}/x/Stationstraat - zn - zd.jpg`)).toContain('stationsstraat');
		expect(idsIn(`${CORPUS}/x/Hoevonsebaan - zn - zd.jpg`)).toContain('hoevensebaan');
	});

	it('does not resolve a typo that falls in the suffix itself', () => {
		// A known and accepted limitation. "Hoevensebaam" has no recognised suffix at all,
		// so it has no family, and the family gate refuses it. Relaxing that gate to catch
		// this would be the same relaxation that lets Mastenbos reach Mastenhof and
		// Zilverhof reach Vijverhof, which is a far worse trade in a heritage archive:
		// an unresolved name is a gap, a wrongly resolved one is a false record.
		expect(idsIn(`${CORPUS}/x/Hoevensebaam - zn - zd.jpg`)).not.toContain('hoevensebaan');
	});
});

// Two street corrections Daniel found by looking at the site, both confirmed against the
// official register and the old website's own pages before being made.
describe('streets that were renamed', () => {
	it('resolves Kapellen\'s old Nieuwstraat to the Lucien Bevernagestraat', () => {
		// The old site's own heading reads "LUCIEN BEVERNAGESTRAAT (Nieuwstraat)", and the
		// modern register has a Nieuwstraat only in Stabroek. A bare `nieuwstraat` entry put
		// a Kapellen photograph on a street in the next municipality.
		expect(idsIn(`${CORPUS}/Station en omgeving/Station en Nieuwstraat - zn - zd.jpg`)).toContain(
			'lucien-bevernagestraat'
		);
	});

	it('has no Kapellen entry left called Nieuwstraat', () => {
		expect(gazetteer.entries.some((entry) => entry.id === 'nieuwstraat')).toBe(false);
	});

	it('treats Rubensheide as a street, so its house numbers survive', () => {
		// It was filed as an 'area', and an area takes no house number - so every number on
		// legacy-site/Rubensheide.htm (55, 120, 132, 134, 136, 142) was being discarded.
		const result = matchImagePath(
			`${CORPUS}/Rubensheide/Villa Rozenhof - Rubensheide 120 - zn - zd.jpg`,
			index
		);

		expect(result.bestStreet?.entryId).toBe('rubensheide');
		expect(result.bestStreet?.houseNumber).toBe(120);
	});
});

describe('photo-corrections.json', () => {
	const corrections = JSON.parse(
		fs.readFileSync(path.join(__dirname, '..', 'data', 'photo-corrections.json'), 'utf8')
	) as {
		corrections: Record<string, { places?: string[]; by?: string; note?: string }>;
	};

	const ids = new Set(gazetteer.entries.map((entry) => entry.id));

	it('only names places that exist', () => {
		// The build throws on this too; the test says so before anyone waits for a build.
		for (const [photo, correction] of Object.entries(corrections.corrections)) {
			for (const placeId of correction.places ?? []) {
				expect({ photo, placeId, known: ids.has(placeId) }).toEqual({
					photo,
					placeId,
					known: true
				});
			}
		}
	});

	it('records who made each correction, so a doubtful one can be asked about', () => {
		for (const [photo, correction] of Object.entries(corrections.corrections)) {
			expect({ photo, by: Boolean(correction.by), note: Boolean(correction.note) }).toEqual({
				photo,
				by: true,
				note: true
			});
		}
	});
});
