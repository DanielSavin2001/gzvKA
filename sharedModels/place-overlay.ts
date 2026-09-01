/**
 * What a curator may say about where a place is, and how sure they are.
 *
 * `place-record.ts` handles a place's identity - that it exists, what it is called, what it
 * sits under. This handles the other half: the point, the doubt around the point, and the
 * shape on the ground.
 *
 * Both halves used to be build-time only, and the second one much more painfully so. The
 * 3,644 photographs filed under castles, hamlets and demolished cafes are drawn from
 * `place-approximations.json`, which is written by hand and shipped; correcting a single
 * radius meant editing a JSON file, running the indexer and deploying. So the research on
 * this archive's least certain places - exactly the places most likely to be wrong, and the
 * ones a local reader can actually correct - was the hardest thing in it to change.
 *
 * ## Why the curator's fields are a subset
 *
 * An `Approximation` carries more than a person decides. `priority` is the photograph count,
 * recounted every build; `kind` here is the research vocabulary ('plaats', 'persoon',
 * 'hernoemde_straat') rather than the gazetteer's, and `aliasOf` is a fact about the corpus.
 * A curator sets the judgement - where, how sure, why unsure - and the merge keeps the rest
 * from whatever the build knows, so an edit never silently resets a count.
 *
 * ## Why the geometry is a line and not a shape
 *
 * `StreetGeometry.lines` is what both maps already draw, as a MultiLineString, and the
 * gazetteer's `manualGeometry` slot was designed for exactly this and has been null on all
 * 131 entries since it was added. Drawing a closed ring is drawing a line whose last point
 * is its first, so an estate boundary needs no second shape and no second code path.
 */

import type { Approximation, Candidate, Display } from './approximation';
import type { StreetGeometry } from './locate';

/** The grades the research uses. A geocoded, B street-certain, C inferred, ? not found. */
export const GRADES = ['A', 'B', 'C', '?'] as const;

/** Every way a place can be drawn, in the order the desk offers them. */
export const DISPLAYS: Display[] = [
	'punt',
	'punt_met_twijfel',
	'benadering',
	'kandidaten',
	'niet_geplaatst'
];

/** A drawn line, as [lng, lat] pairs - the order MapLibre and GeoJSON both use. */
export type Line = [number, number][];

/** The half of an `Approximation` a person decides. */
export interface CuratorApproximation {
	lat?: number;
	lng?: number;
	grade: string;
	display: Display;
	/** Metres the point could be out by. Only drawn when `display` is `benadering`. */
	radius?: number;
	note?: string;
	doubt?: string;
	research?: string;
	candidates?: Candidate[];
	correctable?: boolean;
	outsideKapellen?: boolean;
}

/** A shape a curator drew, overlaying whatever the street register says. */
export interface CuratorGeometry {
	lines: Line[];
}

/** Raised when something a curator drew or typed cannot be stored. Shown to them verbatim. */
export class PlaceOverlayError extends Error {}

/**
 * Sanity ceilings, not opinions about cartography.
 *
 * The radius one is the load-bearing check: this drives a circle drawn as real geometry in
 * metres, so a fat-fingered 50000 does not look wrong on the way in - it produces a ring
 * covering the province, which is how a reader learns to ignore the circles entirely.
 */
const MAX_RADIUS_METRES = 5_000;
const MAX_TEXT = 2_000;
const MAX_CANDIDATES = 8;
const MAX_LINES = 20;
const MAX_POINTS_PER_LINE = 500;

/** Kapellen and a generous margin. Same box the pin picker rejects a mis-click against. */
const BOUNDS = { minLat: 51.15, maxLat: 51.5, minLng: 4.2, maxLng: 4.7 };

function readNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (typeof value !== 'string' || value.trim() === '') return undefined;

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function readText(value: unknown, field: string): string | undefined {
	if (typeof value !== 'string') return undefined;

	const text = value.trim();
	if (!text) return undefined;
	if (text.length > MAX_TEXT) throw new PlaceOverlayError(`${field} is te lang.`);
	return text;
}

/** True when a point is somewhere a place in this archive could plausibly be. */
export function withinBounds(lat: number, lng: number): boolean {
	return (
		lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng
	);
}

function readPoint(input: Record<string, unknown>): { lat?: number; lng?: number } {
	const lat = readNumber(input.lat);
	const lng = readNumber(input.lng);

	// One coordinate without the other is not half a point, it is a bug on the way in. The
	// one function that must never hand back a position that is not one is `locate`, and it
	// reads exactly these two fields.
	if (lat == null && lng == null) return {};
	if (lat == null || lng == null)
		throw new PlaceOverlayError('Geef zowel een breedte- als een lengtegraad.');
	if (!withinBounds(lat, lng))
		throw new PlaceOverlayError('Dat punt ligt niet in de buurt van Kapellen.');

	return { lat, lng };
}

