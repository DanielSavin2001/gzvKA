/**
 * Builds the story data the website serves: the writing from the old gzvka.be, joined to
 * the photographs it was written about.
 *
 * The photographs were only ever half the archive. The other half was the writing around
 * them - who kept the café on the corner of the Essenhout, what the Starrenhof was before
 * it was a convent, what a Thursday in the Nieuwe Wijk felt like in 1983 - and none of that
 * is recoverable from a filename. It lived on the old website, and the 101 pages of it are
 * committed in `legacy-site/` so this can be re-run and checked against the source.
 *
 * Three files come out, split by when the browser actually needs them:
 *
 *   static/data/stories.json        the list of stories and which place each belongs to,
 *                                   loaded by the pages that show "there is a story here"
 *   static/data/story-photos.json   photograph -> story, loaded only by a photo page
 *   static/data/verhalen/<slug>.json  one story's full text, loaded only when opened
 *
 * Usage, from the repository root:
 *
 *   npm run archive:index && npm run stories
 *
 * The archive index has to exist first: photograph ids are read from it rather than
 * recomputed, so the two files cannot drift apart.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { Gazetteer, PlaceMatch } from '../../sharedModels/gazetteer';
import { normalizeText } from '../../sharedModels/text';
import { buildIndex, matchPlacesInText } from '../src/gazetteer/match';
import type { StoryPart } from '../src/legacy/parse';
import { parseLegacyHtml } from '../src/legacy/parse';
import { buildPhotoLookup, resolvePhoto, unambiguousFolders } from '../src/legacy/link';

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
const LEGACY_DIR = path.join(REPO_ROOT, 'legacy-site');
const GAZETTEER_FILE = path.join(REPO_ROOT, 'functions', 'src', 'data', 'kapellen-gazetteer.json');
const ARCHIVE_INDEX = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const DATA_DIR = path.join(REPO_ROOT, 'static', 'data');
const STORY_DIR = path.join(DATA_DIR, 'verhalen');
const DOCUMENT_DIR = path.join(REPO_ROOT, 'static', 'documenten');

/**
 * A place named in a heading is only accepted well above the matcher's floor. A heading is
 * a handful of words with no sentence around it to disambiguate, so a loose match there
 * would put a story on the wrong street's page - and a story on the wrong street is worse
 * than no story at all.
 */
const MIN_HEADING_CONFIDENCE = 0.75;

/**
 * How many of a section's photographs must share a place before the section is treated as
 * being about it. One stray photograph filed under a street is not a story about it.
 */
const MIN_PHOTOS_FOR_PLACE = 3;

/**
 * Pages about the association's own prize draws and photo competitions rather than about
 * Kapellen: entry forms, routes, rules, sponsors and results. They are kept - they are part
 * of what the old site was - but they are not local history and do not belong in a list of
 * stories about the village.
 *
 * This is a curated list rather than a heuristic because the corpus is frozen at 101 files
 * and every one of them has been read. A rule guessing from the title would be less
 * accurate and much harder to check.
 */
const CONTEST_PAGES = new Set([
	'einduitslag',
	'fietszoektocht',
	'fotos-zoektocht',
	'fotowedstrijd',
	'nieuwjaarsdrink-2015',
	'paaswedstrijd-04-04-2015',
	'paaswedstrijd-26-03-2016',
	'parcours',
	'reglement',
	'sponsors',
	'verrassingsvraag',
	'vragenlijst',
	'wedstrijden-gzvka'
]);

/** The old site's own front page and menu pages, which are navigation rather than writing. */
const NAV_PAGES = new Set(['index', 'index-2', 'kastelen']);

type StoryKind = 'history' | 'contest' | 'nav';

function kindOf(slug: string): StoryKind {
	if (CONTEST_PAGES.has(slug)) return 'contest';
	if (NAV_PAGES.has(slug)) return 'nav';
	return 'history';
}

/**
 * The year a section is set in, from the label above its heading - Vicky Staal's memoir
 * heads every piece with "Nieuwe Wijk, 1983" or "Irishof, 1986-1987", which is the only
 * dating any of this writing carries.
 */
