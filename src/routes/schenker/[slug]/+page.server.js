import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { slugify } from '../../../../sharedModels/text';

/**
 * Which donors exist, for the prerenderer.
 *
 * The slug is the identity rather than the string, so the spelling variants the corpus
 * carries collapse into one page: "Johan Van Elst" and "Johan van Elst" are one man with
 * 89 photographs, not two men with 88 and 1.
 *
 * `slugify` is imported rather than reimplemented, even though this is the one file where
 * copying four lines would have been easier - the whole point of the slug is that it is
 * the identity, and two definitions of an identity is two identities.
 *
 * Read from disk rather than fetched: `entries` runs outside any request and a relative
 * fetch has no origin to resolve against. This is a server module, so `node:fs` never
 * reaches the browser bundle.
 */
export function entries() {
	/** @type {{ photos: { d?: string }[] }} */
	const index = JSON.parse(readFileSync(join('static', 'data', 'archive-index.json'), 'utf8'));

	const slugs = new Set();
	for (const photo of index.photos) {
		const slug = slugify(photo.d?.trim());
		if (slug) slugs.add(slug);
	}

	return [...slugs].map((slug) => ({ slug }));
}
