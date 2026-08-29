/**
 * The curated seed for the Kapellen gazetteer.
 *
 * This file holds the part that requires human judgement: what a place is called, which
 * misspellings refer to it, whether it is a street or an estate, and which names need a
 * guard against a false positive. Everything measurable - how often each alias actually
 * occurs, and a sample photograph to check it against - is filled in by
 * `functions/scripts/build-gazetteer.ts`, which joins this seed against the 2948-file
 * corpus and refuses to emit an entry whose aliases occur nowhere.
 *
 * Rules for editing this file:
 *
 *  - **Never add coordinates here.** Geometry comes from OpenStreetMap via the refresh
 *    script, or from a deliberate map click, and lives in a separate file. A latitude
 *    typed from memory puts a photograph on the wrong street permanently.
 *  - **Only add aliases actually observed in the archive.** The generator will tell you
 *    if one never occurs; an alias with no occurrences is either a typo in this file or a
 *    guess, and both should be removed.
 *  - **`isStreet` is not inferred from the name.** This corpus is full of estates ending
 *    in -hof and woods ending in -bos. Marking one of those a street would attribute
 *    photographs to a road that does not exist.
 */

import type { District, PlaceGeometry, PlaceKind } from '../../../sharedModels/gazetteer';

/** A curated entry, before the corpus evidence is joined in. */
export interface SeedEntry {
	id: string;
	name: string;
	aliases?: string[];
	kind: PlaceKind;
	district?: District;
	/** Defaults to true. False for places outside the municipality. */
	inMunicipality?: boolean;
	/** Defaults to true for `street` and `square`, false for every other kind. */
	isStreet?: boolean;
	/** Defaults to true for `street` and `square`, false for every other kind. */
	allowHouseNumber?: boolean;
	/** Defaults to true. Set false for short, ambiguous or common-noun-adjacent names. */
	fuzzy?: boolean;
	negativeContext?: string[];
	relatedIds?: string[];
	note?: string;
	/**
	 * A coordinate placed here by a human, which always wins over anything fetched from
	 * OpenStreetMap. This is the one place a coordinate may be written by hand, and it
	 * must come from a deliberate click on a map - never from memory.
	 *
	 * It lives on the seed rather than on the generated JSON because the generator
	 * rewrites that file wholesale: a coordinate hand-edited into the output would be
	 * silently deleted on the next `npm run gazetteer:build`.
	 */
	manualGeometry?: PlaceGeometry | null;
}

/**
 * Streets we are confident are real, current Kapellen streets, with the spelling variants
 * observed in the archive.
 */
