/**
 * Matching text against the Kapellen gazetteer.
 *
 * Given a filename or folder name, this finds the places named in it, tolerating the
 * spelling variants the archive actually contains, and refusing the near-misses that
 * would attribute a photograph to the wrong street.
 *
 * The safety of the whole feature rests on the gates in {@link fuzzyMatch}: two edits at
 * nine characters separates "Mastenbos" (a wood) from "Mastenhof" (a manor), so edit
 * distance alone is not enough, and the street-suffix family has to agree as well.
 *
 * Pure module: no Firebase, no config, testable offline.
 */

import type {
	CornerMatch,
	District,
	Gazetteer,
	GazetteerEntry,
	MatchSource,
	PlaceKind,
	PlaceMatch
} from '../../../sharedModels/gazetteer';
import { damerauLevenshtein, diceCoefficient } from './distance';
import { corePlace, normalizePlace, streetSuffixFamily } from './normalize';
import { splitFilename, splitPathContext } from './segment';

/** A match is only reported at or above this confidence. */
export const MIN_CONFIDENCE = 0.75;

/** Dice similarity a candidate must clear before the costlier edit distance is computed. */
const DICE_PREFILTER = 0.55;

/** Fuzzy matching is not attempted on windows shorter than this. */
const MIN_FUZZY_LENGTH = 5;

/**
 * Leading words that describe what is pictured rather than where it is. Stripped so that
 * "Kasteel Op den Wal" and "Op den Wal" agree, but only with whole-word anchoring at the
 * start - stripping "kasteel" as a substring would turn "Springkasteel Aap", an inflatable
 * at a village fete, into a castle.
 */
const LEADING_NOISE_WORDS = [
	'hoek',
	'ingang',
	'inkom',
	'afbraak',
	'start',
	'poort',
	'tram',
	'molen',
	'kapel',
	'kerk',
	'villa',
	'kasteel',
	'home',
	'cafe',
	'postkaart',
	'luchtfoto',
	'treinongeval',
	'kleuterschool',
	'domein',
	'klooster',
	'lusthof',
	'fort van',
	'fort'
];

/**
 * A house number directly after a matched place name.
 *
 * The lookarounds carry the weight: `(?<!\d)(\d{1,3})(?!\d)` refuses four-digit years, so
 * "Doprsstraat 1960" and "FC Capellen 1928" yield nothing, and `(?![.\d])` after the
 * digits refuses date fragments such as "09.07.1976".
 */
const HOUSE_NUMBER = /^[\s,.]*(?<!\d)(\d{1,3})(?!\d)\s*(?![.\d])([A-Za-z](?![A-Za-z]))?\b/;

/** An explicit house-number marker anywhere in the text overrides a bare trailing digit. */
const EXPLICIT_NUMBER_MARKER = /\b(?:nr|n°|no|huisnummer)\.?\s*(\d{1,3})\b/i;

/** A lookup structure built once from the gazetteer and reused for every match. */
export interface GazetteerIndex {
	entries: GazetteerEntry[];
	byId: Map<string, GazetteerEntry>;
	/** Normalized surface form -> entry. */
	byNormAlias: Map<string, GazetteerEntry>;
	/** Honorific-stripped surface form -> entry. */
	byCoreAlias: Map<string, GazetteerEntry>;
	/** Longest alias, in tokens, so the n-gram sweep knows where to start. */
	maxAliasTokens: number;
	/** Entries eligible for fuzzy matching, with their precomputed core forms. */
	fuzzyCandidates: Array<{ entry: GazetteerEntry; core: string; family: string | null }>;
}

