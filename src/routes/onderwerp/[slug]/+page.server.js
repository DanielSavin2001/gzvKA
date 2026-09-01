import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { subjectsWithPages } from '../../../../sharedModels/subject-pages';

/**
 * Which subjects exist, for the prerenderer.
 *
 * Read from disk rather than fetched, the same way `/straat/[slug]` does it: `entries` runs
 * outside any request and a relative fetch has no origin to resolve against. This is a
 * server module, so `node:fs` never reaches the browser bundle.
 *
 * The rule lives in `sharedModels` and is shared with `load`, so the pages that are built
 * and the pages that will render are the same set. Two copies of that rule would mean a slug
 * that renders but was never prerendered, or worse, a prerendered page nothing links to.
 */
export function entries() {
	/** @type {{ subjects: { slug: string, name: string, count: number }[], places: { id: string }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'archive-index.json'), 'utf8'));
	const placeIds = new Set(index.places.map((place) => place.id));

	return subjectsWithPages(index.subjects, placeIds).map((subject) => ({ slug: subject.slug }));
}
