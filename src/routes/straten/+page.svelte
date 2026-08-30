<script lang="ts">
	import PlaceList from '../components/PlaceList.svelte';
	import Seo from '../components/Seo.svelte';

	export let data: { places: { id: string; name: string; count: number }[] };

	$: photographs = data.places.reduce((sum, place) => sum + place.count, 0);
</script>

<Seo
	title="Straten en pleinen van Kapellen"
	description="Alle straten en pleinen van Kapellen waar het fotoarchief foto's van heeft, van de Antwerpsesteenweg tot de Zilverenhoeklaan."
	path="/straten"
/>

<div class="mx-auto max-w-5xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Straten</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			Straten en pleinen van Kapellen
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Elke straat en elk plein waar het archief foto's van heeft, met hoeveel er zijn.
		</p>
		<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
			{data.places.length} plaatsen &middot; {photographs.toLocaleString('nl-BE')} foto's
		</p>
	</header>

	<PlaceList places={data.places} noun="straten" />
</div>
