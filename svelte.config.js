import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			/**
			 * The shell for the handful of pages that cannot be prerendered.
			 *
			 * Not `index.html`. Everything else here is prerendered, and the home page's own
			 * output is `index.html` - so a fallback under that name overwrote the busiest
			 * page on the site with a 2 KB empty shell, silently, every build.
			 *
			 * `firebase.json` rewrites everything unmatched here, which is what makes
			 * /beheer, /kaart, /zoeken and /detail work as client-side routes.
			 */
			fallback: '200.html',
			precompress: false,
			strict: true
		}),

		prerender: {
			/**
			 * The photographs are not the build's to vouch for.
			 *
			 * Two reasons a `<img src>` under `/foto/` does not resolve here, and neither is
			 * a broken site:
			 *
			 * `npm run thumbs` generates 4,500-odd images into `static/foto/` and takes a few
			 * minutes, so it is a separate step - the deploy runs it, a fresh clone has not.
			 * Without this the archive could not be built at all until every image existed.
			 *
			 * And 26 photographs have an `&`, a `+` or a `,` in their filename. Their URLs
			 * are encoded correctly; the prerenderer looks them up with `decodeURI`, which
			 * leaves `%26` as `%26` - so it searches for a file whose name really does
			 * contain a percent sign. Firebase Hosting decodes the whole path and serves them
			 * fine, which is verifiable by requesting one from a built site.
			 *
			 * Everything else still fails the build: a broken link between two pages is a
			 * real error and should stop it.
			 */
			handleHttpError: ({ path, referrer, message }) => {
				if (path.startsWith('/foto/')) {
					console.warn(`Image not resolvable at build time, skipping: ${path}`);
					return;
				}

				throw new Error(`${message} (linked from ${referrer})`);
			}
		}
	},

	preprocess: [
		preprocess({
			postcss: true
		})
	]
};
