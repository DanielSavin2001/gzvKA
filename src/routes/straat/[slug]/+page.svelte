<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive, ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import PhotoCard from '../../components/PhotoCard.svelte';

	export let data: { slug: string };

	let archive: Archive | null = null;
	let error: string | null = null;

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	let place: ArchivePlace | undefined;
	let photos: ArchivePhoto[] = [];

	$: place = archive?.placeById.get(data.slug);
	$: photos = archive?.photosByPlace.get(data.slug) ?? [];

	// Oldest first: this is a history archive, and the undated ones belong at the end.
	$: sorted = [...photos].sort((a, b) => {
		const ay = a.y ? Number(a.y) : Number.POSITIVE_INFINITY;
		const by = b.y ? Number(b.y) : Number.POSITIVE_INFINITY;
		return ay - by || (a.hn ?? 0) - (b.hn ?? 0) || a.t.localeCompare(b.t);
	});

	$: withNumbers = sorted.filter((photo) => photo.hn != null);
</script>

<svelte:head>
	<title>{place ? place.name : data.slug} | gzvKA fotoarchief</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="text-sm text-gray-600">
		<a class="text-blue-800 underline hover:no-underline" href="/">Startpagina</a>
		<span class="mx-2">/</span>
		<span>{place ? place.name : data.slug}</span>
	</nav>

	{#if error}
		<div class="my-8 rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<p class="py-16 text-center text-gray-500">Bezig met laden ...</p>
	{:else if !place}
		<div class="py-16 text-center">
			<h1 class="text-2xl font-bold text-gray-900">Deze plaats kennen we niet</h1>
			<p class="mt-2 text-gray-600">
				&ldquo;{data.slug}&rdquo; staat niet in het archief.
				<a class="text-blue-800 underline hover:no-underline" href="/">Terug naar de startpagina</a>
			</p>
		</div>
	{:else}
		<header class="mt-3">
			<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{place.name}</h1>
			<p class="mt-2 text-gray-600">
				{sorted.length}
				{sorted.length === 1 ? 'foto' : "foto's"}
				{#if place.district !== 'unknown'}&middot; {place.district}{/if}
				{#if withNumbers.length > 0}&middot; {withNumbers.length} met huisnummer{/if}
			</p>
		</header>

		{#if sorted.length === 0}
			<p class="py-12 text-gray-600">Nog geen foto's aan deze plaats gekoppeld.</p>
		{:else}
			<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each sorted as photo (photo.id)}
					<PhotoCard {archive} {photo} showSubject={false} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