function readCandidates(value: unknown): Candidate[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	if (value.length > MAX_CANDIDATES) throw new PlaceOverlayError('Te veel mogelijke plaatsen.');

	const candidates: Candidate[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;

		const row = entry as Record<string, unknown>;
		const { lat, lng } = readPoint(row);
		if (lat == null || lng == null) continue;

		// The label is the whole point of a candidate. Two pins a reader cannot tell apart are
		// worse than one pin with a doubt written under it: they ask a question and give no
		// means of answering it.
		const label = readText(row.label, 'De toelichting');
		if (!label) throw new PlaceOverlayError('Zeg bij elke mogelijke plaats waarop ze berust.');

		candidates.push({ lat, lng, label });
	}

	return candidates.length > 0 ? candidates : undefined;
}

/** Reads a save request into a stored judgement, or throws with a sentence for the curator. */
export function readCuratorApproximation(value: unknown): CuratorApproximation | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const input = value as Record<string, unknown>;
	const display = (typeof input.display === 'string' ? input.display : 'punt') as Display;
	if (!DISPLAYS.includes(display)) throw new PlaceOverlayError('Onbekende manier van tonen.');

	const grade = typeof input.grade === 'string' ? input.grade : '?';
	if (!GRADES.includes(grade as (typeof GRADES)[number])) {
		throw new PlaceOverlayError('Onbekende zekerheid.');
	}

	const { lat, lng } = readPoint(input);
	const radius = readNumber(input.radius);
	if (radius != null && (radius < 0 || radius > MAX_RADIUS_METRES)) {
		throw new PlaceOverlayError(`Een straal van meer dan ${MAX_RADIUS_METRES} m zegt niets meer.`);
	}

	const candidates = readCandidates(input.candidates);

	// The three ways a record can promise something it does not deliver. Each of these has
	// happened in the shipped data: 74 places once said "bij benadering" in the caption while
	// carrying no radius to draw, and the caption was written off `radius` rather than off
	// what the map does. Catching it at the door is cheaper than auditing it later.
	if (display === 'benadering' && !(radius && radius > 0)) {
		throw new PlaceOverlayError('Kies een straal, of toon de plaats als punt.');
	}
	if (display === 'kandidaten' && !candidates) {
		throw new PlaceOverlayError('Geef minstens één mogelijke plaats, of kies een andere weergave.');
	}
	if (display !== 'kandidaten' && display !== 'niet_geplaatst' && (lat == null || lng == null)) {
		throw new PlaceOverlayError('Zet de plaats op de kaart, of kies "niet geplaatst".');
	}

	const approximation: CuratorApproximation = { grade, display };

	if (lat != null && lng != null) {
		approximation.lat = lat;
		approximation.lng = lng;
	}
	// A radius only travels with a circle, so a display change cannot leave a stale one behind
	// to be re-drawn the next time somebody switches back.
	if (display === 'benadering' && radius) approximation.radius = radius;
	if (candidates) approximation.candidates = candidates;

	const note = readText(input.note, 'De notitie');
	if (note) approximation.note = note;

	const doubt = readText(input.doubt, 'De twijfel');
	if (doubt) approximation.doubt = doubt;

	const research = readText(input.research, 'Het onderzoek');
	if (research) approximation.research = research;

	if (input.correctable === true) approximation.correctable = true;
	if (input.outsideKapellen === true) approximation.outsideKapellen = true;

	return approximation;
}

/** Reads drawn lines, dropping anything too short to be a line. */
export function readCuratorGeometry(value: unknown): CuratorGeometry | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const input = value as Record<string, unknown>;
	if (!Array.isArray(input.lines)) return undefined;
	if (input.lines.length > MAX_LINES) throw new PlaceOverlayError('Te veel lijnen.');

	const lines: Line[] = [];
	for (const raw of input.lines) {
		if (!Array.isArray(raw)) continue;
		if (raw.length > MAX_POINTS_PER_LINE)
			throw new PlaceOverlayError('Die lijn heeft te veel punten.');

		const line: Line = [];
		for (const point of raw) {
			if (!Array.isArray(point) || point.length < 2) continue;

			const lng = readNumber(point[0]);
			const lat = readNumber(point[1]);
			if (lat == null || lng == null) continue;
			if (!withinBounds(lat, lng)) {
				throw new PlaceOverlayError('Een van de punten ligt niet in de buurt van Kapellen.');
			}

			line.push([lng, lat]);
		}

		// A single click is not a line. Dropping it rather than refusing the save is
		// deliberate: a stray click while drawing should not lose the shape around it.
		if (line.length >= 2) lines.push(line);
	}

	return lines.length > 0 ? { lines } : undefined;
}

const EARTH_RADIUS_METRES = 6378137;

