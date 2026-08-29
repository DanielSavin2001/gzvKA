import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which photographs exist, for the prerenderer.
 *
 * All 4,504 of them. They are the long tail and the reason anybody arrives from a search:
 * somebody looking for "Dorpsstraat 1960" wants one of these pages, not the front door.
 * Until they were prerendered every one of them served the same 2 KB shell.
 *
 * Read from disk rather than fetched: `entries` runs outside any request and a relative
 * fetch has no origin to resolve against. This is a server module, so `node:fs` never
 * reaches the browser bundle.
 */
export function entries() {
	/** @type {{ photos: { id: string }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'archive-index.json'), 'utf8'));
	return index.photos.map((photo) => ({ id: photo.id }));
}