const STREETS: SeedEntry[] = [
	{ id: 'dorpsstraat', name: 'Dorpsstraat', aliases: ['Dorpstraat', 'Doprsstraat'], kind: 'street', district: 'kapellen' },
	{ id: 'hoevensebaan', name: 'Hoevensebaan', kind: 'street', district: 'kapellen' },
	{ id: 'loopgravenpad', name: 'Loopgravenpad', kind: 'street', district: 'kapellen' },
	{ id: 'antwerpsesteenweg', name: 'Antwerpsesteenweg', aliases: ['Antwerpsestraat'], kind: 'street', district: 'kapellen' },
	{ id: 'hoogboomsteenweg', name: 'Hoogboomsteenweg', aliases: ['Hoogboomsesteenweg'], kind: 'street', district: 'hoogboom' },
	{ id: 'kapelsestraat', name: 'Kapelsestraat', aliases: ['Kapelsesteenweg'], kind: 'street', district: 'kapellen', note: 'Kapelsesteenweg is an attested variant: house number 45 appears under both spellings.' },
	{ id: 'stationsstraat', name: 'Stationsstraat', kind: 'street', district: 'kapellen' },
	{ id: 'heidestraat', name: 'Heidestraat', aliases: ['Heidestraat-Noord'], kind: 'street', district: 'kapellen' },
	{ id: 'christiaan-pallemansstraat', name: 'Chr. Pallemansstraat', aliases: ['Chr.Pallemansstraat', 'Christiaan Pallemansstraat', 'Pallemansstraat'], kind: 'street', district: 'kapellen' },
	{ id: 'kalmthoutsesteenweg', name: 'Kalmthoutsesteenweg', aliases: ['Kalmhousesteenweg', 'Kalmrhoutsesteenweg', 'Kalthoutsesteenweg'], kind: 'street', district: 'kapellen' },
	{ id: 'jagersdreef', name: 'Jagersdreef', kind: 'street', district: 'hoogboom' },
	{ id: 'koning-albertlei', name: 'Koning Albertlei', aliases: ['Kon. Albertlei', 'Albertlei'], kind: 'street', district: 'kapellen' },
	{ id: 'akkerstraat', name: 'Akkerstraat', kind: 'street', district: 'kapellen' },
	{ id: 'guyotlei', name: 'Guyotlei', kind: 'street', district: 'kapellen' },
	{ id: 'koningin-astridlaan', name: 'Kon. Astridlaan', aliases: ['Kon.Astridlaan', 'Astridlaan', 'Koningin Astridlaan'], kind: 'street', district: 'kapellen' },
	{ id: 'prinsendreef', name: 'Prinsendreef', kind: 'street' },
	{ id: 'olmendreef', name: 'Olmendreef', kind: 'street', district: 'kapellen' },
	{ id: 'engelselei', name: 'Engelselei', kind: 'street', district: 'kapellen' },
	{ id: 'geelhanddreef', name: 'Geelhanddreef', aliases: ['Raymond Geelhanddreef'], kind: 'street', district: 'kapellen' },
	{ id: 'bloemenlei', name: 'Bloemenlei', kind: 'street', district: 'putte-kapellen' },
	{ id: 'lobelialaan', name: 'Lobelialaan', kind: 'street' },
	{ id: 'ijzerenweglaan', name: 'IJzerenweglaan', aliases: ['IJjzerenweglaan'], kind: 'street', district: 'kapellen' },
	{ id: 'meidoornlaan', name: 'Meidoornlaan', kind: 'street', district: 'kapellen' },
	{ id: 'ertbrandstraat', name: 'Ertbrandstraat', kind: 'street', district: 'ertbrand' },
	{ id: 'bosdreef', name: 'Bosdreef', kind: 'street' },
	{ id: 'waterstraat', name: 'Waterstraat', kind: 'street', district: 'kapellen' },
	{ id: 'gasstraat', name: 'Gasstraat', kind: 'street', district: 'kapellen' },
	{ id: 'louisastraat', name: 'Louisastraat', aliases: ['Albert Louisastraat'], kind: 'street' },

	// Single or double occurrences: real-looking, but worth confirming against OSM before
	// they are used to place a photograph with any confidence.
	{ id: 'oude-bergsebaan', name: 'Oude Bergsebaan', aliases: ['Bergsebaan'], kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'oude-kerkstraat', name: 'Oude Kerkstraat', aliases: ['Kerkstraat'], kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'putsesteenweg', name: 'Putsesteenweg', kind: 'street', district: 'putte-kapellen', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'korte-vredestraat', name: 'Korte Vredestraat', kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'oude-galgenstraat', name: 'Oude Galgenstraat', kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'nieuwstraat', name: 'Nieuwstraat', kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'lepelstraat', name: 'Lepelstraat', kind: 'street', district: 'putte-kapellen', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'koningin-elisabethlei', name: 'Koningin Elisabethlei', aliases: ['Kon. Elisabethlei'], kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'denneburgdreef', name: 'Denneburgdreef', kind: 'street', relatedIds: ['kasteel-dennenburg'], note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'koerspleindreef', name: 'Koerspleindreef', kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'blokjesweg', name: 'Blokjesweg', kind: 'street', note: 'single corpus occurrence; confirm against OSM' },
	{ id: 'oude-baan', name: 'Oude Baan', kind: 'street', relatedIds: ['rubensheide'], note: 'from "Rubensheide (Oude Baan)"; confirm against OSM' }
];

/** Squares, which take house numbers like streets do. */
const SQUARES: SeedEntry[] = [
	{ id: 'stationsplein', name: 'Stationsplein', aliases: ['Statieplein'], kind: 'square', district: 'kapellen' },
	{ id: 'dorpsplein', name: 'Dorpsplein', kind: 'square', district: 'kapellen' },
	{ id: 'kazerneplein', name: 'Kazerneplein', kind: 'square', district: 'hoogboom' }
];

/**
 * Parks. A trailing number after a park name is a photo index, never an address, which is
 * why `allowHouseNumber` defaults to false for this kind.
 */
