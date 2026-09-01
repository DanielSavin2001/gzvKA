<script lang="ts">
	import { SITE, summarise } from '$lib/seo';
	import Seo from '../../components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive, ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { isPerson, loadArchive, sortForDisplay, thumbUrl } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { loadCoordinates, loadStreetGeometry, locate } from '$lib/coordinates';
	import type { Approximation } from '$lib/approximations';
	import { hasCircle, loadApproximations } from '$lib/approximations';
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
	/**
	 * The researched places, which this page used not to load at all.
	 *
	 * Without them it placed every place from the register alone, so Kasteel Oude Gracht -
	 * a castle whose alias matched a 2.3 km road of the same name - got the road's midpoint,
	 * the road drawn through it in blue, and a caption reading "2259 meter lang. De ligging
	 * komt uit het officiële stratenregister." Three false statements about a house
	 * demolished in 1952.
	 */
	let approximations: Record<string, Approximation> = {};
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

		const [coordinates, streets, researched] = await Promise.all([
			loadCoordinates(),
			loadStreetGeometry(),
			loadApproximations()
		]);
		placed = coordinates.places;
		geometry = streets;
		approximations = researched;
	});

	let place: ArchivePlace | undefined;
	let photos: ArchivePhoto[] = [];

	$: place = archive?.placeById.get(data.slug);

	/**
	 * What this place sits under, and what sits under it.
	 *
	 * Absent on all 131 generated places - a curator sets it - so on nearly every page these
	 * are both empty and the page reads exactly as it did before. Where they are not, they
	 * are the whole point of the nesting: "Begin van de Dorpsstraat" tells a reader nothing
	 * unless the Dorpsstraat is one click away.
	 */
	$: parent = place?.parentId ? archive?.placeById.get(place.parentId) : undefined;
	$: children = place
		? (archive?.places ?? [])
				.filter((entry) => entry.parentId === place.id)
				.sort((a, b) => b.count - a.count)
		: [];

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

	/** Where this place actually is, and which of the three tiers answered. */
	$: at = locate(data.slug, placed, geometry, approximations);

	/**
	 * Whether the register is what positioned this place - not merely whether it holds a
	 * street of the same name.
	 *
	 * The centreline and the "2259 meter lang" only describe the place when the register is
	 * the answer. For Kasteel Oude Gracht it is not: the research outranks it, and drawing
	 * the road anyway would put a blue line through a castle it has nothing to do with.
	 */
	$: fromRegister = at?.source === 'register';

	/** The research behind this place, when a curator has not overruled it with a pin. */
	$: research = placed[data.slug] ? undefined : approximations[data.slug];

	/**
	 * Whether a circle is actually drawn, which is not the same as carrying a radius.
	 *
	 * 74 of the 91 researched places have a `radius` and no circle: `straal_m` is filled in
	 * for nearly everything, but `hasCircle` draws one only for `benadering`. Writing the
	 * caption off the radius alone promised "ergens binnen de rode cirkel" on all 74 - on
	 * Hoogboom and Kasteel Ravenhof, both grade A, both drawn as a plain point. Sending a
	 * reader to look for a ring that is not there is the same defect as drawing the ring
	 * somewhere the marker is not.
	 */
	$: circled = research ? hasCircle(research) : false;
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
		{#if parent}
			<a
				class="text-blue-800 underline hover:no-underline dark:text-blue-300"
				href="/straat/{parent.id}">{parent.name}</a
			>
			<span class="mx-2">/</span>
		{/if}
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
			<p class="py-16 text-center text-gray-600 dark:text-gray-400">Bezig met laden ...</p>
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

			{#if children.length > 0}
				<ul class="mt-3 flex flex-wrap gap-2">
					{#each children as child (child.id)}
						<li>
							<a
								class="inline-block rounded-full border border-gray-300 px-3 py-3 text-sm text-gray-800 hover:border-blue-700 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-blue-950"
								href="/straat/{child.id}"
							>
								{child.name}
								<span class="text-gray-600 dark:text-gray-400">{child.count}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
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

		{#if at && place}
			<section class="mt-6">
				<!--
					`focusId` draws the register's centreline and opens on it, so it is passed
					only when the register is what placed this - see `fromRegister`. The
					approximations go in either way: without them the map cannot draw the circle
					of doubt, and a researched place would appear here as certain as a street.
				-->
				<ArchiveMap
					{archive}
					{placed}
					{geometry}
					{approximations}
					places={[place]}
					focusId={fromRegister ? data.slug : null}
					selectedId={data.slug}
					height="320px"
					zoom={fromRegister ? 15 : 14}
				/>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					{#if fromRegister}
						{place.name} op de kaart{#if shape?.length}, {shape.length} meter lang{/if}. De ligging
						komt uit het officiële stratenregister.
					{:else if at.source === 'placed'}
						{place.name} op de kaart. De ligging is met de hand aangeduid.
					{:else if circled}
						{place.name} bij benadering op de kaart: ergens binnen de rode cirkel, ongeveer {research?.radius}
						meter rond dit punt. De ligging is opgezocht, niet uit een adres afgeleid.
					{:else if research?.display === 'punt_met_twijfel'}
						{place.name} op de kaart, maar de ligging is niet zeker. Ze is opgezocht, niet uit een adres
						afgeleid.
					{:else}
						{place.name} op de kaart. De ligging is opgezocht.
					{/if}
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
