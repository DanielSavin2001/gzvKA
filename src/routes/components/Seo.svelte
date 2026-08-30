<script lang="ts">
	import { canonical, SITE, SITE_NAME } from '$lib/seo';

	/**
	 * Everything a search engine and a link preview need, in one place.
	 *
	 * Open Graph matters more than usual for this archive: it is shared between neighbours
	 * on WhatsApp and Facebook, and neither of those runs JavaScript when it fetches a link.
	 * Whatever they can see in the HTML is the whole preview - so a photograph shared
	 * without these shows as a bare URL, and with them shows the picture and its street.
	 *
	 * `structured` takes a JSON-LD object. It is stringified here rather than in each page,
	 * so no page has to remember to escape it.
	 */

	export let title: string;
	export let description: string;
	/** Path only, e.g. `/foto/dorpsstraat-1960`. The host is added. */
	export let path: string;
	/** Absolute or root-relative URL of the image to show in a link preview. */
	export let image: string | null = null;
	export let type: 'website' | 'article' = 'website';
	export let structured: Record<string, unknown> | null = null;
	/** Keeps a page out of search results without hiding it from people. */
	export let noindex = false;

	$: url = canonical(path);
	$: fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
	$: absoluteImage = image ? (image.startsWith('http') ? image : SITE + image) : null;

	/**
	 * The JSON-LD block, assembled rather than written out.
	 *
	 * The opening tag is built from pieces on purpose: `svelte-preprocess` scans the raw
	 * source for `<script` before the compiler ever runs, finds the type it does not know,
	 * and fails the build looking for a transformer for `ld+json`. Splitting the literal is
	 * what keeps it out of that scan.
	 *
	 * `<` is escaped inside the payload so a title containing markup cannot close the tag
	 * early - the one real injection risk in a block like this.
	 */
	$: jsonLd = structured
		? `<${'script'} type="application/ld+json">${JSON.stringify(structured).replace(
				/</g,
				'\\u003c'
		  )}</${'script'}>`
		: '';
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />

	{#if noindex}
		<meta name="robots" content="noindex, follow" />
	{/if}

	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="nl_BE" />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	{#if absoluteImage}
		<meta property="og:image" content={absoluteImage} />
		<!--
			Declared rather than left to be discovered.

			Every image passed here is a `.card.webp`, which the thumbnail script writes as an
			exact 1200x630 canvas. Stating the size lets a crawler lay out the large card
			without fetching the file first, and it is the size that decides whether the large
			card is drawn at all - under 600x315 Facebook and WhatsApp fall back to a thumbnail
			beside a line of text, which is what every share of this archive used to be.
		-->
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:type" content="image/webp" />
	{/if}

	<meta name="twitter:card" content={absoluteImage ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	{#if absoluteImage}
		<meta name="twitter:image" content={absoluteImage} />
	{/if}

	{#if jsonLd}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLd}
	{/if}
</svelte:head>