const PARKS: SeedEntry[] = [
	{ id: 'gemeentepark-beaulieu', name: 'Gemeentepark Beaulieu', aliases: ['Gemeentepark'], kind: 'park', district: 'kapellen', relatedIds: ['kasteel-beaulieu'] },
	{ id: 'nelson-mandelapark', name: 'Nelson Mandelapark', aliases: ['Mandelapark'], kind: 'park', district: 'kapellen', relatedIds: ['kasteel-san-salvador'] },
	{ id: 'erepark', name: 'Erepark', kind: 'park', district: 'kapellen' },
	{ id: 'poloplein', name: 'Poloplein', kind: 'park' }
];

/** Neighbourhoods, hamlets and other areas. */
const AREAS: SeedEntry[] = [
	{ id: 'hoogboom', name: 'Hoogboom', aliases: ['Hoghescote'], kind: 'area', district: 'hoogboom', negativeContext: ['\\bheemkring\\s+hoghescote\\b'], note: 'Hoghescote is both the historical name of Hoogboom and the name of the local heritage society that contributed many photographs.' },
	{ id: 'mastenbos', name: 'Mastenbos', kind: 'area', district: 'kapellen' },
	{ id: 'putte-kapellen', name: 'Putte-Kapellen', aliases: ['Putte'], kind: 'area', district: 'putte-kapellen', fuzzy: false, negativeContext: ['\\bputte\\s*(nl|nederland|holland)\\b', '\\b(sk|fc|kfc|vv)\\s+putte\\b'] },
	{ id: 'geuzenhoek', name: 'Geuzenhoek', kind: 'area', district: 'kapellen' },
	{ id: 'het-rood', name: 'Het Rood', aliases: ['Rood'], kind: 'area', fuzzy: false },
	{ id: 'de-uitlegger', name: 'De Uitlegger', aliases: ['Uitlegger', 'UItlegger'], kind: 'area' },
	{ id: 'rubensheide', name: 'Rubensheide', kind: 'area', relatedIds: ['oude-baan'] },
	{ id: 'duitse-wijk', name: 'Duitse Wijk', kind: 'area', district: 'kapellen' },
	{ id: 'ertbrand', name: 'Ertbrand', kind: 'area', district: 'ertbrand' },
	{ id: 'nieuwe-wijk', name: 'Nieuwe Wijk', kind: 'area', district: 'kapellen' },
	{ id: 'kapellenbos', name: 'Kapellenbos', kind: 'area', district: 'kapellen' },
	{ id: 'essenhout', name: 'Essenhout', kind: 'area' },
	{ id: 'zilverenhoek', name: 'Zilverenhoek', kind: 'area' },
	{ id: 'de-grens', name: 'De Grens', aliases: ['Grens'], kind: 'area', district: 'putte-kapellen', fuzzy: false },
	{ id: 'galgeveld', name: 'Galgeveld', kind: 'area', district: 'putte-kapellen' },
	{ id: 'industriepark', name: 'Industriepark', kind: 'area' },
	{ id: 'driehoek', name: 'Driehoek', kind: 'area', district: 'putte-kapellen' },
	{
		id: 'kapellen',
		name: 'Kapellen',
		aliases: ['Capellen', 'Cappellen'],
		kind: 'area',
		district: 'kapellen',
		fuzzy: false,
		negativeContext: [
			'\\bkerken\\s+en\\s+kapellen\\b',
			'\\bkapelle?ke?n?\\b',
			'\\b(fc|kfc|sk|vv)\\s+cap+ellen\\b',
			'\\btram\\s+klapdorp'
		],
		note: 'The municipality itself. Guarded against the common noun "kapellen" (the archive has a folder "Kerken en kapellen") and against the football club FC Capellen.'
	}
];

/**
 * Castles and estates. Every one of these is `isStreet: false` - this is the guard set
 * that stops "-hof" and "-bos" names from being read as roads.
 */
