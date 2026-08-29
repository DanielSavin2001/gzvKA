// One page per photograph. The ids come from the generated archive index, so this is a
// client-rendered route served by the `fallback: 'index.html'` in svelte.config.js.
export const prerender = false;

export function load({ params }) {
	return { id: params.id };
}
