<script lang="ts">
	import PlaceMap from '../components/PlaceMap.svelte';
	import Seo from '../components/Seo.svelte';

	import type { MappablePlace } from '$lib/page-data';
	import type { StoryIndex } from '$lib/stories';
	import { contestStories, historyStories, readingMinutes, storiesForPlace } from '$lib/stories';

	export let data: { index: StoryIndex; places: MappablePlace[] };

	/**
	 * The stories come from `load`, which is what lets this page be prerendered - the list
	 * is in the HTML a crawler receives instead of arriving after it has already been
	 * served. It is the only route to 101 stories, so it has to be a real list of links.
	 */
	$: index = data.index;

	$: stories = historyStories(index);
	$: contests = contestStories(index);
	$: totalProse = stories.reduce((sum, story) => sum + story.prose, 0);
</script>

<Seo
	title="Verhalen uit Kapellen"
	description="De verhalen van de oude gzvka.be: de geschiedenis van de kastelen, de cafés, de straten en de mensen van Kapellen."
	path="/verhalen"
/>

<div class="mx-auto max-w-5xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 dark:text-blue-300 underline hover:no-underline" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Verhalen</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
			Verhalen uit Kapellen
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Bij de foto's hoort een verhaal. Deze teksten stonden op de oude website en zijn hier bewaard:
			de geschiedenis van de kastelen, de cafés en de straten, en de herinneringen van wie er
			opgroeide.
		</p>
	</header>

	{#if stories.length === 0}
		<p class="py-16 text-center text-gray-500 dark:text-gray-400">Er zijn nog geen verhalen.</p>
	{:else}
		<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
			{stories.length} verhalen &middot; {Math.round(totalProse / 1000)}.000 tekens
		</p>

		{#if data.places.length > 0}
			<!--
				Where the writing is about, rather than only what it is called. A title like
				"Kasteel Oude Gracht" means nothing to somebody who did not grow up here, and
				this is a page of a hundred such titles; the map turns it into a place you
				recognise the corner of.

				The number in a bubble counts photographs here as it does on every other map on
				the site - a marker that meant photographs on one page and paragraphs on the
				next would mean nothing on either. The panel is where the writing is listed.
			-->
			<div class="mt-8">
				<PlaceMap
					places={data.places}
					noun="plaatsen"
					title="Waar de verhalen over gaan"
					intro="De plekken waarover de oude website schreef."
					height="460px"
					zoom={12.2}
					id="kaart"
				>
					<div slot="panel" let:place>
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{place.name}</h3>
							<a
								class="text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
								href="/straat/{place.id}"
							>
								{place.count}
								{place.count === 1 ? 'foto' : "foto's"} van deze plek &rarr;
							</a>
						</div>

						{#if storiesForPlace(index, place.id).length === 0}
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								Hier is nog niets over geschreven.
							</p>
						{:else}
							<ul class="mt-3 space-y-3">
								{#each storiesForPlace(index, place.id) as story (story.slug + story.section)}
									<li>
										<a
											class="group block rounded-lg -m-2 p-2 transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-blue-950"
											href="/verhaal/{story.slug}{story.section >= 0
												? `#deel-${story.section}`
												: ''}"
										>
											<p
												class="font-semibold text-gray-900 group-hover:underline dark:text-gray-100"
											>
												{story.heading ?? story.title}
											</p>
											<p class="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
												{story.excerpt}
											</p>
											{#if story.heading}
												<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
													uit: {story.title}
												</p>
											{/if}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</PlaceMap>
			</div>
		{/if}

		<h2 class="mt-10 border-t border-gray-200 pt-8 text-2xl font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100">
			Alle verhalen
		</h2>

		<ul class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each stories as story (story.slug)}
				<li>
					<a
						class="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 transition hover:border-blue-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
						href="/verhaal/{story.slug}"
					>
						<h2 class="text-lg font-bold leading-snug text-gray-900 dark:text-gray-100">
							{story.title}
						</h2>
						<p class="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
							{story.excerpt}
						</p>
						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							{readingMinutes(story.prose)} min lezen
							{#if story.photos > 0}
								&middot; {story.photos}
								{story.photos === 1 ? 'foto' : "foto's"}
							{/if}
						</p>
					</a>
				</li>
			{/each}
		</ul>

		{#if contests.length > 0}
			<section class="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					Wedstrijden en zoektochten
				</h2>
				<p class="mt-1 text-gray-600 dark:text-gray-400">
					Pagina's over de eigen wedstrijden van de vereniging, bewaard zoals ze waren.
				</p>
				<ul class="mt-4 flex flex-wrap gap-2">
					{#each contests as story (story.slug)}
						<li>
							<a
								class="inline-block rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 transition hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
								href="/verhaal/{story.slug}"
							>
								{story.title}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>