const ESTATES: SeedEntry[] = [
	{ id: 'kasteel-wolvenbos', name: 'Kasteel Wolvenbos', kind: 'castle-estate' },
	{ id: 'kasteel-starrenhof', name: 'Kasteel Starrenhof', aliases: ['Starrenhof'], kind: 'castle-estate' },
	{ id: 'kasteel-beaulieu', name: 'Kasteel Beaulieu', kind: 'castle-estate', relatedIds: ['gemeentepark-beaulieu'] },
	{ id: 'kasteel-irishof', name: 'Kasteel Irishof', aliases: ['Irishof'], kind: 'castle-estate' },
	{ id: 'kasteel-hortensiahof', name: 'Kasteel Hortensiahof', aliases: ['Hortensiahof'], kind: 'castle-estate' },
	{ id: 'kasteel-blauwhof', name: 'Kasteel Blauwhof', aliases: ['Blauwhof'], kind: 'castle-estate' },
	{ id: 'kasteel-op-den-wal', name: 'Kasteel Op den Wal', aliases: ['Op den Wal', 'Kasteel Op de Wal'], kind: 'castle-estate', relatedIds: ['meidoornlaan'], note: 'The corpus places it at Meidoornlaan 9.' },
	{ id: 'kasteel-dennenburg', name: 'Kasteel Dennenburg', aliases: ['Denneburg', 'Kasteel Oud Dennenburg'], kind: 'castle-estate', relatedIds: ['denneburgdreef'] },
	{ id: 'kasteel-heidehof', name: 'Kasteel Heidehof', aliases: ['Heidehof'], kind: 'castle-estate', relatedIds: ['kapelsestraat'], note: 'The corpus places it at Kapelsestraat 45.' },
	{ id: 'kasteel-boterberg', name: 'Kasteel Boterberg', aliases: ['Boterberg'], kind: 'castle-estate' },
	{ id: 'kasteel-beukenhof', name: 'Kasteel Beukenhof', aliases: ['Beukenhof'], kind: 'castle-estate' },
	{ id: 'kasteel-bunderhof', name: 'Kasteel Bunderhof', aliases: ['Bunderhof'], kind: 'castle-estate' },
	{ id: 'kasteel-de-sterre', name: 'Kasteel De Sterre', aliases: ['De Sterre'], kind: 'castle-estate' },
	{ id: 'kasteel-les-etangs', name: 'Kasteel Les Etangs', aliases: ['Hof Ter Vijvers', 'Hof ter Vijvers', 'Vijverhof'], kind: 'castle-estate', relatedIds: ['kapelsestraat'], note: 'The corpus places it at Kapelsestraat 43.' },
	{ id: 'kasteel-heidelust-zilverhof', name: 'Kasteel Heidelust', aliases: ['Zilverhof', 'Heidelust'], kind: 'castle-estate' },
	{ id: 'kasteel-mastenhof', name: 'Kasteel Mastenhof', aliases: ['Mastenhof'], kind: 'castle-estate' },
	{ id: 'kasteel-haezeldonck', name: 'Kasteel Haezeldonck', aliases: ['Haezeldonck-Good', 'Haezeldonck'], kind: 'castle-estate' },
	{ id: 'lusthof-hoenderhof', name: 'Lusthof Hoenderhof', aliases: ['Hoenderhof', 'Lusthof'], kind: 'castle-estate' },
	{ id: 'kasteel-les-chataigniers', name: 'Kasteel Les Chataigniers', aliases: ['Kastanjehof'], kind: 'castle-estate' },
	{ id: 'kasteel-san-salvador', name: 'Kasteel San Salvador', kind: 'castle-estate', relatedIds: ['nelson-mandelapark'] },
	{ id: 'rozenhof', name: 'Villa Rozenhof', aliases: ['Rozenhof', 'Parein-Rozenhof'], kind: 'castle-estate' },
	{ id: 'kasteel-ravenhof', name: 'Kasteel Ravenhof', aliases: ['Ravenhof'], kind: 'castle-estate', inMunicipality: false, note: 'Ravenhof lies in Stabroek, not Kapellen. Searchable, but excluded from the map of Kapellen.' },
	{ id: 'mastbeekhof', name: 'Mastbeekhof', kind: 'castle-estate' },
	{ id: 'kattekensberg', name: 'Kattekensberg', kind: 'castle-estate' }
];

/** Forts. */
const FORTS: SeedEntry[] = [
	{ id: 'fort-van-ertbrand', name: 'Fort van Ertbrand', aliases: ['Fort Ertbrand', 'Fort van Ertbrandt'], kind: 'fort', district: 'ertbrand' },
	{ id: 'fort-van-kapellen', name: 'Fort van Kapellen', kind: 'fort', note: 'District deliberately left unknown: do not assert Hoogboom without OSM confirmation.' }
];

