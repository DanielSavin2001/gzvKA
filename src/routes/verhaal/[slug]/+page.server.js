import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which stories exist, for the prerenderer.
 *
 * Read from disk rather than fetched. `entries` runs before anything is serving, outside
 * any request, so the `fetch` available inside `load` has no origin to resolve a relative
 * path against - it fails with ERR_INVALID_URL. This file is a server module, so `node:fs`
 * never reaches the browser bundle.
 */
export function entries() {
	/** @type {{ stories: { slug: string }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'stories.json'), 'utf8'));
	return index.stories.map((story) => ({ slug: story.slug }));
}
