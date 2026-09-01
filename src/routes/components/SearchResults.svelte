<script lang="ts">
	import type { Archive, SearchHit } from '$lib/archive';
	import { searchPhotos } from '$lib/archive';
	import PhotoCard from './PhotoCard.svelte';

	/**
	 * What a search turns up, shown where the search was typed.
	 *
	 * This used to be a page of its own at `/zoeken`, which meant the home page carried a
	 * search box that could only send you somewhere else to see the answer. The box and the
	 * results belong together, so they are together now and this is the piece that was worth
	 * keeping.
	 */

	export let archive: Archive | null = null;
	export let query = '';

	$: trimmed = query.trim();

	$: hits = archive && trimmed !== '' ? searchPhotos(archive, trimmed) : ([] as SearchHit[]);

	$: matchedPlaces =
		archive && trimmed !== ''
			? archive.places.filter(
					(place) => place.count > 0 && place.name.toLowerCase().includes(trimmed.toLowerCase())
			  )
			: [];
</script>

{#if archive && trimmed !== ''}
	<section class="mt-8" aria-label="Zoekresultaten">
		{#if matchedPlaces.length > 0}
			<h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
				Plaatsen
			</h2>
			<ul class="mt-2 flex flex-wrap gap-2">
				{#each matchedPlaces.slice(0, 12) as place (place.id)}
					<li>
						<a
							class="inline-flex items-center gap-2 rounded-full border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 text-sm font-medium text-blue-900 dark:text-blue-200 hover:bg-blue-100"
							href="/straat/{place.id}"
						>
							{place.name}
							<span class="font-normal text-blue-700 dark:text-blue-300">{place.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		<h2 class="mt-8 text-xl font-bold text-gray-900 dark:text-gray-100">
			{hits.length === 0
				? 'Geen foto’s gevonden'
				: `${hits.length}${hits.length === 400 ? '+' : ''} foto’s`}
			<span class="font-normal text-gray-600 dark:text-gray-400">voor &ldquo;{trimmed}&rdquo;</span>
		</h2>

		{#if hits.length === 0}
			<p class="mt-3 text-gray-600 dark:text-gray-400">
				Probeer een straatnaam, een deel van een naam, of een jaartal. Het archief kent
				{archive.places.filter((place) => place.count > 0).length} plaatsen.
			</p>
		{:else}
			<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each hits as hit (hit.photo.id)}
					<PhotoCard {archive} photo={hit.photo} />
				{/each}
			</div>
		{/if}
	</section>
{/if}