/** Named buildings and landmarks. */
const BUILDINGS: SeedEntry[] = [
	{ id: 'sint-jacobuskerk', name: 'Sint-Jacobuskerk', aliases: ['St. Jacobuskerk', 'St. Jacobuskerkerk'], kind: 'building', district: 'kapellen' },
	{ id: 'sint-jozefkerk', name: 'Sint-Jozefkerk', aliases: ['St. Jozefkerk'], kind: 'building', relatedIds: ['hoogboomsteenweg'], note: 'The corpus gives Hoogboomsteenweg 294.' },
	{ id: 'oud-gemeentehuis', name: 'Oud Gemeentehuis', aliases: ['Gemeentehuis'], kind: 'building', district: 'kapellen' },
	{ id: 'hoogboom-kazerne', name: 'Hoogboom Kazerne', aliases: ['Kazerne'], kind: 'building', district: 'hoogboom' },
	{ id: 'rustoord-welvaart', name: 'Rustoord Welvaart', aliases: ['Welvaart', 'Hoogboom Rustoord Welvaart'], kind: 'building', district: 'hoogboom' },
	{ id: 'villa-zonnelicht', name: 'Villa Zonnelicht', aliases: ['Zonnelicht'], kind: 'building' },
	{ id: 'louwke-poep', name: 'Louwke Poep', aliases: ['Louwke'], kind: 'building', district: 'kapellen', note: 'A local landmark rather than a building in the ordinary sense.' },
	{ id: 'lievenskapel', name: 'Lievenskapel', kind: 'building' },
	{ id: 'villa-plantijn', name: 'Villa Plantijn', aliases: ['Plantijn'], kind: 'building' },
	{ id: 'station-kapellen', name: 'Station Kapellen', aliases: ['Statie'], kind: 'building', district: 'kapellen', fuzzy: false },
	{ id: 'villa-de-maretak', name: 'Villa De Maretak', aliases: ['Villa De Marentak'], kind: 'building', district: 'kapellen' },
	{ id: 'hoogboomkruis', name: 'Hoogboomkruis', kind: 'building', district: 'hoogboom' },
	{ id: 'sint-dionysiuskerk', name: 'Sint-Dionysiuskerk', aliases: ['St. Dionysiuskerk', 'St. Dyonisiuskerk'], kind: 'building', district: 'putte-kapellen' },
	{ id: 'kapel-olv-van-fatima', name: 'Kapel OLV van Fatima', aliases: ['OLV Fatima'], kind: 'building' },
	{ id: 'kerk-olv-van-vrede', name: 'Kerk OLV van Vrede', aliases: ['Kerk OLV Vrede', 'Kerk O.L.V. van Vrede'], kind: 'building' },
	{ id: 'sint-jozefkapel', name: 'Sint-Jozefkapel', aliases: ['St. Jozefkapel'], kind: 'building', district: 'kapellen' },
	{ id: 'mulskapel', name: 'Mulskapel', kind: 'building' },
	{ id: 'cafe-de-pancras', name: 'Café De Pancras', aliases: ['Café Pancras', 'Cafe De Pancras', 'Pancras'], kind: 'building', district: 'kapellen' },
	{ id: 'olv-onbevlekte-ontvangenis', name: 'OLV Onbevlekte Ontvangenis', kind: 'building', relatedIds: ['zilverenhoek'] },
	{ id: 'de-barreel', name: 'Café De Barreel', aliases: ['Barreel'], kind: 'building', relatedIds: ['koning-albertlei'] },
	{ id: 'villa-des-hirondelles', name: 'Villa Des Hirondelles', kind: 'building', district: 'hoogboom' },
	{ id: 'kapel-de-heuvels', name: 'Kapel De Heuvels', kind: 'building' },
	{ id: 'tajje', name: 'Tajje', kind: 'building', fuzzy: false, note: 'A landmark; exact identity still to be confirmed.' },
	{ id: 'villa-heirust', name: 'Villa Heirust', aliases: ['Heirust'], kind: 'building', district: 'putte-kapellen' },
	{ id: 'domein-middelbeek', name: 'Domein Middelbeek', aliases: ['Middelbeek'], kind: 'building', district: 'putte-kapellen' },
	{ id: 'home-kindervreugd', name: 'Home Kindervreugd', kind: 'building' },
	{ id: 'home-philippe-speth', name: 'Home Philippe Speth', kind: 'building', relatedIds: ['kapelsestraat'], note: 'The corpus gives Kapelsestraat 246.' },
	{ id: 'home-flor-mielants', name: 'Home Flor Mielants', kind: 'building' },
	{ id: 'maison-la-chaine', name: 'Maison La Chaine', kind: 'building', relatedIds: ['stationsstraat'] },
	{ id: 'casteleinhoeve', name: 'Casteleinhoeve', kind: 'building', relatedIds: ['kalmthoutsesteenweg'] }
];

