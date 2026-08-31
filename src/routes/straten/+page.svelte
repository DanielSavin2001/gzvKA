<script lang="ts">
	import PlaceList from '../components/PlaceList.svelte';
	import PlaceMap from '../components/PlaceMap.svelte';
	import Seo from '../components/Seo.svelte';

	export let data: { places: { id: string; name: string; count: number }[] };

	$: photographs = data.places.reduce((sum, place) => sum + place.count, 0);

	/** Streets are drawn blue; everything else on the site's maps is green. */
	$: streets = data.places.map((place) => ({ ...place, isStreet: true }));
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

	<div class="mt-8">
		<PlaceMap
			places={streets}
			noun="straten"
			title="Op de kaart"
			height="460px"
			zoom={12.4}
		/>
	</div>

	<div class="mt-10 border-t border-gray-200 pt-8 dark:border-gray-700">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Alle straten op een rij</h2>
		<PlaceList places={data.places} noun="straten" />
	</div>
</div>
