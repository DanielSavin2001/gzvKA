<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive, ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { loadArchive, sortForDisplay } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { loadCoordinates, loadStreetGeometry } from '$lib/coordinates';
	import type { StoryIndex } from '$lib/stories';
	import { loadStoryIndex, storiesForPlace } from '$lib/stories';
	import ArchiveMap from '../../components/ArchiveMap.svelte';
	import PhotoCard from '../../components/PhotoCard.svelte';

	export let data: { slug: string };

	let archive: Archive | null = null;
	let storyIndex: StoryIndex | null = null;
	let placed: Record<string, PlacedCoordinate> = {};
	let geometry: Record<string, StreetGeometry> = {};
	let error: string | null = null;

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}

		// The photographs are the page; what the old site wrote about this place is a
		// bonus on top of them, so its absence is never an error.
		try {
			storyIndex = await loadStoryIndex();
		} catch {
			storyIndex = null;
		}

		const [coordinates, streets] = await Promise.all([loadCoordinates(), loadStreetGeometry()]);
		placed = coordinates.places;
		geometry = streets;
	});

	let place: ArchivePlace | undefined;
	let photos: ArchivePhoto[] = [];

	$: place = archive?.placeById.get(data.slug);
	$: photos = archive?.photosByPlace.get(data.slug) ?? [];

	// Oldest first: this is a history archive, and the undated ones belong at the end. The
	// same order the previous/next arrows on a photograph step through.
	$: sorted = sortForDisplay(photos);

	$: withNumbers = sorted.filter((photo) => photo.hn != null);

	$: stories = storiesForPlace(storyIndex, data.slug);

	/** The street's own shape, when the official register knows it. */
	$: shape = geometry[data.slug];
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

		{#if stories.length > 0}
			<section class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
				<h2 class="text-lg font-bold text-gray-900">Wat hierover geschreven is</h2>

				<ul class="mt-3 space-y-4">
					{#each stories as story (story.slug + story.section)}
						<li>
							<a
								class="group block rounded-lg p-2 -m-2 transition hover:bg-amber-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
								href="/verhaal/{story.slug}{story.section >= 0 ? `#deel-${story.section}` : ''}"
							>
								<p class="font-semibold text-gray-900 group-hover:underline">
									{story.heading ?? story.title}
								</p>
								<p class="mt-1 text-sm leading-relaxed text-gray-700">{story.excerpt}</p>
								{#if story.heading}
									<p class="mt-1 text-xs text-gray-500">uit: {story.title}</p>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if shape}
			<section class="mt-6">
				<ArchiveMap
					{archive}
					{placed}
					{geometry}
					places={place ? [place] : []}
					focusId={data.slug}
					selectedId={data.slug}
					height="320px"
					zoom={15}
				/>
				<p class="mt-2 text-sm text-gray-500">
					{place.name} op de kaart{#if shape.length}, {shape.length} meter lang{/if}. De ligging
					komt uit het officiële stratenregister.
				</p>
			</section>
		{/if}

		{#if sorted.length === 0}
			<p class="py-12 text-gray-600">Nog geen foto's aan deze plaats gekoppeld.</p>
		{:else}
			<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each sorted as photo (photo.id)}
					<PhotoCard {archive} {photo} showSubject={false} list="straat:{data.slug}" />
				{/each}
			</div>
		{/if}
	{/if}
</div>