/** Builds the lookup structure. Cheap enough to do at module load, but do it once. */
export function buildIndex(gazetteer: Gazetteer): GazetteerIndex {
	const byId = new Map<string, GazetteerEntry>();
	const byNormAlias = new Map<string, GazetteerEntry>();
	const byCoreAlias = new Map<string, GazetteerEntry>();
	const fuzzyCandidates: GazetteerIndex['fuzzyCandidates'] = [];
	let maxAliasTokens = 1;

	for (const entry of gazetteer.entries) {
		byId.set(entry.id, entry);

		for (const surfaceForm of [entry.name, ...entry.aliases]) {
			const normalized = normalizePlace(surfaceForm);
			if (normalized === '') continue;

			// First writer wins, so a longer, more specific entry seeded earlier is not
			// displaced by a shorter one that happens to share a surface form.
			if (!byNormAlias.has(normalized)) byNormAlias.set(normalized, entry);

			const core = corePlace(surfaceForm);
			if (core !== '' && !byCoreAlias.has(core)) byCoreAlias.set(core, entry);

			maxAliasTokens = Math.max(maxAliasTokens, normalized.split(' ').length);
		}

		if (entry.fuzzy) {
			const core = corePlace(entry.name);
			fuzzyCandidates.push({ entry, core, family: streetSuffixFamily(core) });
		}
	}

	return {
		entries: gazetteer.entries,
		byId,
		byNormAlias,
		byCoreAlias,
		maxAliasTokens,
		fuzzyCandidates
	};
}

/**
 * The edit budget for a window of the given length.
 *
 * Deliberately tight, because Kapellen's place names crowd together. A budget of two at
 * nine characters lets "Zilverhof" reach "Vijverhof" and "Ravenhof" reach "Rozenhof" -
 * different estates, all sharing the `hof` family, so the suffix gate cannot separate
 * them either. Attributing a photograph to the wrong castle is exactly the silent
 * corruption this pipeline exists to avoid.
 *
 * One edit covers the real variation: every misspelling observed in the archive is a
 * single slip apart from its correct form, with the sole exception of the long
 * `-steenweg` names, which is why longer windows get two. The multi-edit misspellings we
 * already know about ("Kalmhousesteenweg", "Doprsstraat") are recorded as aliases and so
 * resolve exactly, never through this stage - fuzzy matching only has to catch typos
 * nobody has catalogued yet, and it should be timid about it.
 *
 * `gazetteerHasNoFuzzyCollisions` in the tests holds this honest: it fails if any future
 * entry makes two distinct places reachable from one another.
 */
export function maxEdits(length: number): number {
	return length <= 15 ? 1 : 2;
}

/** Options for a match run. */
export interface MatchOptions {
	source: MatchSource;
	/** Index of the segment the text came from, for provenance. */
	segmentIndex?: number;
	/** District implied by the folder, which slightly boosts an agreeing entry. */
	districtHint?: District;
	/** Text searched for negative-context guards. Defaults to the matched text itself. */
	guardContext?: string;
	minConfidence?: number;
}

/**
 * Finds every gazetteer place named in a piece of text.
 *
 * Windows are swept longest-first and consumed once, so "Kapellenbos" wins over
 * "Kapellen" and "Kasteel Op den Wal" wins over "Wal".
 */
export function matchPlacesInText(
	text: string,
	index: GazetteerIndex,
	options: MatchOptions
): PlaceMatch[] {
	const matches: PlaceMatch[] = [];
	const threshold = options.minConfidence ?? MIN_CONFIDENCE;
	const guardContext = options.guardContext ?? text;

	for (const phrase of splitIntoPhrases(text)) {
		for (const variant of leadingNoiseVariants(phrase)) {
			const tokens = normalizePlace(variant).split(' ').filter(Boolean);
			if (tokens.length === 0) continue;

			const taken = new Array<boolean>(tokens.length).fill(false);

			for (
				let windowSize = Math.min(index.maxAliasTokens, tokens.length);
				windowSize >= 1;
				windowSize -= 1
			) {
				for (let start = 0; start + windowSize <= tokens.length; start += 1) {
					if (taken.slice(start, start + windowSize).some(Boolean)) continue;

					const window = tokens.slice(start, start + windowSize).join(' ');
					const hit = lookup(window, index);
					if (!hit) continue;

					if (isGuarded(hit.entry, guardContext)) continue;

					const confidence = scoreMatch(hit, window, options);
					if (confidence < threshold) continue;

					for (let i = start; i < start + windowSize; i += 1) taken[i] = true;

					matches.push(buildMatch(hit, window, confidence, text, phrase, variant, options));
				}
			}
		}
	}

	return dedupeById(matches);
}