function yearFromKicker(kicker: string | undefined): string | undefined {
	const match = /\b(1[89]\d{2}|20[0-2]\d)(\s*-\s*(1[89]\d{2}|20[0-2]\d))?\b/.exec(kicker ?? '');
	if (!match) return undefined;
	return match[3] ? `${match[1]}-${match[3]}` : match[1];
}

interface IndexedPhoto {
	id: string;
	p: string;
	st: string[];
}

interface ArchiveIndexFile {
	photos: IndexedPhoto[];
}

/** One part of a story, as the browser reads it. */
type StoredPart =
	| { k: 'p'; t: string; credit?: true }
	| { k: 'i'; src: string; c?: string; id?: string };

interface StoredSection {
	heading?: string;
	kicker?: string;
	/** Year the piece is set in, when the kicker names one. */
	year?: string;
	places: string[];
	parts: StoredPart[];
}

/** A file the old page offered for download, and where the site now serves it. */
interface StoredDocument {
	name: string;
	url: string;
	bytes: number;
}

interface StoredStory {
	slug: string;
	title: string;
	source: string;
	kind: StoryKind;
	places: string[];
	documents?: StoredDocument[];
	sections: StoredSection[];
}

/** A story as it appears in a list, without its text. */
interface StorySummary {
	slug: string;
	title: string;
	/** The opening of the writing, for a card or a link. */
	excerpt: string;
	/** Characters of prose. */
	prose: number;
	/** Photographs resolved to the archive. */
	photos: number;
	kind: StoryKind;
	places: string[];
}

/** A pointer to the part of a story that is about one place. */
interface PlaceStoryRef {
	slug: string;
	title: string;
	/** Index of the section, or -1 when the whole story is about the place. */
	section: number;
	heading?: string;
	excerpt: string;
}

/**
 * The documents this repository actually has, keyed loosely enough to survive the spacing
 * differences between a link and a filename - the Fietszoektocht brochure is linked with one
 * space and saved with two.
 */
function readDocuments(): Map<string, { name: string; bytes: number }> {
	const byKey = new Map<string, { name: string; bytes: number }>();
	if (!fs.existsSync(DOCUMENT_DIR)) return byKey;

	for (const name of fs.readdirSync(DOCUMENT_DIR)) {
		const key = normalizeText(name).replace(/[^a-z0-9]+/g, '');
		if (key === '') continue;
		byKey.set(key, { name, bytes: fs.statSync(path.join(DOCUMENT_DIR, name)).size });
	}

	return byKey;
}

function placesIn(text: string, index: ReturnType<typeof buildIndex>): string[] {
	if (!text.trim()) return [];

	const matches: PlaceMatch[] = matchPlacesInText(text, index, {
		source: 'filename',
		minConfidence: MIN_HEADING_CONFIDENCE
	});

	return [...new Set(matches.map((match) => match.entryId))];
}

/**
 * A person's name as the standings write it: "Van Gerwen Annick", "Poedts Marceline".
 * Surname first, one or two given names, optionally with a Dutch particle.
 */
