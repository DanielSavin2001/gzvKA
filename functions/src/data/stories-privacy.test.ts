import * as fs from 'fs';
import * as path from 'path';

import { looksLikePersonName } from '../gazetteer/segment';

/**
 * What the stories must never publish.
 *
 * `docs/PLAN.md` wrote the rule: "The .xlsx standings files are lists of 146-154 named
 * private individuals. **Do not import them.**" The same list arrived through the saved web
 * page instead, and was published - about 140 residents by name with their scores, in the
 * sitemap, findable by anybody typing their own name.
 *
 * The build now withholds it, but the build decides that with a heuristic: it prints a line
 * and carries on. A change to how pages are split into sections could stop the heuristic
 * matching, and the names would come back with a green build and no warning. This asserts
 * against the shipped files instead, so that regression fails a test rather than reaching
 * the website.
 */

const STORY_DIR = path.join(__dirname, '..', '..', '..', 'static', 'data', 'verhalen');

interface StoredStory {
	slug: string;
	sections: { parts: ({ k: 'p'; t: string; credit?: true } | { k: 'i' })[] }[];
}

function storyFiles(): StoredStory[] {
	return fs
		.readdirSync(STORY_DIR)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(fs.readFileSync(path.join(STORY_DIR, name), 'utf8')) as StoredStory);
}

describe('the published stories', () => {
	it('carries no roll of bare personal names', () => {
		// A name inside a sentence is somebody the writing is about, and a byline repeated
		// under each piece is its author - both are fine, and both are excluded here. What is
		// forbidden is many DIFFERENT people each appearing as a paragraph of nothing but
		// their name, which is what a table of standings looks like once its markup is gone.
		// The roll this guards against was 140 distinct residents; ten is already a list.
		const rolls: string[] = [];

		for (const story of storyFiles()) {
			const bare = new Set(
				story.sections
					.flatMap((section) => section.parts)
					.filter((part): part is { k: 'p'; t: string; credit?: true } => part.k === 'p')
					.filter((part) => !part.credit)
					.map((part) => part.t.trim())
					.filter((text) => text.length <= 60 && looksLikePersonName(text))
			);

			if (bare.size >= 10) {
				rolls.push(`${story.slug}: ${bare.size} distinct (${[...bare].slice(0, 2).join(', ')} ...)`);
			}
		}

		expect(rolls).toEqual([]);
	});

	it('still holds the writing about the afternoon those names came from', () => {
		// The other half of the rule: withhold the roll, keep the prose. A filter that took
		// the whole page would pass the test above and lose something worth having.
		const einduitslag = JSON.parse(
			fs.readFileSync(path.join(STORY_DIR, 'einduitslag.json'), 'utf8')
		) as StoredStory;

		const prose = einduitslag.sections
			.flatMap((section) => section.parts)
			.filter((part): part is { k: 'p'; t: string } => part.k === 'p')
			.map((part) => part.t)
			.join(' ');

		expect(prose).toContain('Meer dan 600 boekjes werden verspreid');
		expect(prose.length).toBeGreaterThan(3000);
	});
});
