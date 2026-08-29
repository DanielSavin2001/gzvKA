/**
 * Extracts street-name candidates from `varia-text/plan Kapellen.pdf`.
 *
 * That file is not a scan: it is a vector map whose street labels are live text with
 * position matrices, so the names can be recovered exactly rather than guessed at by OCR.
 * The gazetteer currently knows the streets the photo archive happens to mention, which is
 * a fraction of the municipality; this map names the rest.
 *
 * What this script deliberately does NOT do is write to the gazetteer. Labels on a street
 * map follow the curve of the road, so many are laid out one glyph at a time and have to
 * be reassembled by proximity - a process that produces both clean names and obvious
 * nonsense. Everything here is therefore written to a review file for a human to confirm,
 * with the ones that needed reassembly marked as such. A street name is a fact about
 * Kapellen; it does not enter the archive on a script's say-so.
 *
 * The label positions are PDF page units, not WGS84, and are emitted only so a reviewer
 * can find a label on the page. They are NOT coordinates and must never be treated as any.
 *
 * Usage, from the `functions/` directory:
 *
 *   npm run map:labels
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import type { Gazetteer } from '../../sharedModels/gazetteer';
import { normalizePlace, streetSuffixFamily } from '../src/gazetteer/normalize';

function findRepoRoot(startDirectory: string): string {
	let current = startDirectory;
	for (;;) {
		if (
			fs.existsSync(path.join(current, 'firebase.json')) &&
			fs.existsSync(path.join(current, 'sharedModels'))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) throw new Error('Could not find the repository root.');
		current = parent;
	}
}

const REPO_ROOT = findRepoRoot(__dirname);
const PDF_FILE = path.join(REPO_ROOT, 'varia-text', 'plan Kapellen.pdf');
const GAZETTEER_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');
const OUTPUT_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'map-label-candidates.json');

/** One text-showing operation, with where it was drawn. */
interface TextRun {
	text: string;
	/** Page-space origin, in PDF units. Not a geographic coordinate. */
	x: number;
	y: number;
	/** Unit vector along the text baseline, used to tell one label from its neighbour. */
	dirX: number;
	dirY: number;
	/** Approximate glyph size, from the text matrix scale. */
	scale: number;
	streamIndex: number;
	opIndex: number;
}

/** A reassembled label. */
interface LabelCandidate {
	name: string;
	/** How many text-showing operations were joined to produce it. */
	runCount: number;
	/** True when reassembly was involved, so the name is not certain. */
	needsReview: boolean;
	x: number;
	y: number;
	/** Already present in the gazetteer, by name or alias. */
	knownToGazetteer: boolean;
	/** Ends in a recognised Dutch street suffix. */
	streetShaped: boolean;
}

/** Inflates every Flate-compressed content stream in the file. */
function inflateContentStreams(pdf: Buffer): Buffer[] {
	const streams: Buffer[] = [];
	const marker = Buffer.from('stream');
	const endMarker = Buffer.from('endstream');

	let cursor = 0;
	for (;;) {
		const start = pdf.indexOf(marker, cursor);
		if (start === -1) break;

		const end = pdf.indexOf(endMarker, start);
		if (end === -1) break;

		// Skip the EOL that must follow the `stream` keyword.
		let dataStart = start + marker.length;
		if (pdf[dataStart] === 0x0d) dataStart += 1;
		if (pdf[dataStart] === 0x0a) dataStart += 1;

		try {
			streams.push(zlib.inflateSync(pdf.subarray(dataStart, end)));
		} catch {
			// Not Flate-compressed, or not a content stream. Both are expected here.
		}

		cursor = end + endMarker.length;
	}

	return streams;
}

/** Unescapes a PDF literal string. */
function decodePdfString(raw: string): string {
	return raw
		.replace(/\\([nrtbf()\\])/g, (_, ch) => {
			const escapes: Record<string, string> = {
				n: '\n',
				r: '\r',
				t: '\t',
				b: '\b',
				f: '\f',
				'(': '(',
				')': ')',
				'\\': '\\'
			};
			return escapes[ch] ?? ch;
		})
		.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)));
}

/** Pulls the literal pieces out of a `Tj` operand or a `TJ` array, ignoring kerning. */
function extractStringOperand(operand: string): string {
	const pieces = operand.match(/\((?:[^()\\]|\\.)*\)/g);
	if (!pieces) return '';

	return pieces.map((piece) => decodePdfString(piece.slice(1, -1))).join('');
}

/** Reads every positioned text run out of one content stream. */
function readTextRuns(stream: Buffer, streamIndex: number): TextRun[] {
	const content = stream.toString('latin1');
	const runs: TextRun[] = [];

	// a b c d e f Tm  -- the text matrix: (a,b) is the baseline direction, (e,f) the origin.
	const TOKEN =
		/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+TD?|((?:\[[^\]]*\])|(?:\((?:[^()\\]|\\.)*\)))\s*(TJ|Tj)/g;

	let a = 1;
	let b = 0;
	let x = 0;
	let y = 0;
	let opIndex = 0;

	for (const match of content.matchAll(TOKEN)) {
		if (match[1] !== undefined) {
			a = Number.parseFloat(match[1]);
			b = Number.parseFloat(match[2]);
			x = Number.parseFloat(match[5]);
			y = Number.parseFloat(match[6]);
			continue;
		}

		if (match[7] !== undefined) {
			// A relative move along the current baseline.
			const dx = Number.parseFloat(match[7]);
			const dy = Number.parseFloat(match[8]);
			x += a * dx - b * dy;
			y += b * dx + a * dy;
			continue;
		}

		const text = extractStringOperand(match[9]);
		if (text.trim() === '') {
			opIndex += 1;
			continue;
		}

		const scale = Math.hypot(a, b) || 1;

		runs.push({
			text,
			x,
			y,
			dirX: a / scale,
			dirY: b / scale,
			scale,
			streamIndex,
			opIndex
		});

		opIndex += 1;
	}

	return runs;
}