interface Hit {
	entry: GazetteerEntry;
	method: PlaceMatch['method'];
	editDistance: number;
	matchedAlias: string;
}

/** Exact, then honorific-stripped, then fuzzy. */
function lookup(window: string, index: GazetteerIndex): Hit | null {
	const exact = index.byNormAlias.get(window);
	if (exact) return { entry: exact, method: 'exact', editDistance: 0, matchedAlias: window };

	const core = corePlace(window);
	const aliased = index.byCoreAlias.get(core);
	if (aliased) return { entry: aliased, method: 'alias', editDistance: 0, matchedAlias: core };

	return fuzzyMatch(core, index);
}

/**
 * The tolerant stage, and the one that has to be careful.
 *
 * A candidate must clear four independent gates: a comparable length, a cheap Dice
 * pre-filter, an identical street-suffix family, and an edit distance within the budget
 * for its length. The family gate is what rejects "Mastenbos" against "Mastenhof" - two
 * edits apart, and both real places in this archive.
 */
export function fuzzyMatch(core: string, index: GazetteerIndex): Hit | null {
	if (core.length < MIN_FUZZY_LENGTH) return null;

	const family = streetSuffixFamily(core);
	const budget = maxEdits(core.length);

	let best: Hit | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of index.fuzzyCandidates) {
		if (Math.abs(core.length - candidate.core.length) > 3) continue;
		if (candidate.family !== family) continue;
		if (diceCoefficient(core, candidate.core) < DICE_PREFILTER) continue;

		const distance = damerauLevenshtein(core, candidate.core, budget);
		if (distance > budget) continue;

		if (distance < bestDistance) {
			bestDistance = distance;
			best = {
				entry: candidate.entry,
				method: 'fuzzy',
				editDistance: distance,
				matchedAlias: candidate.core
			};
		}
	}

	return best;
}

/** True when one of the entry's negative-context guards fires against the surrounding text. */
export function isGuarded(entry: GazetteerEntry, context: string): boolean {
	if (!entry.negativeContext || entry.negativeContext.length === 0) return false;

	return entry.negativeContext.some((source) => new RegExp(source, 'i').test(context));
}

/** Weights how much a match is trusted, given how and where it was found. */
function scoreMatch(hit: Hit, window: string, options: MatchOptions): number {
	const base =
		hit.method === 'exact' ? 1.0 : hit.method === 'alias' ? 0.95 : 0.9 - 0.08 * hit.editDistance;

	const sourceWeight =
		options.source === 'filename'
			? 1.0
			: options.source === 'folder'
			? 0.85
			: options.source === 'ocr'
			? 0.6
			: 0.5;

	const lengthPenalty = corePlace(window).length < 7 ? 0.85 : 1.0;
	const districtBonus =
		options.districtHint && options.districtHint === hit.entry.district ? 0.05 : 0;

	return Math.min(1, base * sourceWeight * lengthPenalty + districtBonus);
}

function buildMatch(
	hit: Hit,
	window: string,
	confidence: number,
	originalText: string,
	phrase: string,
	variant: string,
	options: MatchOptions
): PlaceMatch {
	const houseNumber = hit.entry.allowHouseNumber
		? extractHouseNumber(variant, window, originalText)
		: { number: null, suffix: null, confidence: null };

	const charStart = originalText.toLowerCase().indexOf(phrase.toLowerCase());

	return {
		entryId: hit.entry.id,
		canonicalName: hit.entry.name,
		kind: hit.entry.kind as PlaceKind,
		district: hit.entry.district,
		matchedText: window,
		matchedAlias: hit.matchedAlias,
		source: options.source,
		method: hit.method,
		editDistance: hit.editDistance,
		confidence,
		houseNumber: houseNumber.number,
		houseNumberSuffix: houseNumber.suffix,
		houseNumberConfidence: houseNumber.confidence,
		segmentIndex: options.segmentIndex ?? 0,
		charRange: [Math.max(0, charStart), Math.max(0, charStart) + phrase.length]
	};
}

