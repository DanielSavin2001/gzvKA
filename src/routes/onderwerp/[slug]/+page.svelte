<script lang="ts">
	import type { SubjectSummary } from '$lib/page-data';
	import PlaceMap from '../../components/PlaceMap.svelte';
	import Seo from '../../components/Seo.svelte';

	/**
	 * Everything in one subject folder.
	 *
	 * Rendered entirely from `load`, like the donor page it is modelled on: no archive fetch,
	 * no `onMount`. These pages exist to be a way into the archive for photographs that have
	 * no other way in, and a way in that waits on a 1.1 MB download is not one.
	 */

	export let data: { slug: string; summary: SubjectSummary };

	$: summary = data.summary;

	/**
	 * The list the arrows walk, matched on the folder NAME.
	 *
	 * `?lijst=onderwerp:` is compared against `photo.s` on the photo page, which holds the
	 * folder name and not the slug. Emitting the slug here would leave the arrows with
	 * nothing to walk - no error, no warning, they would just fall back to the photograph's
	 * street and the counter would name a different list.
	 */
	$: walk = `onderwerp:${summary.name}`;

	/** The map earns its place only when the photographs are actually spread over places. */
	$: mapWorthIt = summary.places.length >= 2;
</script>

<Seo
	title={summary.name}
	description="{summary.count} foto's uit het fotoarchief van Kapellen onder het onderwerp {summary.name}."
	path="/onderwerp/{data.slug}"
	image={summary.card ?? undefined}
/>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/onderwerpen"
			>Onderwerpen</a
		>
		<span class="mx-2">/</span>
		<span>{summary.name}</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			{summary.name}
		</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">
			{summary.count}
			{summary.count === 1 ? 'foto' : "foto's"}
			{#if summary.placeless > 0}
				&middot; {summary.placeless} daarvan staan op geen enkele kaart
			{/if}
		</p>
	</header>

	{#if mapWorthIt}
		<div class="mt-8">
			<PlaceMap
				places={summary.places}
				noun="plaatsen"
				title="Waar deze foto's genomen zijn"
				intro="Alleen de foto's uit deze map waarvan het archief de plaats kent."
				height="380px"
			/>
		</div>
	{/if}

	<div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each summary.photos as photo (photo.id)}
			<a
				class="group block overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
				href="/foto/{photo.id}?lijst={encodeURIComponent(walk)}"
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
		Weet u meer over deze foto's? Op elke fotopagina staat een vakje voor het jaartal, en
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/upload"
			>eigen foto's zijn welkom</a
		>.
	</p>
</div>
