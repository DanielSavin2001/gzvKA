// The review queue is signed-in, live data. Nothing about it can be prerendered, and it
// must never be served from a cache to the wrong person.
export const prerender = false;
export const ssr = false;
