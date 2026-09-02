/**
 * Asking the runtime overlays for an answer that is definitely current.
 *
 * The four overlay endpoints - corrections, approved uploads, place pins, place records -
 * are all served with a cache lifetime on purpose. A visitor seeing a five-minute-old title
 * is fine; 4,504 photographs' worth of page loads each asking Firestore is not. The one
 * reader that lifetime must never apply to is the curator who just wrote the thing.
 *
 * The first attempt at that passed `cache: 'reload'` on the fetch, and it was not enough.
 * That option only adds request headers - `Cache-Control: no-cache`, `Pragma: no-cache` -
 * and a shared cache is free to ignore them; Google's frontends do. It is a request to be
 * given fresh data, not a guarantee of it, and the failure is silent: the response looks
 * perfectly normal, it is simply older than the write.
 *
 * A different URL is a different cache key. Nothing between here and the function can
 * answer it out of a stored entry, whatever any of them think of the request headers. So
 * freshness stops being a hint and becomes a property of what was asked for.
 *
 * The cost is one uncached round trip per curator action, which is the point.
 */

const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

/** Empty when no backend is configured - the normal state for a fresh clone. */
export function functionsBase(): string {
	return FUNCTIONS_BASE;
}

/**
 * The URL for one overlay endpoint.
 *
 * `fresh` appends a parameter no cache has seen. The endpoints ignore unknown query
 * parameters, so this changes nothing about the answer - only about who is allowed to give
 * it. Two calls in the same millisecond share a URL, which is correct: they are the same
 * read.
 */
export function overlayUrl(path: string, fresh = false): string {
	if (!fresh) return `${FUNCTIONS_BASE}${path}`;

	const separator = path.includes('?') ? '&' : '?';
	return `${FUNCTIONS_BASE}${path}${separator}fresh=${Date.now()}`;
}

/**
 * What every overlay fetch passes.
 *
 * `cache: 'reload'` is kept alongside the cache-busting URL rather than replaced by it.
 * It costs nothing, it is the correct thing to say, and on the caches that do honour it
 * the two agree.
 */
export function overlayInit(fresh: boolean, timeoutMs: number): RequestInit {
	return {
		signal: AbortSignal.timeout(timeoutMs),
		...(fresh ? { cache: 'reload' as RequestCache } : {})
	};
}