/** Escapes a string for literal use inside a regular expression. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The house number following a place name, when the archive really wrote one.
 *
 * Deliberately measured against the ORIGINAL text rather than the normalized form.
 * Normalization turns every punctuation mark into a space, which makes the date
 * "Dorpsstraat 09.07.1976" indistinguishable from the address range "Akkerstraat 40-42" -
 * both become "<street> <digits> <digits>". Keeping the dots lets the lookahead reject
 * the date while still accepting the range.
 */
export function extractHouseNumber(
	segmentText: string,
	matchedWindow: string,
	fullText: string
): { number: number | null; suffix: string | null; confidence: 'high' | 'low' | null } {
	// An explicit marker beats a bare trailing digit. This is what resolves
	// "Geelhanddreef 5 - nr 9 hoeve" to number 9 rather than 5.
	const explicit = fullText.match(EXPLICIT_NUMBER_MARKER);
	if (explicit) {
		return { number: Number.parseInt(explicit[1], 10), suffix: null, confidence: 'high' };
	}

	// Locate the matched place in the original text, allowing any punctuation between its
	// words so that "Chr. Pallemansstraat" is found from the normalized "christiaan
	// pallemansstraat" it produced.
	const after = textAfterPlace(segmentText, matchedWindow);
	if (after === null) return { number: null, suffix: null, confidence: null };

	// An underscore between the name and the number is a duplicate marker, not an address:
	// "Kasteel Op den Wal_5" is the fifth photograph, not number 5.
	if (/^_\d/.test(after)) return { number: null, suffix: null, confidence: null };

	const match = after.match(HOUSE_NUMBER);
	if (!match) return { number: null, suffix: null, confidence: null };

	const value = Number.parseInt(match[1], 10);
	if (Number.isNaN(value) || value < 1 || value > 999) {
		return { number: null, suffix: null, confidence: null };
	}

	// The highest number actually observed in the corpus is Hoogboomsteenweg 294, so
	// anything far above that is more likely a year fragment or a count than an address.
	const confidence: 'high' | 'low' = value > 400 ? 'low' : 'high';

	return { number: value, suffix: match[2] ? match[2].toUpperCase() : null, confidence };
}

/**
 * Returns the remainder of the original text immediately after the matched place name,
 * or null when the name cannot be located in it.
 *
 * The last token of the normalized window is enough to anchor on, and is robust to the
 * honorific expansion that made the window differ from the text in the first place
 * ("Chr." became "christiaan", but "pallemansstraat" is still there verbatim).
 */
function textAfterPlace(segmentText: string, matchedWindow: string): string | null {
	const tokens = matchedWindow.split(' ').filter(Boolean);
	if (tokens.length === 0) return null;

	const anchor = tokens[tokens.length - 1];
	const pattern = new RegExp(escapeRegExp(anchor), 'i');
	const found = segmentText.match(pattern);

	if (!found || found.index === undefined) return null;

	return segmentText.slice(found.index + found[0].length);
}

