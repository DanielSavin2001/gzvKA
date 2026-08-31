<script lang="ts">
	import type { DonorSummary } from '$lib/page-data';
	import { SITE } from '$lib/seo';
	import PlaceMap from '../../components/PlaceMap.svelte';
	import Seo from '../../components/Seo.svelte';

	export let data: { slug: string; summary: DonorSummary | null };

	$: summary = data.summary;

	/**
	 * The dozen places this collection holds most of, as chips under the heading.
	 *
	 * The summary carries all of them because the map below draws from the same list, but a
	 * heading followed by forty chips is a wall rather than a summary.
	 */
	$: chips = (summary?.places ?? []).slice(0, 12);

	/**
	 * A map is worth the space once a collection covers more than one place.
	 *
	 * With a single place it says exactly what the chip above it already says, at the cost of
	 * half a screen and a tile download. With two or more it starts saying something the list
	 * cannot: that this collection is of one corner of Kapellen, or of all of it. 127 of the
	 * 295 donor pages clear the bar.
	 */
	$: mapWorthIt = (summary?.places.length ?? 0) >= 2;

	$: description = summary
		? `${summary.name} gaf ${summary.count} ${
				summary.count === 1 ? 'foto' : "foto's"
		  } aan het fotoarchief van Kapellen${summary.span ? `, uit ${summary.span}` : ''}.`
		: 'Deze schenker staat niet in het archief.';
</script>

<Seo
	title={summary ? summary.name : 'Schenker'}
	{description}
	path="/schenker/{data.slug}"
	image={summary?.card ?? null}
	structured={summary
		? {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: summary.name,
				description,
				inLanguage: 'nl-BE',
				url: `${SITE}/schenker/${data.slug}`,
				// The person is what this page is about; the photographs are the collection.
				// Deliberately no address, birth date or anything else: the archive knows a
				// name and a set of photographs, and inventing the rest of a living person's
				// record into structured data would be a different thing entirely.
				about: { '@type': 'Person', name: summary.name }
		  }
		: undefined}
/>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/schenker"
			>Schenkers</a
		>
		<span class="mx-2">/</span>
		<span>{summary ? summary.name : data.slug}</span>
	</nav>

	{#if !summary}
		<div
			class="my-8 rounded-lg border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="font-semibold text-gray-900 dark:text-gray-100">Deze schenker kennen we niet</p>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Misschien is de naam veranderd. <a
					class="text-blue-800 underline hover:no-underline dark:text-blue-300"
					href="/schenker">Bekijk alle schenkers</a
				>.
			</p>
		</div>
	{:else}
		<header class="mt-3">
			<h1
				class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100"
			>
				{summary.name}
			</h1>
			<p class="mt-3 text-lg text-gray-600 dark:text-gray-400">
				gaf {summary.count}
				{summary.count === 1 ? 'foto' : "foto's"} aan het archief{summary.span
					? `, uit ${summary.span}`
					: ''}.
			</p>

			{#if summary.places.length > 0}
				<!--
					What the pictures are of, not just how many. A grid says how much somebody
					gave; this says what they kept pictures of, which is the more human fact -
					and, unlike "what they photographed", it is one the archive actually knows.
				-->
				<div class="mt-4 flex flex-wrap gap-2">
					{#each chips as place (place.id)}
						<a
							class="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-800 hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-blue-950"
							href="/straat/{place.id}"
						>
							{place.name}
							<span class="text-gray-500 dark:text-gray-400">{place.count}</span>
						</a>
					{/each}
				</div>
			{/if}
		</header>

		{#if mapWorthIt}
			<!--
				Which Kapellen this collection is of.

				Not "waar X fotografeerde", which was the first wording and says something the
				archive does not know. A schenker is whoever handed the photographs over: a
				great many of them are postcards, or family pictures from a generation before
				the person who kept them. The page's own heading says "gaf", and the map has to
				agree with it - naming somebody as the photographer of a 1907 postcard is the
				kind of invented fact this archive exists not to make.

				The bubbles count the photographs in this collection, not the archive's total
				for the place - on this page that is the number worth showing, and both the
				legend and the panel say so rather than leaving a reader to assume otherwise.
			-->
			<div class="mt-8">
				<PlaceMap
					places={summary.places}
					noun="plaatsen"
					counting="foto's uit deze schenking"
					title="De plekken in de collectie van {summary.name}"
					height="420px"
					zoom={12.4}
				>
					<!--
						The panel is written out here rather than left to the default, which
						offers "alle N foto's" of the place. On this page N is this person's
						photographs of it, and the place itself usually holds many more.
					-->
					<div slot="panel" let:place class="flex flex-wrap items-baseline justify-between gap-2">
						<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
							{place.name}
							<span class="font-normal text-gray-600 dark:text-gray-400">
								&middot; {place.count}
								{place.count === 1 ? 'foto' : "foto's"} uit deze schenking
							</span>
						</h3>
						<a
							class="text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
							href="/straat/{place.id}"
						>
							Alles wat het archief van deze plek heeft &rarr;
						</a>
					</div>
				</PlaceMap>
			</div>
		{/if}

		<div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each summary.photos as photo (photo.id)}
				<a
					class="group block overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
					href="/foto/{photo.id}?lijst=schenker:{data.slug}"
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
						{#if photo.year}
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{photo.year}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-10 text-sm text-gray-600 dark:text-gray-400">
			Heb jij ook foto's van Kapellen?
			<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/upload"
				>Stuur ze in</a
			>.
		</p>
	{/if}
</div>