/**
 * Joins runs that plainly belong to the same label.
 *
 * Two runs are joined when they were drawn one after the other, along the same baseline
 * direction, and close enough together relative to the glyph size. That is what turns the
 * per-glyph "P" "A" "PE" "N" sequence back into one word. It is a heuristic, so anything
 * built from more than one run is marked for review rather than trusted.
 */
function assembleLabels(
	runs: TextRun[]
): Array<{ text: string; runCount: number; x: number; y: number }> {
	const labels: Array<{ text: string; runCount: number; x: number; y: number }> = [];

	let current: TextRun[] = [];

	const flush = (): void => {
		if (current.length === 0) return;

		const text = current
			.map((run) => run.text)
			.join('')
			.replace(/\s+/g, ' ')
			.trim();

		if (text !== '') {
			labels.push({ text, runCount: current.length, x: current[0].x, y: current[0].y });
		}
		current = [];
	};

	for (const run of runs) {
		if (current.length === 0) {
			current = [run];
			continue;
		}

		const previous = current[current.length - 1];
		const sameStream = previous.streamIndex === run.streamIndex;
		const consecutive = run.opIndex - previous.opIndex <= 2;
		const sameDirection = previous.dirX * run.dirX + previous.dirY * run.dirY > 0.985;
		const distance = Math.hypot(run.x - previous.x, run.y - previous.y);
		const near = distance < previous.scale * 6;

		if (sameStream && consecutive && sameDirection && near) current.push(run);
		else {
			flush();
			current = [run];
		}
	}

	flush();
	return labels;
}

function main(): void {
	if (!fs.existsSync(PDF_FILE)) {
		console.error(`Not found: ${path.relative(REPO_ROOT, PDF_FILE)}`);
		process.exit(1);
	}

	const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf8')) as Gazetteer;
	const known = new Set<string>();
	for (const entry of gazetteer.entries) {
		for (const form of [entry.name, ...entry.aliases]) known.add(normalizePlace(form));
	}

	const streams = inflateContentStreams(fs.readFileSync(PDF_FILE));
	const runs = streams.flatMap((stream, i) => readTextRuns(stream, i));
	const assembled = assembleLabels(runs);

	const byName = new Map<string, LabelCandidate>();

	for (const label of assembled) {
		const name = label.text.replace(/\s+/g, ' ').trim();
		if (name.length < 3) continue;
		// Labels are set in capitals on this map; anything else is a legend or a note.
		if (!/[A-Z]{3}/.test(name)) continue;

		const normalized = normalizePlace(name);
		if (normalized === '') continue;

		const existing = byName.get(normalized);
		// Prefer the reading that needed the least reassembly.
		if (existing && existing.runCount <= label.runCount) continue;

		byName.set(normalized, {
			name,
			runCount: label.runCount,
			needsReview: label.runCount > 1,
			x: Math.round(label.x * 10) / 10,
			y: Math.round(label.y * 10) / 10,
			knownToGazetteer: known.has(normalized),
			streetShaped: streetSuffixFamily(normalized) !== null
		});
	}

	const candidates = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
	const streetShaped = candidates.filter((c) => c.streetShaped);
	const newStreets = streetShaped.filter((c) => !c.knownToGazetteer);
	const clean = newStreets.filter((c) => !c.needsReview);

	const output = {
		source: 'varia-text/plan Kapellen.pdf',
		note:
			'Candidates only. Positions are PDF page units, NOT coordinates. Names marked ' +
			'needsReview were reassembled from several text runs and may be wrong. Nothing ' +
			'here enters the gazetteer without a human confirming it.',
		counts: {
			textRuns: runs.length,
			labels: candidates.length,
			streetShaped: streetShaped.length,
			notYetInGazetteer: newStreets.length,
			readyToReview: clean.length
		},
		candidates
	};

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, '\t')}\n`, 'utf8');

	console.log('Street-name candidates from the Kapellen town map');
	console.log('='.repeat(62));
	console.log(`Text runs read                    ${runs.length}`);
	console.log(`Distinct labels assembled         ${candidates.length}`);
	console.log(`Street-shaped labels              ${streetShaped.length}`);
	console.log(`Not yet in the gazetteer          ${newStreets.length}`);
	console.log(`  of which need no reassembly     ${clean.length}  (review these first)`);
	console.log('');
	console.log('A sample of street names the archive does not yet know:');
	for (const candidate of clean.slice(0, 30)) console.log(`  ${candidate.name}`);
	console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

main();
