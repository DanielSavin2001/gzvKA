<script lang="ts">
	import Seo from '../components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import { copy } from '$lib/site-copy';

	/**
	 * What this archive is.
	 *
	 * The numbers are read from the archive itself rather than typed into the page, so they
	 * cannot quietly go stale the way a hand-written "over 4000 photographs" does after the
	 * next import.
	 *
	 * The words come through `$copy`, so a curator can rewrite any of them from /beheer
	 * without a deploy. What is written in `sharedModels/site-copy.ts` is what the site
	 * ships with and what these paragraphs render until somebody changes one - which is why
	 * the prerendered HTML still carries real prose. The three paragraphs carrying a link
	 * are deliberately left in this file: a plain text box is the wrong shape for them, and
	 * inviting HTML into one is how a content system starts producing broken pages.
	 */

	let archive: Archive | null = null;

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch {
			// The page reads perfectly well without the counts.
		}
	});

	$: places = archive ? archive.places.filter((place) => place.count > 0).length : 0;
	$: streets = archive
		? archive.places.filter((place) => place.isStreet && place.count > 0).length
		: 0;
</script>

<Seo
	title="Over ons"
	description="Over het fotoarchief van Kapellen: waar de foto's vandaan komen, wie ze verzamelde, en hoe u kunt helpen."
	path="/over-ons"
/>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
		{$copy('over-ons.title')}
	</h1>

	<p class="mt-4 text-lg text-gray-700 dark:text-gray-300">
		{$copy('over-ons.intro')}
	</p>

	<p class="mt-4 text-gray-700 dark:text-gray-300">
		Deze site is dezelfde verzameling, opnieuw opgebouwd zodat u er iets in kunt vinden:
		{#if archive}
			<strong>{archive.imageCount.toLocaleString('nl-BE')} foto's</strong> over
			<strong>{places} plaatsen</strong>, waarvan {streets} straten en pleinen,
		{:else}
			duizenden foto's over meer dan honderd plaatsen,
		{/if}
		doorzoekbaar op straat, op naam en op jaartal, en te bekijken op de kaart.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">
		{$copy('over-ons.teksten-kop')}
	</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		{$copy('over-ons.teksten')}
	</p>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Er is niets herschreven of samengevat. Elke zin op <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/verhalen">Verhalen</a
		>
		staat letterlijk zo op de oude site.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">
		{$copy('over-ons.kaart-kop')}
	</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		{$copy('over-ons.kaart-register')}
	</p>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		{$copy('over-ons.kaart-twijfel')}
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">
		{$copy('over-ons.meedoen-kop')}
	</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Hebt u een oude foto van Kapellen liggen? <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/upload">Stuur ze in</a
		>. U hoeft geen account te maken en niets in te vullen behalve de foto zelf. Iemand van het
		archief kijkt ernaar voor ze online komt.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">
		{$copy('over-ons.bronnen-kop')}
	</h2>

	<ul class="mt-3 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
		<li>{$copy('over-ons.bron-archief')}</li>
		<li>{$copy('over-ons.bron-straten')}</li>
		<li>{$copy('over-ons.bron-erfgoed')}</li>
		<li>{$copy('over-ons.bron-kaart')}</li>
	</ul>

	<p class="mt-8 text-sm text-gray-600 dark:text-gray-400">
		Iets gezien dat niet klopt? Dat horen we graag &mdash; zie <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/contact">Contact</a
		>.
	</p>
</div>
