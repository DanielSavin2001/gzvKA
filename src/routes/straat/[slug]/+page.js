// The slug space comes from the generated archive index, which the browser loads anyway,
// so this route is rendered on the client rather than prerendered. `fallback: 'index.html'`
// in svelte.config.js serves it, exactly as it already does for /detail/[id].
export const prerender = false;

export function load({ params }) {
	return { slug: params.slug };
}
