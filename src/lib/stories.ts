/**
 * The writing from the old gzvka.be, as the browser sees it.
 *
 * The archive was never only photographs. The old site carried 290,000 characters about
 * them - the history of each castle, who kept which café, a memoir of growing up in the
 * Nieuwe Wijk in the eighties - and a filename cannot hold any of that. It is recovered
 * from the pages committed in `legacy-site/` and rebuilt with `npm run stories`.
 *
 * Loaded in three pieces, so that no page pays for text it does not show:
 *
 *   `/data/stories.json`       which stories exist and which place each belongs to (28 KB
 *                              over the wire); wanted by the home page, place pages and
 *                              the story index.
 *   `/data/story-photos.json`  photograph -> story, wanted only by a photo page.
 *   `/data/verhalen/<slug>`    one story's full text, fetched when it is opened.
 */

/** A story in a list: enough to decide whether to read it, without its text. */
export interface StorySummary {
	slug: string;
	title: string;
	excerpt: string;
	/** Characters of prose. */
	prose: number;
	/** Photographs in the story that are in this archive. */
	photos: number;
	kind: 'history' | 'contest' | 'nav';
	places: string[];
}

/** A pointer to whatever the old site wrote about one place. */
export interface PlaceStoryRef {
	slug: string;
	title: string;
	/** Index of the section, or -1 when the whole story is about the place. */
	section: number;
	heading?: string;
	excerpt: string;
}

export interface StoryIndex {
	version: number;
	storyCount: number;
	stories: StorySummary[];
	byPlace: Record<string, PlaceStoryRef[]>;
}

export type StoryPart =
	| { k: 'p'; t: string; credit?: true }
	| { k: 'i'; src: string; c?: string; id?: string };

export interface StorySection {
	heading?: string;
	kicker?: string;
	year?: string;
	places: string[];
	parts: StoryPart[];
}

export interface Story {
	slug: string;
	title: string;
	/** The page in `legacy-site/` this came from, so any line can be checked. */
	source: string;
	kind: 'history' | 'contest' | 'nav';
	places: string[];
	sections: StorySection[];
}

/** Where a photograph was written about: the story, and which section of it. */
export type StoryPhotoMap = Record<string, { slug: string; section: number }>;

let indexCache: StoryIndex | null = null;
let indexInFlight: Promise<StoryIndex> | null = null;

const storyCache = new Map<string, Story>();
let photoMapCache: StoryPhotoMap | null = null;
let photoMapInFlight: Promise<StoryPhotoMap> | null = null;

async function getJson<T>(url: string, fetcher: typeof fetch): Promise<T> {
	const response = await fetcher(url);
	if (!response.ok) throw new Error(`${url} (${response.status})`);
	return (await response.json()) as T;
}

/**
 * Loads the story index.
 *
 * Every caller treats a failure as "there are no stories" rather than an error: the writing
 * enriches a page, it is not what the page is for, and a place page must still show its
 * photographs when this file is missing.
 */
export async function loadStoryIndex(fetcher: typeof fetch = fetch): Promise<StoryIndex> {
	if (indexCache) return indexCache;
	if (indexInFlight) return indexInFlight;

	indexInFlight = (async () => {
		const index = await getJson<StoryIndex>('/data/stories.json', fetcher);
		indexCache = index;
		return index;
	})();

	try {
		return await indexInFlight;
	} finally {
		indexInFlight = null;
	}
}

export async function loadStory(slug: string, fetcher: typeof fetch = fetch): Promise<Story> {
	const cached = storyCache.get(slug);
	if (cached) return cached;

	const story = await getJson<Story>(`/data/verhalen/${encodeURIComponent(slug)}.json`, fetcher);
	storyCache.set(slug, story);
	return story;
}

export async function loadStoryPhotos(fetcher: typeof fetch = fetch): Promise<StoryPhotoMap> {
	if (photoMapCache) return photoMapCache;
	if (photoMapInFlight) return photoMapInFlight;

	photoMapInFlight = (async () => {
		const map = await getJson<StoryPhotoMap>('/data/story-photos.json', fetcher);
		photoMapCache = map;
		return map;
	})();

	try {
		return await photoMapInFlight;
	} finally {
		photoMapInFlight = null;
	}
}

/** What was written about a place, longest first. Empty when nothing was. */
export function storiesForPlace(index: StoryIndex | null, placeId: string): PlaceStoryRef[] {
	return index?.byPlace[placeId] ?? [];
}

/** The stories about Kapellen itself, longest first. Contest and menu pages excluded. */
export function historyStories(index: StoryIndex | null): StorySummary[] {
	return (index?.stories ?? []).filter((story) => story.kind === 'history');
}

/** The association's own prize draws and competitions, kept apart from the local history. */
export function contestStories(index: StoryIndex | null): StorySummary[] {
	return (index?.stories ?? []).filter((story) => story.kind === 'contest');
}

/** A story's own anchor for one section, used to link straight to the right piece. */
export function sectionAnchor(section: number): string {
	return section < 0 ? '' : `#deel-${section}`;
}

/** Roughly how long a story takes to read, at 200 words a minute. */
export function readingMinutes(characters: number): number {
	return Math.max(1, Math.round(characters / 5 / 200));
}