/** Splits a segment into the sub-phrases a place name might occupy. */
function splitIntoPhrases(text: string): string[] {
	return text
		.split(/\s*[-,/]\s*|\s+en\s+/i)
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

/** The phrase as written, plus the phrase with a leading descriptive word removed. */
function leadingNoiseVariants(phrase: string): string[] {
	const variants = [phrase];
	const normalized = normalizePlace(phrase);

	for (const noise of LEADING_NOISE_WORDS) {
		if (normalized === noise) continue;
		if (normalized.startsWith(`${noise} `)) {
			variants.push(normalized.slice(noise.length + 1));
			break;
		}
	}

	return variants;
}

/** Keeps the highest-confidence match per entry. */
function dedupeById(matches: PlaceMatch[]): PlaceMatch[] {
	const best = new Map<string, PlaceMatch>();

	for (const match of matches) {
		const existing = best.get(match.entryId);
		if (!existing || match.confidence > existing.confidence) best.set(match.entryId, match);
		else if (existing.houseNumber === null && match.houseNumber !== null) {
			best.set(match.entryId, { ...existing, ...pickHouseNumber(match) });
		}
	}

	return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

function pickHouseNumber(
	match: PlaceMatch
): Pick<PlaceMatch, 'houseNumber' | 'houseNumberSuffix' | 'houseNumberConfidence'> {
	return {
		houseNumber: match.houseNumber,
		houseNumberSuffix: match.houseNumberSuffix,
		houseNumberConfidence: match.houseNumberConfidence
	};
}

/** Everything found in one image path. */
export interface PathMatchResult {
	matches: PlaceMatch[];
	/** The most trustworthy match, or null when nothing cleared the threshold. */
	best: PlaceMatch | null;
	/** The best match that is actually a street, which is what a map pin needs. */
	bestStreet: PlaceMatch | null;
	corners: CornerMatch[];
	topicalOnly: boolean;
}

/**
 * Matches a full repository-relative image path: its folder chain and its filename.
 *
 * The filename is trusted above the folder, because a folder groups a subject while the
 * filename describes the individual photograph.
 */
export function matchImagePath(
	relativePath: string,
	index: GazetteerIndex,
	options: { districtHint?: District } = {}
): PathMatchResult {
	const { folderSegments, topicalOnly } = splitPathContext(relativePath);
	const filename = relativePath.split('/').pop() ?? '';
	const parts = splitFilename(filename);

	const matches: PlaceMatch[] = [];

	for (const [i, folder] of folderSegments.entries()) {
		matches.push(
			...matchPlacesInText(folder, index, {
				source: 'folder',
				segmentIndex: i,
				districtHint: options.districtHint,
				guardContext: relativePath
			})
		);
	}

	for (const segment of parts.placeSegments) {
		matches.push(
			...matchPlacesInText(segment.text, index, {
				source: 'filename',
				segmentIndex: segment.index,
				districtHint: options.districtHint,
				guardContext: relativePath
			})
		);
	}

	const deduped = dedupeById(matches);
	const streets = deduped.filter((match) => index.byId.get(match.entryId)?.isStreet === true);

	return {
		matches: deduped,
		best: deduped[0] ?? null,
		bestStreet: streets[0] ?? null,
		corners: findCorners(
			parts.placeSegments.map((s) => s.text),
			index
		),
		topicalOnly
	};
}

/**
 * Two streets joined by a bare hyphen name a corner, as in
 * "Chr. Pallemansstraat-Heidestraat". The separator rule deliberately leaves those
 * intact, so they are recognised here rather than split apart earlier.
 */
export function findCorners(segments: string[], index: GazetteerIndex): CornerMatch[] {
	const corners: CornerMatch[] = [];

	for (const segment of segments) {
		const sides = segment.split(/(?<=\S)-(?=\S)/).map((side) => side.trim());
		if (sides.length !== 2) continue;

		const [left, right] = sides.map((side) =>
			matchPlacesInText(side, index, { source: 'filename', guardContext: segment })
		);

		const leftStreet = left.find((m) => index.byId.get(m.entryId)?.isStreet);
		const rightStreet = right.find((m) => index.byId.get(m.entryId)?.isStreet);

		if (leftStreet && rightStreet && leftStreet.entryId !== rightStreet.entryId) {
			corners.push({
				aId: leftStreet.entryId,
				bId: rightStreet.entryId,
				text: segment,
				confidence: Math.min(leftStreet.confidence, rightStreet.confidence)
			});
		}
	}

	return corners;
}
