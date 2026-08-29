<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	import type { Archive, SearchHit } from '$lib/archive';
	import { loadArchive, searchPhotos } from '$lib/archive';
	import PhotoCard from '../components/PhotoCard.svelte';
	import SearchBox from '../components/SearchBox.svelte';

	let archive: Archive | null = null;
	let error: string | null = null;
	let query = '';

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// Keep the box in step with the URL, so a shared link and the back button both work.
	$: query = $page.url.searchParams.get('q') ?? '';

	let hits: SearchHit[] = [];
	$: hits = archive && query.trim() !== '' ? searchPhotos(archive, query) : [];

	$: matchedPlaces =
		archive && query.trim() !== ''
			? archive.places.filter(
					(place) =>
						place.count > 0 && place.name.toLowerCase().includes(query.trim().toLowerCase())
			  )
			: [];
</script>

<svelte:head>
	<title>{query ? `${query} - zoeken` : 'Zoeken'} | gzvKA fotoarchief</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="mx-auto max-w-2xl">
		<SearchBox {archive} value={query} autofocus />
	</div>

	{#if error}
		<div class="my-8 rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<p class="py-16 text-center text-gray-500">Bezig met laden ...</p>
	{:else if query.trim() === ''}
		<p class="py-16 text-center text-gray-500">
			Typ iets om te zoeken in {archive.imageCount} foto's.
		</p>
	{:else}
		{#if matchedPlaces.length > 0}
			<div class="mt-8">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Plaatsen</h2>
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each matchedPlaces.slice(0, 12) as place (place.id)}
						<li>
							<a
								class="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100"
								href="/straat/{place.id}"
							>
								{place.name}
								<span class="font-normal text-blue-700">{place.count}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<h2 class="mt-8 text-xl font-bold text-gray-900">
			{hits.length === 0
				? 'Geen foto’s gevonden'
				: `${hits.length}${hits.length === 400 ? '+' : ''} foto’s`}
			<span class="font-normal text-gray-600">voor &ldquo;{query}&rdquo;</span>
		</h2>

		{#if hits.length === 0}
			<p class="mt-3 text-gray-600">
				Probeer een straatnaam, een deel van een naam, of een jaartal. Het archief kent
				{archive.places.filter((p) => p.count > 0).length} plaatsen.
			</p>
		{:else}
			<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each hits as hit (hit.photo.id)}
					<PhotoCard {archive} photo={hit.photo} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
