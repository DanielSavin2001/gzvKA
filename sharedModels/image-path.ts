/**
 * Turning a corpus path into the URL of its generated image.
 *
 * This lives here rather than beside the archive because two sides have to agree about it:
 * `scripts/build-thumbnails.mjs` writes the files under their real names, and the site
 * links to them. A second copy of the rule is how a photograph quietly stops loading.
 */

/**
 * A corpus path, encoded the way the server will decode it.
 *
 * Deliberately not `encodeURIComponent`. Firebase Hosting normalises an incoming path with
 * `decodeURI` semantics: it turns `%20` back into a space but leaves `%26`, `%2B` and `%2C`
 * exactly as they are, and then looks for a file whose name really does contain a percent
 * sign. The 26 photographs with an `&`, a `+` or a `,` in their filename were served the
 * app shell instead of a picture for precisely that reason - and because the rewrite
 * answers 200, nothing anywhere reported an error. The URL looked perfectly correct in the
 * HTML. SvelteKit's prerenderer resolves paths the same way and reported the same 26.
 *
 * `encodeURI` encodes what has to be encoded and leaves the sub-delimiters raw, which is
 * legal in a path segment (RFC 3986) and is what the server expects. It leaves `#` and `?`
 * raw too, and those would end the path early, so they are encoded by hand; no filename in
 * the archive has either today, and one that did would then fail cleanly rather than
 * truncating the URL.
 */
export function encodePath(relativePath: string): string {
	return encodeURI(relativePath).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
