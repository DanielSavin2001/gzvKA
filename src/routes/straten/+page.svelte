<script lang="ts">
	import PlaceList from '../components/PlaceList.svelte';
	import PlaceMap from '../components/PlaceMap.svelte';
	import Seo from '../components/Seo.svelte';

	export let data: {
		places: { id: string; name: string; count: number }[];
		missing: { slug: string; name: string }[];
	};

	$: photographs = data.places.reduce((sum, place) => sum + place.count, 0);

	/** Streets are drawn blue; everything else on the site's maps is green. */
	$: streets = data.places.map((place) => ({ ...place, isStreet: true }));
</script>

<Seo
	title="Straten en pleinen van Kapellen"
	description="Alle straten en pleinen van Kapellen waar het fotoarchief foto's van heeft, en de straten waar nog geen enkele foto van is."
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
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{data.places.length} plaatsen &middot; {photographs.toLocaleString('nl-BE')} foto's
			{#if data.missing.length > 0}
				&middot; {data.missing.length} straten nog zonder foto
			{/if}
		</p>
	</header>

	<div class="mt-8">
		<PlaceMap places={streets} noun="straten" title="Op de kaart" height="460px" zoom={12.4} />
	</div>

	<div class="mt-10 border-t border-gray-200 pt-8 dark:border-gray-700">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Alle straten op een rij</h2>
		<PlaceList places={data.places} noun="straten" />
	</div>

	{#if data.missing.length > 0}
		<!--
			The other 277. This page said its index ran "van de Antwerpsesteenweg tot de
			Zilverenhoeklaan" while the Zilverenhoeklaan had no page: the archive holds
			photographs of 45 streets and the official register knows 313. Naming the gap is
			both honest and the most direct request the site can make - almost everybody
			reading this lives in one of them.
		-->
		<div class="mt-10 border-t border-gray-200 pt-8 dark:border-gray-700">
			<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				Straten waar we nog niets van hebben
			</h2>
			<p class="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
				{data.missing.length} straten uit het stratenregister van Kapellen staan wel op de kaart, maar
				het archief heeft er geen enkele foto van. Woont u in een ervan?
				<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/upload"
					>Stuur er een in.</a
				>
			</p>

			<ul class="mt-5 flex flex-wrap gap-2">
				{#each data.missing as street (street.slug)}
					<li>
						<a
							class="inline-block rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-700 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-blue-950"
							href="/straat/{street.slug}">{street.name}</a
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
