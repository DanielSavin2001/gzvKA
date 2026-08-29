// The results depend entirely on the `?q=` query string, which does not exist at build
// time - SvelteKit refuses `url.searchParams` on a prerendered page, and rightly so.
// Served by the `fallback: 'index.html'` in svelte.config.js, like the other dynamic routes.
export const prerender = false;