/**
 * Names deliberately NOT in the gazetteer, recorded with the reason so that nobody
 * re-adds them after seeing them in a filename.
 *
 * The generator asserts that none of these ever becomes an entry id.
 */
export const EXCLUDED_FROM_GAZETTEER: ReadonlyArray<{ name: string; reason: string }> = [
	{ name: 'Strybos', reason: 'A contributor surname (Jelle Strybos), not a wood.' },
	{ name: 'Verdonck', reason: 'A surname.' },
	{ name: 'Van Elst', reason: 'A contributor surname.' },
	{ name: 'Spoorwegbataljon', reason: 'A military unit, not a place.' },
	{ name: 'Spoorwegregiment', reason: 'A military unit, not a place.' },
	{ name: 'Springkasteel', reason: 'A bouncy castle at a GZVKA event, not a castle.' },
	{ name: 'Brandweerkasteel', reason: 'A bouncy castle at a GZVKA event, not a castle.' },
	{ name: 'Klapdorp', reason: 'A street in Antwerp, reached only via a tram destination.' },
	{ name: 'Azalea', reason: 'A present-day sponsor in the Wedstrijden GZVKA folder.' },
	{ name: 'Marie-Leen', reason: 'A present-day sponsor in the Wedstrijden GZVKA folder.' },
	{ name: 'Computerkliniek', reason: 'A present-day sponsor in the Wedstrijden GZVKA folder.' },
	{ name: 'De Jachthoorn', reason: 'A present-day sponsor in the Wedstrijden GZVKA folder.' },
	{ name: 'Het Perkament', reason: 'A present-day sponsor in the Wedstrijden GZVKA folder.' },
	{ name: 'Vliegveld', reason: 'A common noun.' },
	{ name: 'Tennisveld', reason: 'A common noun.' },
	{ name: 'Macadamweg', reason: 'A common noun (a road surface).' },
	{ name: 'Herberg', reason: 'A common noun.' },
	{ name: 'Park', reason: 'A common noun.' },
	{ name: 'Plein', reason: 'A common noun.' },
	{ name: 'Hof', reason: 'A common noun.' },
	{ name: 'Weg', reason: 'A common noun.' },
	{ name: 'Baan', reason: 'A common noun.' },
	{ name: 'Dreef', reason: 'A common noun.' },
	{ name: 'Steenweg', reason: 'A common noun.' },
	{ name: 'Kruisbaan', reason: 'Appears only inside the café name "Café In de Kruisbaan" in Putte; leave to the OSM review queue.' }
];

/** Kinds that take house numbers and count as streets for "which street is this?". */
const STREET_LIKE_KINDS: ReadonlySet<PlaceKind> = new Set<PlaceKind>(['street', 'square']);

/** The curated seed, with the per-kind defaults resolved. */
export const SEED_ENTRIES: ReadonlyArray<Required<Pick<SeedEntry, 'id' | 'name' | 'kind'>> & SeedEntry> =
	[...STREETS, ...SQUARES, ...PARKS, ...AREAS, ...ESTATES, ...FORTS, ...BUILDINGS];

/** Applies the per-kind defaults to a seed entry. */
export function resolveSeedDefaults(entry: SeedEntry): Required<
	Pick<SeedEntry, 'inMunicipality' | 'isStreet' | 'allowHouseNumber' | 'fuzzy' | 'district'>
> {
	const streetLike = STREET_LIKE_KINDS.has(entry.kind);

	return {
		inMunicipality: entry.inMunicipality ?? true,
		isStreet: entry.isStreet ?? streetLike,
		allowHouseNumber: entry.allowHouseNumber ?? streetLike,
		fuzzy: entry.fuzzy ?? true,
		district: entry.district ?? 'unknown'
	};
}
