<script lang="ts">
	import Seo from '../components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';

	/**
	 * What this archive is.
	 *
	 * The numbers are read from the archive itself rather than typed into the page, so they
	 * cannot quietly go stale the way a hand-written "over 4000 photographs" does after the
	 * next import.
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
		Over dit archief
	</h1>

	<p class="mt-4 text-lg text-gray-700 dark:text-gray-300">
		&ldquo;Ge zijt van Kapellen als ge &hellip;&rdquo; begon als een verzameling foto's van
		Kapellen: mensen, straten, scholen, cafés, kapellen en kastelen. Wat er stond was waardevol,
		maar het was een opslagplaats meer dan een archief &mdash; moeilijk doorzoekbaar, en niet te
		gebruiken op een telefoon.
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

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">De teksten</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Het archief was nooit alleen foto's. De oude website droeg ongeveer 290.000 tekens aan verhalen
		mee: de geschiedenis van elk kasteel en elke kerk, wie welk café hield, en een lange herinnering
		aan opgroeien in de Nieuwe Wijk in de jaren tachtig. Alle 101 pagina's zijn bewaard en staan nu
		naast de foto's waar ze over gaan.
	</p>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Er is niets herschreven of samengevat. Elke zin op <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/verhalen">Verhalen</a
		>
		staat letterlijk zo op de oude site.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">De kaart</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Straten komen uit het officiële adressenregister. De rest &mdash; kastelen, gehuchten, verdwenen
		villa's, cafés die er niet meer zijn &mdash; staat in geen enkel register en is met de hand
		opgezocht.
	</p>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Van die plekken weten we sommige precies en andere bij benadering, en dat verschil is op de
		kaart te zien: waar we het niet zeker weten staat een rode cirkel, en erbij staat waarom we
		twijfelen. Weet u het beter, dan kunt u het ter plekke rechtzetten. Dat is geen beleefdheid
		&mdash; de mensen die weten waar kasteel Beaulieu stond, wonen in Kapellen en niet in deze
		database.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">Meedoen</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Hebt u een oude foto van Kapellen liggen? <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/upload">Stuur ze in</a
		>. U hoeft geen account te maken en niets in te vullen behalve de foto zelf. Iemand van het
		archief kijkt ernaar voor ze online komt.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">Bronnen</h2>

	<ul class="mt-3 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
		<li>De foto's en teksten van gzvka.be, bijeengebracht door de gemeenschap van Kapellen.</li>
		<li>Straatgeometrie uit het Vlaams Adressenregister.</li>
		<li>Gebouwen en monumenten uit de Inventaris Onroerend Erfgoed.</li>
		<li>Kaartachtergrond &copy; OpenStreetMap-bijdragers (ODbL).</li>
	</ul>

	<p class="mt-8 text-sm text-gray-600 dark:text-gray-400">
		Iets gezien dat niet klopt? Dat horen we graag &mdash; zie <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/contact">Contact</a
		>.
	</p>
</div>
