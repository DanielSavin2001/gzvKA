import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which places exist, for the prerenderer.
 *
 * Places that actually have photographs, plus every street the official register knows and
 * the archive does not. A page for an archive place with no photographs says so and is
 * worth nothing to anybody; a page for a register street says where the street is and what
 * is nearby, which is the whole reason those 277 pages exist.
 *
 * The register streets are deliberately absent from `build-sitemap.ts`. They are here for
 * the person who types their own street name, not for a crawler to spend its budget on 277
 * pages without a single photograph between them.
 *
 * Read from disk rather than fetched: `entries` runs outside any request and a relative
 * fetch has no origin to resolve against. This is a server module, so `node:fs` never
 * reaches the browser bundle.
 */
export function entries() {
	/** @type {{ places: { id: string, count: number }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'archive-index.json'), 'utf8'));
	const photographed = index.places.filter((place) => place.count > 0).map((place) => place.id);

	/** @type {{ streets?: { slug: string }[] }} */
	let register = {};
	try {
		register = JSON.parse(readFileSync(join('static', 'data', 'street-register.json'), 'utf8'));
	} catch {
		// No register means no register pages, never a failed build: every one of these pages
		// is an addition, and the archive's own places do not depend on the file existing.
		register = {};
	}

	const known = new Set(photographed);
	const streets = (register.streets ?? [])
		.map((street) => street.slug)
		.filter((slug) => !known.has(slug));

	return [...photographed, ...streets].map((slug) => ({ slug }));
}