const NAME_SHAPED =
	/^(?:van|de|den|der|ten|ter|vande|vanden|op|'t)?\s*[A-ZÀ-Þ][\p{L}'-]+(?:\s+(?:van|de|den|der|ten|ter|den)\b)?(?:\s+[A-ZÀ-Þ][\p{L}'-]+){1,2}$/u;

/**
 * A ranked roll of names, stripped out of a section that also contains writing.
 *
 * The fietszoektocht standings arrive as alternating rank, name and score paragraphs, with
 * a few real paragraphs about the event mixed in. This project already wrote the rule for
 * that data: "The .xlsx standings files are lists of 146-154 named private individuals. Do
 * not import them" (docs/PLAN.md). The same list came in through the saved web page
 * instead, and was being published - 140 names with their scores, in the sitemap, findable
 * by anybody's own name.
 *
 * So the roll goes and the writing stays. The test for "this section is a results table"
 * is deliberately narrow - twenty or more paragraphs, more than a third of them bare
 * numbers - because a page of prose about the village must never match it; and within such
 * a section only the short, bare number-or-name paragraphs are dropped, so a sentence
 * standing between two rows survives.
 *
 * Returns the parts to keep, and how many were withheld.
 */
function withoutRollOfNames(parts: StoryPart[]): { parts: StoryPart[]; withheld: number } {
	const texts = parts.map((part) => (part.kind === 'paragraph' ? part.text.trim() : null));
	const isNumber = (text: string): boolean => /^\d{1,5}(?:[.,]\d+)?$/.test(text);

	const numbers = texts.filter((text) => text !== null && isNumber(text)).length;
	if (parts.length < 20 || numbers <= parts.length / 3) return { parts, withheld: 0 };

	const kept = parts.filter((part, i) => {
		const text = texts[i];
		if (text === null || text.length > 60) return true;
		return !isNumber(text) && !NAME_SHAPED.test(text);
	});

	return { parts: kept, withheld: parts.length - kept.length };
}

/** The first sentence or so of a section, used wherever a story is listed rather than read. */
function excerptOf(parts: StoredPart[], limit = 220): string {
	const text = parts
		.filter((part): part is Extract<StoredPart, { k: 'p' }> => part.k === 'p' && !part.credit)
		.map((part) => part.t)
		.join(' ')
		.trim();

	if (text.length <= limit) return text;

	const cut = text.slice(0, limit);
	const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
	return (lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()} ...`).trim();
}

function main(): void {
	const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf8')) as Gazetteer;
	const index = buildIndex(gazetteer);

	if (!fs.existsSync(ARCHIVE_INDEX)) {
		throw new Error(
			`${path.relative(REPO_ROOT, ARCHIVE_INDEX)} is missing. Run "npm run archive:index" first.`
		);
	}

	const archive = JSON.parse(fs.readFileSync(ARCHIVE_INDEX, 'utf8')) as ArchiveIndexFile;
	const lookup = buildPhotoLookup(archive.photos);
	const placesByPhotoId = new Map(archive.photos.map((photo) => [photo.id, photo.st]));

	const files = fs
		.readdirSync(LEGACY_DIR)
		.filter((name) => /\.html?$/i.test(name))
		.sort();

	const documentsAvailable = readDocuments();
	const missingDocuments: string[] = [];

	const stories: StoredStory[] = [];
	const summaries: StorySummary[] = [];
	const byPlace = new Map<string, PlaceStoryRef[]>();
	const byPhoto: Record<string, { slug: string; section: number; part: number }> = {};
	let namesWithheld = 0;

	let referenced = 0;
	let resolved = 0;
	const missing: string[] = [];
	const takenSlugs = new Set<string>();

	for (const fileName of files) {
		const page = parseLegacyHtml(fileName, fs.readFileSync(path.join(LEGACY_DIR, fileName)));

		// `index.htm` and `index.html` are two files with one slug between them, and the
		// second would otherwise overwrite the first's story file.
		const slug = uniqueSlug(page.slug, takenSlugs);

		// Two passes: the references that resolve to exactly one photograph tell us which
		// subject folders this page is about, which is what settles the ambiguous ones.
		const preferred = unambiguousFolders(page.images, lookup);

		const titlePlaces = placesIn(page.title, index);
		const sections: StoredSection[] = [];
		let photosResolved = 0;

		for (const section of page.sections) {
			const parts: StoredPart[] = [];
			const photoPlaceCounts = new Map<string, number>();

			const readable = withoutRollOfNames(section.parts);
			namesWithheld += readable.withheld;

			for (const part of readable.parts) {
				if (part.kind === 'paragraph') {
					parts.push(
						part.credit ? { k: 'p', t: part.text, credit: true } : { k: 'p', t: part.text }
					);
					continue;
				}

				referenced += 1;
				const photo = resolvePhoto(part.src, lookup, preferred);

				if (!photo) {
					missing.push(`${fileName}: ${part.src}`);
					parts.push(
						part.caption ? { k: 'i', src: part.src, c: part.caption } : { k: 'i', src: part.src }
					);
					continue;
				}

				resolved += 1;
				photosResolved += 1;

				for (const placeId of placesByPhotoId.get(photo.id) ?? []) {
					photoPlaceCounts.set(placeId, (photoPlaceCounts.get(placeId) ?? 0) + 1);
				}

				// First writer wins: a photograph shown twice belongs to where it first appeared.
				// The part index matters as much as the section: several pages put one heading
				// over a run of forty photographs covering a whole road, so the prose at the top
				// of that section is about the first of them and not about the fortieth.
				if (!(photo.id in byPhoto)) {
					byPhoto[photo.id] = { slug, section: sections.length, part: parts.length };
				}

				parts.push(
					part.caption
						? { k: 'i', src: part.src, c: part.caption, id: photo.id }
						: { k: 'i', src: part.src, id: photo.id }
				);
			}

			const headingPlaces = placesIn(
				[section.kicker, section.heading].filter(Boolean).join(' '),
				index
			);

			const photoPlaces = [...photoPlaceCounts]
				.filter(([, count]) => count >= MIN_PHOTOS_FOR_PLACE)
				.map(([placeId]) => placeId);

			const year = yearFromKicker(section.kicker);

			sections.push({
				...(section.heading ? { heading: section.heading } : {}),
				...(section.kicker ? { kicker: section.kicker } : {}),
				...(year ? { year } : {}),
				places: [...new Set([...headingPlaces, ...photoPlaces])],
				parts
			});
		}

		if (sections.every((section) => section.parts.length === 0)) continue;

		const storyPlaces = [...new Set([...titlePlaces, ...sections.flatMap((s) => s.places)])];

		const kind = kindOf(slug);

		const documents: StoredDocument[] = [];
		for (const reference of page.documents) {
			const key = normalizeText(reference.split('/').pop() ?? '').replace(/[^a-z0-9]+/g, '');
			const found = documentsAvailable.get(key);

			if (found) {
				documents.push({
					name: found.name,
					url: `/documenten/${encodeURIComponent(found.name)}`,
					bytes: found.bytes
				});
			} else if (!missingDocuments.includes(reference)) {
				missingDocuments.push(reference);
			}
		}

		const story: StoredStory = {
			slug,
			title: page.title,
			source: page.sourceFile,
			kind,
			places: storyPlaces,
			...(documents.length > 0 ? { documents } : {}),
			sections
		};
		stories.push(story);

		summaries.push({
			slug,
			title: page.title,
			excerpt: excerptOf(sections.flatMap((section) => section.parts)),
			prose: page.proseLength,
			photos: photosResolved,
			kind,
			places: storyPlaces
		});

		// Only writing counts. A section under a street's name holding nothing but
		// photographs is a labelled group of pictures, and the place's own page already
		// shows those; listing it as a story would promise a read that is not there.
		if (kind === 'history') {
			const covered = new Set<string>();

			for (const [i, section] of sections.entries()) {
				const excerpt = excerptOf(section.parts);
				if (excerpt === '') continue;

				for (const placeId of section.places) {
					covered.add(placeId);
					addPlaceRef(byPlace, placeId, {
						slug,
						title: page.title,
						section: i,
						...(section.heading ? { heading: section.heading } : {}),
						excerpt
					});
				}
			}

			// The whole story, for a place its title names - unless a section of it already
			// says something more specific about that same place.
			const wholeExcerpt = excerptOf(sections.flatMap((section) => section.parts));
			if (wholeExcerpt !== '') {
				for (const placeId of titlePlaces) {
					if (covered.has(placeId)) continue;
					addPlaceRef(byPlace, placeId, {
						slug,
						title: page.title,
						section: -1,
						excerpt: wholeExcerpt
					});
				}
			}
		}
	}

	fs.mkdirSync(STORY_DIR, { recursive: true });
	for (const existing of fs.readdirSync(STORY_DIR)) {
		if (existing.endsWith('.json')) fs.unlinkSync(path.join(STORY_DIR, existing));
	}
	for (const story of stories) {
		fs.writeFileSync(path.join(STORY_DIR, `${story.slug}.json`), JSON.stringify(story), 'utf8');
	}

	const stories_json = {
		version: 1,
		storyCount: stories.length,
		stories: summaries.sort((a, b) => b.prose - a.prose),
		byPlace: Object.fromEntries(
			[...byPlace].map(([placeId, refs]) => [
				placeId,
				refs.sort((a, b) => b.excerpt.length - a.excerpt.length)
			])
		)
	};

	fs.writeFileSync(path.join(DATA_DIR, 'stories.json'), JSON.stringify(stories_json), 'utf8');
	fs.writeFileSync(path.join(DATA_DIR, 'story-photos.json'), JSON.stringify(byPhoto), 'utf8');

	report(stories, summaries, byPlace, byPhoto, referenced, resolved, missing, namesWithheld);

	if (missingDocuments.length > 0) {
		// A document the old site linked and this repository does not have. Worth naming: it
		// is the same kind of gap as a missing photograph.
		console.log(`\n${missingDocuments.length} linked document(s) are not in static/documenten:`);
		for (const reference of missingDocuments) console.log(`  ${reference}`);
	}
}

/** Keeps two source files that reduce to the same slug from overwriting each other. */
function uniqueSlug(base: string, taken: Set<string>): string {
	let candidate = base || 'pagina';
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base}-${suffix}`;
		suffix += 1;
	}
	taken.add(candidate);
	return candidate;
}

function addPlaceRef(
	byPlace: Map<string, PlaceStoryRef[]>,
	placeId: string,
	ref: PlaceStoryRef
): void {
	const existing = byPlace.get(placeId);
	if (!existing) {
		byPlace.set(placeId, [ref]);
		return;
	}

	// A story that names the place in both its title and a section heading is one story.
	if (existing.some((other) => other.slug === ref.slug && other.section === ref.section)) return;
	existing.push(ref);
}

function report(
	stories: StoredStory[],
	summaries: StorySummary[],
	byPlace: Map<string, PlaceStoryRef[]>,
	byPhoto: Record<string, unknown>,
	referenced: number,
	resolved: number,
	missing: string[],
	namesWithheld: number
): void {
	const prose = summaries.reduce((sum, story) => sum + story.prose, 0);
	const sections = stories.reduce((sum, story) => sum + story.sections.length, 0);

	console.log(`Stories        ${stories.length} pages, ${sections} sections`);
	console.log(`Writing        ${prose.toLocaleString('en-GB')} characters of prose`);
	console.log(
		`Photographs    ${resolved} of ${referenced} references resolved ` +
			`(${((resolved / Math.max(referenced, 1)) * 100).toFixed(1)}%), ` +
			`${Object.keys(byPhoto).length} distinct`
	);
	console.log(`Places         ${byPlace.size} with something written about them`);
	if (namesWithheld > 0) {
		console.log(
			`Withheld       ${namesWithheld} lines of a ranked roll of named private individuals, per docs/PLAN.md`
		);
	}
	console.log(
		`Documents      ${stories.reduce(
			(sum, story) => sum + (story.documents?.length ?? 0),
			0
		)} attached`
	);

	if (missing.length > 0) {
		// These are photographs the live site shows and this repository does not have. Worth
		// knowing about: it is the clearest measure of what is still only on the old server.
		// Deliberately not under static/: this is a build report for whoever maintains the
		// archive, not a file the website should serve.
		const missingFile = path.join(REPO_ROOT, 'docs', 'legacy-missing-photos.txt');
		fs.mkdirSync(path.dirname(missingFile), { recursive: true });
		fs.writeFileSync(missingFile, missing.join('\n'), 'utf8');
		console.log(
			`\n${missing.length} referenced photographs are not in this repository. ` +
				`They exist on the live gzvka.be but were never added to src/lib/images/history-images.\n` +
				`Listed in ${path.relative(REPO_ROOT, missingFile)}.`
		);
	}

	console.log('\nMost written about:');
	for (const story of summaries.slice(0, 10)) {
		console.log(`  ${story.prose.toString().padStart(6)}  ${story.title}`);
	}
}

main();
