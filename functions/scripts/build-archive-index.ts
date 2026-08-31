/**
 * Builds `static/data/archive-index.json`: everything the website needs to browse and
 * search all 2948 photographs, with no backend at all.
 *
 * This is the file that makes the archive work on a fresh clone. It is generated from the
 * images in the repository by the same matcher the enrichment pipeline uses, and it is
 * committed, so `npm run start` shows the real archive with nothing configured - no
 * Firebase project, no credentials, no network.
 *
 * Firestore stays on the WRITE path only: a resident uploading a photograph, or correcting
 * one. Reading the archive does not need it, and putting it there is what made the site
 * fail to render whenever the backend was unreachable.
 *
 * Usage, from the repository root:
 *
 *   npm run archive:index
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer } from '../../sharedModels/gazetteer';
import { familyOfPlace } from '../../sharedModels/place-family';
import { normalizeText, slugify } from '../../sharedModels/text';
import { buildIndex, matchImagePath } from '../src/gazetteer/match';
import { yearFromFilename } from '../src/utils/photo-year';
import type { FilenameParts } from '../src/gazetteer/segment';
import { looksLikePersonName, splitFilename, splitPathContext } from '../src/gazetteer/segment';

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
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const GAZETTEER_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');
const CORRECTIONS_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'photo-corrections.json');
const OUTPUT_FILE = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');

/**
 * The header menus, as their own small file.
 *
 * The menus need about forty place names and counts. They used to get them by downloading
 * the whole 1.1 MB index on every cold load - a megabyte to draw a dropdown, before the
 * page it sits on could be considered loaded. This is the same answer in a couple of
 * kilobytes.
 *
 * Generated here rather than assembled in the browser so that it cannot disagree with the
 * index it came from.
 */
const MENU_FILE = path.join(REPO_ROOT, 'static', 'data', 'menu.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** One photograph, as the website needs it. Keys are short because there are 2948 of them. */
interface IndexedPhoto {
	/** Stable id derived from the path, so a link keeps working across rebuilds. */
	id: string;
	/** Path under the corpus directory, used to build the image URL. */
	p: string;
	/** Display title: the descriptive part of the filename, without donor or date. */
	t: string;
	/** Subject folder, e.g. "Kasteel Op den Wal". */
	s: string;
	/** Gazetteer ids matched to this photograph, best first. */
	st: string[];
	/** House number, when the archive recorded one. */
	hn?: number;
	/** Donor, from the filename. */
	d?: string;
	/** Year the photograph was taken, when known. */
	y?: string;
	/** Date the archive received it, when known. */
	a?: string;
	/** True for the prize-draw subtree, which is browsed by event rather than by place. */
	ev?: boolean;
	/**
	 * Words a volunteer typed into the path that no other field carries: a sub-folder, a
	 * caption the title trimmer dropped, a donor the broken date convention never separated
	 * out. Searched, never shown.
	 *
	 * Only the residue is stored, and the acquisition date and the file extension are left
	 * out on purpose. Indexing the whole path instead looks tempting and is wrong: nearly
	 * every filename ends in the date the archive received the photograph, so searching
	 * "2015" would answer with the 602 photographs donated that year rather than the 36
	 * taken in it, and "jpg" would match every photograph in the archive.
	 */
	k?: string;
}

/** A place, with how many photographs reference it. */
interface IndexedPlace {
	id: string;
	name: string;
	kind: string;
	district: string;
	isStreet: boolean;
	/** Number of photographs matched to this place. */
	count: number;
}

/**
 * A person's correction to what the filename said about one photograph.
 *
 * Everything else in this index is derived by a machine from a filename, which is right
 * about four photographs in five and quietly wrong about the rest. This is the one place a
 * human overrules it, and the only place a claim about a photograph may be typed by hand.
 * Each carries who made it, so a doubtful one can be asked about rather than guessed at.
 */
interface PhotoCorrection {
	/** Replaces the matched places outright, rather than adding to them. */
	places?: string[];
	houseNumber?: number;
	year?: string;
	title?: string;
	note?: string;
	by?: string;
	on?: string;
}

function readCorrections(): Record<string, PhotoCorrection> {
	if (!fs.existsSync(CORRECTIONS_FILE)) return {};

	const parsed = JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf8')) as {
		corrections?: Record<string, PhotoCorrection>;
	};
	return parsed.corrections ?? {};
}

