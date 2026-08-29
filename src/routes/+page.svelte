<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive, placesWithPhotos } from '$lib/archive';
	import type { StoryIndex } from '$lib/stories';
	import { historyStories, loadStoryIndex, readingMinutes } from '$lib/stories';
	import MapExplorer from './components/MapExplorer.svelte';
	import PhotoCard from './components/PhotoCard.svelte';
	import SearchBox from './components/SearchBox.svelte';

	let archive: Archive | null = null;
	let storyIndex: StoryIndex | null = null;
	let error: string | null = null;

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}

		try {
			storyIndex = await loadStoryIndex();
		} catch {
			storyIndex = null; // the archive is the page; the writing is an extra on top of it
		}
	});

	$: streets = archive ? placesWithPhotos(archive, true) : [];
	$: areas = archive
		? placesWithPhotos(archive).filter((place) => !place.isStreet && place.count >= 8)
		: [];

	/**
	 * A varied handful, to show what the archive holds. One photograph per subject rather
	 * than the first twelve in path order, which came from a single album and made the
	 * whole archive look like one street party.
	 */
	$: featured = archive ? pickVaried(archive, 12) : [];

	// The longest pieces first: those are the ones worth putting in front of a visitor.
	$: stories = historyStories(storyIndex).slice(0, 4);

	function pickVaried(loaded: Archive, wanted: number) {
		const seenSubjects = new Set<string>();
		const chosen = [];

		for (const photo of loaded.photos) {
			if (photo.ev || photo.st.length === 0) continue;
			if (seenSubjects.has(photo.s)) continue;

			seenSubjects.add(photo.s);
			chosen.push(photo);
			if (chosen.length === wanted) break;
		}

		return chosen;
	}
</script>

<svelte:head>
	<title>Ge zijt van Kapellen als ge ... - fotoarchief</title>
	<meta
		name="description"
		content="Het fotoarchief van Kapellen: duizenden foto's van straten, kastelen, mensen en momenten, doorzoekbaar per straat."
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-4">
	<section class="py-10 text-center sm:py-14">
		<h1
			class="mx-auto max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl lg:text-5xl"
		>
			Het fotoarchief van Kapellen
		</h1>
		<p class="mx-auto mt-4 max-w-2xl text-lg text-gray-600 sm:text-xl">
			{#if archive}
				{archive.imageCount.toLocaleString('nl-BE')} foto's van bijzondere plekken, mensen en momenten.
				Zoek op straat, op naam of op jaartal.
			{:else}
				Duizenden foto's van bijzondere plekken, mensen en momenten uit Kapellen.
			{/if}
		</p>

		<div class="mx-auto mt-8 max-w-2xl">
			<SearchBox {archive} />
		</div>

		{#if archive}
			<p class="mt-4 text-sm text-gray-500">
				Bijvoorbeeld:
				<a class="text-blue-800 underline hover:no-underline" href="/straat/kapelsestraat"
					>Kapelsestraat</a
				>,
				<a class="text-blue-800 underline hover:no-underline" href="/straat/dorpsstraat"
					>Dorpsstraat</a
				>,
				<a class="text-blue-800 underline hover:no-underline" href="/straat/hoevensebaan"
					>Hoevensebaan</a
				>
			</p>
		{/if}
	</section>

	<!--
		The map is the front page. It loads its own data, so it sits outside the archive
		check - and outside it the `id="kaart"` anchor exists in the prerendered HTML, which
		is what the menu link points at.
	-->
	<div class="pb-8">
		<MapExplorer />
	</div>

	{#if error}
		<div class="my-8 rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<div class="py-16 text-center text-gray-500">Bezig met laden van het archief ...</div>
	{:else}
		<section class="py-8">
			<h2 class="text-2xl font-bold text-gray-900">Straten van Kapellen</h2>
			<p class="mt-1 text-gray-600">
				{streets.length} straten en pleinen met foto's in het archief.
			</p>

			<ul class="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each streets as street (street.id)}
					<li>
						<a
							class="flex items-baseline justify-between gap-3 rounded px-2 py-1.5 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							href="/straat/{street.id}"
						>
							<span class="font-medium text-gray-900">{street.name}</span>
							<span class="shrink-0 text-sm tabular-nums text-gray-500">{street.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<section class="py-8">
			<h2 class="text-2xl font-bold text-gray-900">Wijken, kastelen en gebouwen</h2>
			<ul class="mt-5 flex flex-wrap gap-2">
				{#each areas as place (place.id)}
					<li>
						<a
							class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							href="/straat/{place.id}"
						>
							{place.name}
							<span class="text-gray-500">{place.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		{#if stories.length > 0}
			<section class="py-8">
				<div class="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 class="text-2xl font-bold text-gray-900">Verhalen bij de foto's</h2>
						<p class="mt-1 text-gray-600">
							De teksten van de oude website: de geschiedenis van de kastelen, de caf&eacute;s en de
							straten, en de herinneringen van wie er opgroeide.
						</p>
					</div>
					<a
						class="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-800 hover:border-blue-700 hover:bg-blue-50"
						href="/verhalen"
					>
						Alle verhalen
					</a>
				</div>

				<ul class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each stories as story (story.slug)}
						<li>
							<a
								class="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-blue-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
								href="/verhaal/{story.slug}"
							>
								<h3 class="text-lg font-bold leading-snug text-gray-900">{story.title}</h3>
								<p class="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{story.excerpt}</p>
								<p class="mt-3 text-xs text-gray-500">{readingMinutes(story.prose)} min lezen</p>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="py-8">
			<h2 class="text-2xl font-bold text-gray-900">Een greep uit het archief</h2>
			<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each featured as photo (photo.id)}
					<PhotoCard {archive} {photo} />
				{/each}
			</div>
		</section>
	{/if}
</div>
