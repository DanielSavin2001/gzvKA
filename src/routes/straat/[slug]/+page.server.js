import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which places exist, for the prerenderer.
 *
 * Only places that actually have photographs. A page for a place with none says so, and
 * asking a search engine to index 0-photograph pages spends crawl budget on nothing.
 *
 * Read from disk rather than fetched: `entries` runs outside any request and a relative
 * fetch has no origin to resolve against. This is a server module, so `node:fs` never
 * reaches the browser bundle.
 */
export function entries() {
	/** @type {{ places: { id: string, count: number }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'archive-index.json'), 'utf8'));
	return index.places.filter((place) => place.count > 0).map((place) => ({ slug: place.id }));
}