/** Metres between two [lng, lat] points, near enough at this scale. */
function metresBetween(a: [number, number], b: [number, number]): number {
	const toRadians = Math.PI / 180;
	const meanLat = ((a[1] + b[1]) / 2) * toRadians;
	const deltaLat = (b[1] - a[1]) * toRadians;
	const deltaLng = (b[0] - a[0]) * toRadians * Math.cos(meanLat);

	return Math.hypot(deltaLat, deltaLng) * EARTH_RADIUS_METRES;
}

/** How long the drawn shape is, in metres, summed over every line. */
export function lengthOfLines(lines: Line[]): number {
	let total = 0;
	for (const line of lines) {
		for (let index = 1; index < line.length; index += 1) {
			total += metresBetween(line[index - 1], line[index]);
		}
	}

	return Math.round(total);
}

/**
 * A representative point for a drawn shape: halfway along its longest line.
 *
 * Not the average of the points, which is the obvious choice and the wrong one - a line
 * drawn with twenty clicks around one bend and two down a straight is dragged into the bend.
 * Halfway by distance is where a reader would put their finger and say "there".
 */
export function centreOfLines(lines: Line[]): { lat: number; lng: number } | null {
	let longest: Line | null = null;
	let longestLength = -1;

	for (const line of lines) {
		if (line.length < 2) continue;

		const length = lengthOfLines([line]);
		if (length > longestLength) {
			longest = line;
			longestLength = length;
		}
	}

	if (!longest) {
		const only = lines.find((line) => line.length > 0);
		return only ? { lat: only[0][1], lng: only[0][0] } : null;
	}

	let walked = 0;
	const half = longestLength / 2;
	for (let index = 1; index < longest.length; index += 1) {
		const from = longest[index - 1];
		const to = longest[index];
		const step = metresBetween(from, to);

		if (walked + step >= half) {
			// Zero-length step at the halfway mark: `along` would be 0/0. The point is the same
			// either way, so take the start of the step.
			const along = step === 0 ? 0 : (half - walked) / step;
			return { lat: from[1] + (to[1] - from[1]) * along, lng: from[0] + (to[0] - from[0]) * along };
		}

		walked += step;
	}

	const last = longest[longest.length - 1];
	return { lat: last[1], lng: last[0] };
}

/** The little of a record these merges read, so neither has to import the whole thing. */
export interface OverlayRecord {
	id: string;
	name: string;
	approximation?: CuratorApproximation;
	geometry?: CuratorGeometry;
}

/**
 * The researched places, with a curator's judgements laid over them.
 *
 * Everything the build knows and a person does not decide - the photograph count behind
 * `priority`, the research vocabulary in `kind`, whether the name is an alias of another -
 * is kept from the shipped record. A curator editing a radius must not silently reset a
 * count, because nothing on the page would show that it had happened.
 */
export function withApproximationRecords<T extends Approximation>(
	approximations: Record<string, T>,
	records: Record<string, OverlayRecord>
): Record<string, Approximation> {
	const merged: Record<string, Approximation> = { ...approximations };

	for (const record of Object.values(records)) {
		const judgement = record.approximation;
		if (!judgement) continue;

		const existing = merged[record.id];
		merged[record.id] = {
			id: record.id,
			name: record.name,
			kind: existing?.kind ?? 'plaats',
			priority: existing?.priority ?? 0,
			...(existing?.aliasOf ? { aliasOf: existing.aliasOf } : {}),
			grade: judgement.grade,
			display: judgement.display,
			note: judgement.note ?? '',
			correctable: judgement.correctable ?? false,
			outsideKapellen: judgement.outsideKapellen ?? false,
			...(judgement.lat != null && judgement.lng != null
				? { lat: judgement.lat, lng: judgement.lng }
				: {}),
			...(judgement.radius ? { radius: judgement.radius } : {}),
			...(judgement.doubt ? { doubt: judgement.doubt } : {}),
			...(judgement.research ? { research: judgement.research } : {}),
			...(judgement.candidates ? { candidates: judgement.candidates } : {})
		};
	}

	return merged;
}

/**
 * The street register, with a curator's drawings laid over it.
 *
 * A drawn shape replaces the register's line for that id rather than joining it. The one
 * reason to draw over a street that is already in the register is that the register is
 * wrong about it - the road was rerouted, or the name now covers a different stretch - and
 * two lines drawn at once would show both answers with no way to tell which is meant.
 */
export function withGeometryRecords(
	geometry: Record<string, StreetGeometry>,
	records: Record<string, OverlayRecord>
): Record<string, StreetGeometry> {
	const merged: Record<string, StreetGeometry> = { ...geometry };

	for (const record of Object.values(records)) {
		const lines = record.geometry?.lines;
		if (!lines || lines.length === 0) continue;

		const centre = centreOfLines(lines);
		if (!centre) continue;

		merged[record.id] = {
			name: record.name,
			municipality: geometry[record.id]?.municipality ?? 'Kapellen',
			lat: centre.lat,
			lng: centre.lng,
			lines,
			length: lengthOfLines(lines)
		};
	}

	return merged;
}
