/**
 * The Kapellen gazetteer: the canonical list of places the archive can attribute a
 * photograph to, and the vocabulary that search, the map and the AI prompt all share.
 *
 * Two rules govern this data and are worth stating up front, because breaking either one
 * silently corrupts a heritage archive in a way nobody notices for years:
 *
 *  1. **Names are evidence-backed, coordinates are register-backed.** Entry names and
 *     aliases are mined from the 2948-file corpus (every alias here was actually observed
 *     in a filename or folder). Coordinates are never typed by hand from memory - they
 *     arrive only from OpenStreetMap or a deliberate map click, and they live in a
 *     separate {@link OsmGeometryFile} so refreshing them never disturbs curation.
 *  2. **Not every place is a street.** The corpus is full of castle and estate names
 *     ending in -hof and -bos ("Irishof", "Mastenbos"). Treating those as streets would
 *     put photographs on roads that do not exist, so `isStreet` and `allowHouseNumber`
 *     are explicit flags rather than something inferred from the name's shape.
 */

/** What kind of place an entry describes. */
export type PlaceKind =
	| 'street'
	| 'square'
	| 'park'
	| 'castle-estate'
	| 'fort'
	| 'building'
	| 'area';

/** A district of the municipality of Kapellen, or `unknown` when it is not established. */
export type District = 'kapellen' | 'hoogboom' | 'putte-kapellen' | 'ertbrand' | 'unknown';

/** A resolved location for a place. */
export interface PlaceGeometry {
	/** WGS84. Only ever from OSM or a deliberate map click - never from memory. */
	centroid: { lat: number; lng: number };
	/** [minLng, minLat, maxLng, maxLat] */
	bbox: [number, number, number, number];
	source: 'osm' | 'manual';
	/** e.g. ["way/12345", "relation/678"] */
	osmRefs?: string[];
	/** ISO-8601 date of the Overpass fetch. */
	fetchedAt?: string;
}

/** One canonical place in (or referenced by) the Kapellen archive. */
export interface GazetteerEntry {
	/** Stable kebab-case slug. Used in URLs and as a document key; never renamed. */
	id: string;
	/** Canonical Dutch name, as it should be displayed. */
	name: string;
	/**
	 * Every raw surface form observed in the corpus, including misspellings such as
	 * "Kalmhousesteenweg". `name` is implicitly an alias and is not repeated here.
	 */
	aliases: string[];
	kind: PlaceKind;
	district: District;
	/**
	 * False for places the archive references that lie outside Kapellen (Ravenhof is in
	 * Stabroek). Still searchable, but excluded from the map of Kapellen.
	 */
	inMunicipality: boolean;
	/**
	 * True only for entries we are confident are real, current Kapellen streets.
	 * "Which street is this photograph on?" filters on this.
	 */
	isStreet: boolean;
	/**
	 * May a bare number following this name be read as a house number? False for parks,
	 * areas, forts and estates, where a trailing number is a photo index
	 * ("Gemeentepark 3"), not an address.
	 */
	allowHouseNumber: boolean;
	/** Opt out of fuzzy matching: short, ambiguous, or common-noun-adjacent names. */
	fuzzy: boolean;
	/**
	 * Case-insensitive regex sources. If any matches the text window around a hit, the
	 * hit is discarded. This is how "Putte NL" and "Heemkring Hoghescote" are kept from
	 * being read as places in Kapellen.
	 */
	negativeContext?: string[];
	/** Same or similar name, different thing - an estate versus the street named after it. */
	relatedIds?: string[];
	/** Provenance, why an alias exists, or what still needs confirming. */
	note?: string;
	/** Hand-set geometry. Always wins over the OSM file. */
	manualGeometry?: PlaceGeometry | null;
	evidence: {
		/** Occurrences of any alias across the 2948 corpus paths. */
		corpusHits: number;
		/** One real relative path, so a reviewer can go and look at the photograph. */
		sampleFile: string;
	};
}

/** The checked-in gazetteer file. */
export interface Gazetteer {
	version: number;
	updatedAt: string;
	entries: GazetteerEntry[];
}

/**
 * Geometry fetched from OpenStreetMap, kept separate from the curated gazetteer so that
 * a refresh can never clobber a human's curation, and so that a missing coordinate stays
 * visibly missing instead of being quietly invented.
 */
export interface OsmGeometryFile {
	version: number;
	generatedAt: string;
	/** sha256 of the exact Overpass QL that produced this file, for reproducibility. */
	overpassQueryHash: string;
	municipality: {
		osmRelationId: number;
		name: string;
		refIns?: string;
		bbox: [number, number, number, number];
	};
	/** Keyed by {@link GazetteerEntry.id}. */
	byEntryId: Record<string, PlaceGeometry>;
	/**
	 * Named features OSM found inside Kapellen that match no gazetteer entry.
	 * This is the honest way to discover streets the archive is missing.
	 */
	unmatched: Array<{
		name: string;
		osmRef: string;
		osmKind: string;
		centroid: { lat: number; lng: number };
	}>;
	/** Entry ids Overpass found nothing for. Their coordinates stay null. */
	unresolved: string[];
	/** Fuzzy-only links staged for human approval - listed, never applied. */
	needsReview: Array<{ entryId: string; osmName: string; osmRef: string; editDistance: number }>;
}

/** How a place name in text was matched to a gazetteer entry. */
export type MatchMethod = 'exact' | 'alias' | 'fuzzy';

/** Where the matched text came from. */
export type MatchSource = 'folder' | 'filename' | 'ocr' | 'vision';

/** One place found in a piece of text. */
export interface PlaceMatch {
	entryId: string;
	canonicalName: string;
	kind: PlaceKind;
	district: District;
	/** The literal text that matched, as it appeared. */
	matchedText: string;
	/** The alias (or canonical name) it matched against. */
	matchedAlias: string;
	source: MatchSource;
	method: MatchMethod;
	editDistance: number;
	/** 0..1, see the scoring rules in the matcher. */
	confidence: number;
	houseNumber: number | null;
	/** The "A" in "12A". */
	houseNumberSuffix: string | null;
	houseNumberConfidence: 'high' | 'low' | null;
	segmentIndex: number;
	charRange: [number, number];
}

/** Two places named together, as in "Chr. Pallemansstraat-Heidestraat". */
export interface CornerMatch {
	aId: string;
	bId: string;
	text: string;
	confidence: number;
}

/**
 * Resolves an entry's location: a human's manual geometry always beats the machine's.
 * Returns null when neither exists - a missing coordinate must stay missing.
 */
export function resolveGeometry(
	entry: GazetteerEntry,
	osm: OsmGeometryFile | null
): PlaceGeometry | null {
	return entry.manualGeometry ?? osm?.byEntryId[entry.id] ?? null;
}