function listCorpusFiles(directory: string): string[] {
	const found: string[] = [];

	const walk = (current: string): void => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) walk(absolute);
			else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				found.push(path.relative(CORPUS_DIR, absolute).split(path.sep).join('/'));
			}
		}
	};

	walk(directory);
	return found.sort();
}

/**
 * The part of a filename worth showing to a visitor: the descriptive segments, with the
 * donor and the date removed. "Dorpsstraat 15 - Swatti Alix - zd" reads as "Dorpsstraat 15".
 *
 * `donors` is every name the corpus itself identifies as a contributor, normalized. It is
 * what stops the trimmer eating captions: "Garage Meyvis", "Hotel-Cafe De Zwaan" and
 * "Familie Bourlet-Luyckx" are all two capitalised words, which is also what a person's
 * name looks like - but only one of those is somebody who donated a photograph. A trailing
 * name nobody in this archive ever donated under is a caption, and the caption is often the
 * only thing the photograph says about itself.
 */
function displayTitle(fileName: string, folderName: string, donors: Set<string>): string {
	const parts = splitFilename(fileName);
	const segments = parts.placeSegments.map((segment) => segment.text.trim()).filter(Boolean);

	// Where the date convention broke down the donor was never separated out, so a title
	// can still end in "- Dirk Pelgrims - 16.01". Drop trailing segments that are a person
	// or a partial date, but never the first: that one is the description itself.
	while (segments.length > 1) {
		// The place segments keep their duplicate marker, so "16.01 (1)" has to have the
		// "(1)" taken off before it can be recognised as the partial date it is.
		const last = segments[segments.length - 1].replace(/(?:_\d{1,3}|\s*\(\d{1,3}\))$/, '').trim();
		const isPartialDate = /^\d{1,2}[.\-/]\d{1,2}$/.test(last);
		const isBareIndex = /^\d{1,3}$/.test(last) && segments.length > 2;
		// The bare trailing index goes before the lookup, because `splitFilename` records a
		// donor without it: "Dirk Pelgrims 2" is stored as "Dirk Pelgrims", and without this
		// the donor's name would survive into the title as though it were a caption.
		const withoutIndex = last.replace(/\s+\d{1,2}$/, '');
		const isDonor = looksLikePersonName(last) && donors.has(normalizeText(withoutIndex));

		if (isPartialDate || isBareIndex || isDonor) segments.pop();
		else break;
	}

	const described = segments.join(' - ');
	if (described !== '') return described;

	// Some filenames are nothing but a donor and a date; fall back to the subject.
	return folderName;
}

/**
 * The words of a path that the photograph's own fields do not already carry.
 *
 * The site searches title, subject, place names, donor, year and house number. Everything
 * else a volunteer typed - a sub-folder like "Fietszoektocht 2014", a caption the trimmer
 * dropped, a donor whose filename broke the date convention - is only in the path, and
 * without this nobody can find it by typing it back. Measured on this corpus: 586
 * photographs hold at least one such word.
 */
