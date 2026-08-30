<script lang="ts">
	import { SITE, summarise } from '$lib/seo';
	import Seo from '../../components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive, ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { isPerson, loadArchive, sortForDisplay, thumbUrl } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { loadCoordinates, loadStreetGeometry } from '$lib/coordinates';
	import type { StoryIndex } from '$lib/stories';
	import { loadStoryIndex, storiesForPlace } from '$lib/stories';
	import ArchiveMap from '../../components/ArchiveMap.svelte';
	import PhotoCard from '../../components/PhotoCard.svelte';

	import type { PlaceSummary } from '$lib/page-data';

	export let data: { slug: string; summary: PlaceSummary | null };

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

	/**
	 * The head reads from `load`, not from the archive.
	 *
	 * `place` comes out of the archive index, which is fetched in the browser and therefore
	 * absent while the page is being prerendered - so a title built from it was the raw
	 * slug in the HTML that crawlers and link previews actually receive.
	 */
	$: named = data.summary?.name ?? place?.name ?? data.slug;
	$: counted = data.summary?.count ?? place?.count ?? 0;

	/** From `load` first, so the prerendered head is right before the archive arrives. */
	$: aboutAPerson = data.summary?.person ?? (place ? isPerson(place) : false);

	$: placeDescription = !counted
		? `Foto's van ${named} in Kapellen, uit het fotoarchief van de gemeente.`
		: summarise(
				aboutAPerson
					? `${counted} foto's van ${named} uit het fotoarchief van Kapellen.`
					: `${counted} ${counted === 1 ? 'foto' : "foto's"} van ${named} in Kapellen, ` +
							'uit het fotoarchief van de gemeente.'
		  );
	$: photos = archive?.photosByPlace.get(data.slug) ?? [];

	// Oldest first: this is a history archive, and the undated ones belong at the end. The
	// same order the previous/next arrows on a photograph step through.
	$: sorted = sortForDisplay(photos);

	$: withNumbers = sorted.filter((photo) => photo.hn != null);

	$: stories = storiesForPlace(storyIndex, data.slug);

	/** The street's own shape, when the official register knows it. */
	$: shape = geometry[data.slug];
</script>

<Seo
	title={named}
	description={placeDescription}
	path="/straat/{data.slug}"
	image={data.summary?.card ?? null}
	structured={{
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: named,
		description: placeDescription,
		inLanguage: 'nl-BE',
		url: `${SITE}/straat/${data.slug}`,
		about: aboutAPerson
			? { '@type': 'Person', name: named }
			: {
					'@type': 'Place',
					name: named,
					address: {
						'@type': 'PostalAddress',
						addressLocality: 'Kapellen',
						addressCountry: 'BE'
					}
			  }
	}}
/>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 dark:text-blue-300 underline hover:no-underline" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>{place ? place.name : data.slug}</span>
	</nav>

	{#if error}
		<div
			class="my-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<!--
			The place and its photographs, from `load`, before the archive has arrived.

			This used to be the words "Bezig met laden ...", which is also all a crawler ever
			saw of the 121 pages that are the only route into the archive. The map, the
			stories and the house numbers fill in a moment later; the pictures and the links
			to them are here from the start.
		-->
		{#if data.summary}
			<header class="mt-3">
				<h1
					class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100"
				>
					{data.summary.name}
				</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					{data.summary.count}
					{data.summary.count === 1 ? 'foto' : "foto's"} uit het fotoarchief van Kapellen.
					{#if data.summary.person}&middot; persoon{/if}
				</p>
			</header>

			{#if data.summary.photos.length > 0}
				<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{#each data.summary.photos as photo (photo.id)}
						<a
							class="group block overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
							href="/foto/{photo.id}?lijst=straat:{data.slug}"
						>
							<div class="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
								<img
									src={photo.image}
									alt={photo.alt}
									loading="lazy"
									decoding="async"
									class="h-full w-full object-cover"
								/>
							</div>
							<div class="p-3">
								<h2 class="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
									{photo.title}
								</h2>
								<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
									{data.summary.name}{photo.houseNumber ? ` ${photo.houseNumber}` : ''}{photo.year
										? ` · ${photo.year}`
										: ''}
								</p>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<p class="py-12 text-gray-600 dark:text-gray-400">
					Nog geen foto's aan deze plaats gekoppeld.
				</p>
			{/if}
		{:else}
			<p class="py-16 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
		{/if}
	{:else if !place}
		<div class="py-16 text-center">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				Deze plaats kennen we niet
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				&ldquo;{data.slug}&rdquo; staat niet in het archief.
				<a class="text-blue-800 dark:text-blue-300 underline hover:no-underline" href="/"
					>Terug naar de startpagina</a
				>
			</p>
		</div>
	{:else}
		<header class="mt-3">
			<h1
				class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl"
			>
				{place.name}
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				{sorted.length}
				{sorted.length === 1 ? 'foto' : "foto's"}
				{#if isPerson(place)}
					<!--
						A person has no district and no house numbers. "Tajje de Kotter" was filed
						among the buildings, so this line offered a parish and a count of house
						numbers for a man.
					-->
					&middot; persoon
				{:else}
					{#if place.district !== 'unknown'}&middot; {place.district}{/if}
					{#if withNumbers.length > 0}&middot; {withNumbers.length} met huisnummer{/if}
				{/if}
			</p>
		</header>

		{#if stories.length > 0}
			<section
				class="mt-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 p-5 sm:p-6"
			>
				<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
					Wat hierover geschreven is
				</h2>

				<ul class="mt-3 space-y-4">
					{#each stories as story (story.slug + story.section)}
						<li>
							<a
								class="group block rounded-lg p-2 -m-2 transition hover:bg-amber-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
								href="/verhaal/{story.slug}{story.section >= 0 ? `#deel-${story.section}` : ''}"
							>
								<p class="font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">
									{story.heading ?? story.title}
								</p>
								<p class="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
									{story.excerpt}
								</p>
								{#if story.heading}
									<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">uit: {story.title}</p>
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
				<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
					{place.name} op de kaart{#if shape.length}, {shape.length} meter lang{/if}. De ligging
					komt uit het officiële stratenregister.
				</p>
			</section>
		{/if}

		{#if sorted.length === 0}
			<p class="py-12 text-gray-600 dark:text-gray-400">
				Nog geen foto's aan deze plaats gekoppeld.
			</p>
		{:else}
			<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each sorted as photo (photo.id)}
					<PhotoCard {archive} {photo} showSubject={false} list="straat:{data.slug}" />
				{/each}
			</div>
		{/if}
	{/if}
</div>
