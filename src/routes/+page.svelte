<script lang="ts">
	import { copy } from '$lib/site-copy';
	import { blocks } from '$lib/site-layout';
	import Seo from './components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive, placesWithPhotos } from '$lib/archive';
	import type { StoryIndex } from '$lib/stories';
	import { historyStories, loadStoryIndex, readingMinutes } from '$lib/stories';
	import MapExplorer from './components/MapExplorer.svelte';
	import PlaceList from './components/PlaceList.svelte';
	import PhotoCard from './components/PhotoCard.svelte';
	import SearchBox from './components/SearchBox.svelte';
	import SearchResults from './components/SearchResults.svelte';

	import type { ArchiveSummary } from '$lib/page-data';

	export let data: { summary: ArchiveSummary; stories: StoryIndex | null };

	let archive: Archive | null = null;
	// Seeded from `load` so the four featured stories are links in the prerendered HTML
	// rather than appearing once the browser has fetched the index for itself.
	let storyIndex: StoryIndex | null = data.stories;
	let error: string | null = null;

	/** What is being searched for. Empty means the page shows itself rather than results. */
	let query = '';

	onMount(async () => {
		// A shared link still works: /?q=kapelsestraat opens on that search. Read from
		// `window` rather than the page store, because this page is prerendered and
		// SvelteKit rightly refuses to let a prerendered page depend on a query string.
		query = new URLSearchParams(window.location.search).get('q') ?? '';

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

	/**
	 * Keeps the address bar in step without navigating.
	 *
	 * `history.replaceState` rather than `goto`, so the page never re-runs its load and the
	 * prerendered home page keeps no dependency on the query string - which is what made
	 * search a separate route in the first place.
	 */
	function searchFor(term: string): void {
		query = term;

		const url = new URL(window.location.href);
		if (term) url.searchParams.set('q', term);
		else url.searchParams.delete('q');

		history.replaceState(history.state, '', url);
	}

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

<Seo
	title="Ge zijt van Kapellen als ge ..."
	description={archive
		? `Het fotoarchief van Kapellen: ${archive.imageCount.toLocaleString(
				'nl-BE'
		  )} foto's van straten, kastelen, mensen en momenten, doorzoekbaar per straat en op de kaart.`
		: "Het fotoarchief van Kapellen: duizenden foto's van straten, kastelen, mensen en momenten, doorzoekbaar per straat."}
	path="/"
	structured={{
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'gzvKA fotoarchief',
		alternateName: 'Ge zijt van Kapellen als ge ...',
		url: 'https://gzvka.com',
		inLanguage: 'nl-BE',
		description: 'Fotoarchief van Kapellen, België.',
		potentialAction: {
			'@type': 'SearchAction',
			target: { '@type': 'EntryPoint', urlTemplate: 'https://gzvka.com/?q={search_term_string}' },
			'query-input': 'required name=search_term_string'
		}
	}}
/>

<div class="mx-auto max-w-7xl px-4">
	<section class="py-10 text-center sm:py-14">
		<h1
			class="mx-auto max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl lg:text-5xl"
		>
			{$copy('index.title')}
		</h1>
		<p class="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
			{#if archive}
				{archive.imageCount.toLocaleString('nl-BE')} foto's van bijzondere plekken, mensen en momenten.
				Zoek op straat, op naam of op jaartal.
			{:else}
				Duizenden foto's van bijzondere plekken, mensen en momenten uit Kapellen.
			{/if}
		</p>

		<div class="mx-auto mt-8 max-w-2xl">
			<SearchBox {archive} bind:value={query} on:search={(event) => searchFor(event.detail)} />
		</div>

		{#if archive}
			<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
				Bijvoorbeeld:
				<a
					class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
					href="/straat/kapelsestraat">Kapelsestraat</a
				>,
				<a
					class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
					href="/straat/dorpsstraat">Dorpsstraat</a
				>,
				<a
					class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
					href="/straat/hoevensebaan">Hoevensebaan</a
				>
			</p>
		{/if}
	</section>

	<SearchResults {archive} {query} />

	{#if query.trim()}
		<!-- Searching: the answer is above, and the browse lists would only bury it. -->
	{:else if error}
		<div
			class="my-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else}
		<!--
			The blocks of the front page, in the order the curators put them.

			`$blocks('/')` is the shipped order until the overlay lands, so the prerendered
			HTML carries the page as it was designed; an id the page does not know is simply
			not rendered, so no arrangement can produce a page that does not draw. An
			`{#if}` chain rather than a component map, because that keeps every block exactly
			the markup it was - the map is still the map, with its own data and its own
			clustering.

			The archive check lives inside the blocks rather than around them. Before it
			arrives, the two place lists are drawn from `load` data: they are the only links
			out of the home page, and a crawler that got a heading, an unusable search box
			and no route to any of the 131 places was the bug that put them there.
		-->
		{#each $blocks('/') as block (block)}
			{#if block === 'index.kaart'}
				<!--
					The map is the front page. It loads its own data, so it does not wait on
					the archive, and its `id="kaart"` anchor - which the menu links at - is in
					the prerendered HTML.
				-->
				<div class="pb-8">
					<MapExplorer />
				</div>
			{:else if block === 'index.straten' && !archive}
				<section class="py-8">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{$copy('index.straten-kop')}
					</h2>
					<p class="mt-1 text-gray-600 dark:text-gray-400">
						{data.summary.streets.length} straten en pleinen met foto's in het archief.
					</p>

					<PlaceList places={data.summary.streets} noun="straten" />
				</section>
			{:else if block === 'index.gebieden' && !archive && data.summary.areas.length > 0}
				<section class="border-t border-gray-200 py-8 dark:border-gray-700">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{$copy('index.gebieden-kop')}
					</h2>
					<PlaceList places={data.summary.areas} noun="plaatsen" />
				</section>
			{:else if block === 'index.straten'}
				<section class="py-8">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{$copy('index.straten-kop')}
					</h2>
					<p class="mt-1 text-gray-600 dark:text-gray-400">
						{streets.length} straten en pleinen met foto's in het archief.
					</p>

					<PlaceList places={streets} noun="straten" />
				</section>
			{:else if block === 'index.gebieden' && archive}
				<section class="py-8">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						Wijken, kastelen en gebouwen
					</h2>
					<PlaceList places={areas} noun="plaatsen" />
				</section>
			{:else if block === 'index.verhalen' && archive && stories.length > 0}
				<section class="py-8">
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
								Verhalen bij de foto's
							</h2>
							<p class="mt-1 text-gray-600 dark:text-gray-400">
								De teksten van de oude website: de geschiedenis van de kastelen, de caf&eacute;s en
								de straten, en de herinneringen van wie er opgroeide.
							</p>
						</div>
						<a
							class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold text-gray-800 dark:text-gray-200 hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
							href="/verhalen"
						>
							Alle verhalen
						</a>
					</div>

					<ul class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each stories as story (story.slug)}
							<li>
								<a
									class="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-left transition hover:border-blue-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
									href="/verhaal/{story.slug}"
								>
									<h3 class="text-lg font-bold leading-snug text-gray-900 dark:text-gray-100">
										{story.title}
									</h3>
									<p class="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
										{story.excerpt}
									</p>
									<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
										{readingMinutes(story.prose)} min lezen
									</p>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{:else if block === 'index.greep' && archive}
				<section class="py-8">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						Een greep uit het archief
					</h2>
					<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
						{#each featured as photo (photo.id)}
							<PhotoCard {archive} {photo} />
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>
