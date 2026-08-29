// One story per slug, and the slugs come from the generated story data rather than from a
// list in the build, so this renders on the client like the other dynamic routes.
export const prerender = false;

export function load({ params }) {
	return { slug: params.slug };
}