function extraKeywords(
	relativePath: string,
	parts: FilenameParts,
	photo: IndexedPhoto,
	gazetteer: Gazetteer,
	placeIds: string[]
): string {
	// The place segments are the filename minus the donor and the date, which is exactly
	// what should be searchable; the folder chain adds the sub-folders `s` does not carry.
	const source = [
		...relativePath.split('/').slice(0, -1),
		...parts.placeSegments.map((segment) => segment.text)
	].join(' ');

	const placeNames = placeIds
		.map((id) => gazetteer.entries.find((entry) => entry.id === id)?.name ?? '')
		.join(' ');

	const known = new Set(
		normalizeText(
			[photo.t, photo.s, placeNames, photo.d ?? '', photo.y ?? '', photo.hn ?? ''].join(' ')
		).split(' ')
	);

	// Numbers are dropped whole. A year worth searching is already in `y` and a house number
	// in `hn`; what is left in a path is the wreckage of the date convention - "16 04" from
	// "16.04", a bare duplicate index - and indexing it answers "2014" with the photographs
	// donated that year.
	const extra = normalizeText(source)
		.split(' ')
		.filter((word) => word.length > 1 && !/^\d+$/.test(word) && !known.has(word));

	return [...new Set(extra)].join(' ');
}

/** A short, stable id for a photograph, unique within the corpus. */
function photoId(relativePath: string, taken: Set<string>): string {
	const base = slugify(relativePath.replace(/\.[^.]+$/, '')).slice(0, 80) || 'foto';

	let candidate = base;
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base}-${suffix}`;
		suffix += 1;
	}

	taken.add(candidate);
	return candidate;
}

function main(): void {
	const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf8')) as Gazetteer;
	const index = buildIndex(gazetteer);
	const files = listCorpusFiles(CORPUS_DIR);
	const corrections = readCorrections();
	const knownPlaceIds = new Set(gazetteer.entries.map((entry) => entry.id));

	// A correction naming a place that does not exist would silently do nothing, which is
	// the worst outcome: someone recorded a fact and the archive quietly dropped it.
	for (const [photoId, correction] of Object.entries(corrections)) {
		for (const placeId of correction.places ?? []) {
			if (!knownPlaceIds.has(placeId)) {
				throw new Error(
					`photo-corrections.json: "${photoId}" names place "${placeId}", which is not in the gazetteer.`
				);
			}
		}
	}

	// Everybody the corpus identifies as a donor, gathered before any title is built: the
	// title trimmer needs to know whether a trailing name is a person who gave photographs
	// to this archive or the name of a shop on a street corner, and it can only know that
	// by looking at the whole corpus first.
	const donors = new Set<string>();
	for (const relativePath of files) {
		const contributor = splitFilename(relativePath.split('/').pop() ?? '').contributor;
		if (contributor) donors.add(normalizeText(contributor));
	}

	const applied = new Set<string>();
	const takenIds = new Set<string>();
	const photos: IndexedPhoto[] = [];
	const streetCounts = new Map<string, number>();

	for (const relativePath of files) {
		const fileName = relativePath.split('/').pop() ?? '';
		const folderName = relativePath.split('/')[0] ?? '';

		// The matcher wants a repository-relative path so its folder handling lines up.
		const result = matchImagePath(`src/lib/images/history-images/${relativePath}`, index);
		const parts = splitFilename(fileName);
		const context = splitPathContext(`src/lib/images/history-images/${relativePath}`);

		const id = photoId(relativePath, takenIds);
		const correction = corrections[id];
		if (correction) applied.add(id);

		const placeIds = correction?.places ?? result.matches.map((match) => match.entryId);

		// Count every place the photograph is matched to, not only its best street.
		// Counting the best street alone left every castle, park and neighbourhood at zero
		// while their pages still listed photographs - the count and the page disagreed.
		for (const placeId of placeIds) {
			streetCounts.set(placeId, (streetCounts.get(placeId) ?? 0) + 1);
		}

		const photo: IndexedPhoto = {
			id,
			p: relativePath,
			t: correction?.title ?? displayTitle(fileName, folderName, donors),
			s: folderName,
			st: placeIds
		};

		const houseNumber = correction?.houseNumber ?? result.bestStreet?.houseNumber;
		if (houseNumber != null) photo.hn = houseNumber;
		if (parts.contributor) photo.d = parts.contributor;
		if (parts.dateOfAcquisition) photo.a = parts.dateOfAcquisition;
		if (context.topicalOnly) photo.ev = true;

		const named = yearFromFilename(fileName);
		if (correction?.year) photo.y = correction.year;
		else if (named && !parts.dateOfAcquisition?.includes(named)) {
			photo.y = named;
		}

		// Last, because it subtracts everything the other fields already carry.
		const keywords = extraKeywords(relativePath, parts, photo, gazetteer, placeIds);
		if (keywords) photo.k = keywords;

		photos.push(photo);
	}

	// Named `placeCounts` now that it counts every kind of place, not only streets.
	const placeCounts = streetCounts;

	const places: IndexedPlace[] = gazetteer.entries
		.map((entry) => ({
			id: entry.id,
			name: entry.name,
			kind: entry.kind,
			district: entry.district,
			isStreet: entry.isStreet,
			count: placeCounts.get(entry.id) ?? 0
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

	const subjects = [...new Set(photos.map((photo) => photo.s))].sort().map((name) => ({
		slug: slugify(name),
		name,
		count: photos.filter((photo) => photo.s === name).length
	}));

	const output = {
		// Fixed rather than "now", so a rebuild that changes nothing produces an identical
		// file and does not show up as a spurious diff.
		version: 1,
		imageCount: photos.length,
		/** Where the image files live, relative to the site root. */
		imageBase: '/foto',
		places,
		subjects,
		photos
	};

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output)}\n`, 'utf8');

	// The menus: the biggest few of each family, which is all the header ever shows. The
	// desktop dropdowns and the phone menu both read this, and `familyOfPlace` is the same
	// rule the /straten, /kastelen and /wijken pages classify by - shared rather than
	// copied, so a place cannot be under one heading here and another there.
	const biggest = (family: string, limit: number) =>
		places
			.filter((place) => place.count > 0 && familyOfPlace(place) === family)
			.slice(0, limit)
			.map(({ id, name, count }) => ({ id, name, count }));

	const menu = {
		version: 1,
		straten: biggest('straten', 10),
		kastelen: biggest('kastelen', 10),
		// Districts and parks, which is what the desktop menu calls "Wijken".
		wijken: biggest('wijken', 10)
	};

	fs.writeFileSync(MENU_FILE, `${JSON.stringify(menu)}\n`, 'utf8');

	const bytes = fs.statSync(OUTPUT_FILE).size;
	const withStreet = photos.filter((photo) =>
		photo.st.some((id) => places.find((place) => place.id === id)?.isStreet)
	).length;

	console.log('Archive index');
	console.log('='.repeat(52));
	console.log(`Photographs indexed     ${photos.length}`);
	console.log(
		`Places                  ${places.length} (${places.filter((p) => p.isStreet).length} streets)`
	);
	console.log(`Subjects                ${subjects.length}`);
	console.log(`With a street           ${withStreet}`);
	console.log(`With a donor            ${photos.filter((p) => p.d).length}`);
	console.log(`Hand corrections        ${applied.size} applied`);

	// A correction whose photograph id no longer exists does nothing at all, which is worse
	// than an error: someone recorded a fact about the archive and the archive dropped it.
	const stale = Object.keys(corrections).filter((id) => !applied.has(id));
	if (stale.length > 0) {
		throw new Error(
			`photo-corrections.json names ${stale.length} photograph(s) that are not in the corpus:\n` +
				stale.map((id) => `  ${id}`).join('\n')
		);
	}
	console.log(`Index size              ${(bytes / 1024).toFixed(0)} KB raw`);
	console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);

	// Sanity: normalizeText is what the browser will use to search this, so make sure the
	// titles survive it rather than collapsing to nothing.
	const empty = photos.filter((photo) => normalizeText(photo.t) === '').length;
	if (empty > 0)
		console.log(`\nWARNING: ${empty} photographs have a title that normalizes to nothing.`);
}

main();
