/**
 * The rule this file exists to hold: a curator's read must not be answerable from a cache.
 *
 * The first attempt at that shipped `cache: 'reload'` on the fetch and was not enough. That
 * option only adds request headers, and a shared cache may ignore them - so a curator could
 * merge two donors, reload the page to check, and be shown the answer from before their
 * merge, with nothing anywhere saying the response was old. It reads exactly like the write
 * having done nothing.
 *
 * A different URL is a different cache key. That is not a hint, and it is what these tests
 * pin. The logic is duplicated here rather than imported because `src/lib/overlay.ts` reads
 * `import.meta.env`, which is Vite's and not available to jest - so the shape of the URL is
 * asserted directly. If `overlayUrl` changes, this must change with it deliberately.
 */

/** The same construction as `src/lib/overlay.ts`, against a fixed base and clock. */
function overlayUrl(base: string, path: string, fresh: boolean, now: number): string {
	if (!fresh) return `${base}${path}`;
	const separator = path.includes('?') ? '&' : '?';
	return `${base}${path}${separator}fresh=${now}`;
}

const BASE = 'https://europe-west1-gzvka-12a9f.cloudfunctions.net/';

describe('overlayUrl', () => {
	it('leaves an ordinary visitor read exactly as it was', () => {
		// A visitor SHOULD be served from cache. The endpoint's five-minute lifetime exists
		// so that 4,504 photographs' worth of page loads do not each reach Firestore.
		expect(overlayUrl(BASE, 'photoEdits', false, 1_700_000_000_000)).toBe(`${BASE}photoEdits`);
	});

	it('gives a curator a URL no cache has an entry for', () => {
		expect(overlayUrl(BASE, 'photoEdits', true, 1_700_000_000_000)).toBe(
			`${BASE}photoEdits?fresh=1700000000000`
		);
	});

	it('gives two reads at different moments two different cache keys', () => {
		const first = overlayUrl(BASE, 'photoEdits', true, 1_700_000_000_000);
		const second = overlayUrl(BASE, 'photoEdits', true, 1_700_000_000_001);

		expect(first).not.toBe(second);
	});

	it('keeps an existing query string intact', () => {
		// `listPhotoFacts?status=pending` and friends already carry one; appending with a
		// second `?` would produce a URL the function reads as one long status value.
		expect(overlayUrl(BASE, 'listPhotoFacts?status=pending', true, 1_700_000_000_000)).toBe(
			`${BASE}listPhotoFacts?status=pending&fresh=1700000000000`
		);
	});

	it('works with no backend configured, which is a fresh clone', () => {
		expect(overlayUrl('', 'photoEdits', false, 1)).toBe('photoEdits');
	});
});
