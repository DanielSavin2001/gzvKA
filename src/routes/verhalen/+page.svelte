<script lang="ts">
	import { onMount } from 'svelte';

	import type { StoryIndex } from '$lib/stories';
	import { contestStories, historyStories, loadStoryIndex, readingMinutes } from '$lib/stories';

	let index: StoryIndex | null = null;
	let error: string | null = null;

	onMount(async () => {
		try {
			index = await loadStoryIndex();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	$: stories = historyStories(index);
	$: contests = contestStories(index);
	$: totalProse = stories.reduce((sum, story) => sum + story.prose, 0);
</script>

<svelte:head>
	<title>Verhalen uit Kapellen | gzvKA fotoarchief</title>
	<meta
		name="description"
		content="De verhalen van de oude gzvka.be: de geschiedenis van de kastelen, de cafés, de straten en de mensen van Kapellen."
	/>
</svelte:head>

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

	{#if error}
		<div
			class="my-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">De verhalen konden niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !index}
		<p class="py-16 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
	{:else}
		<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
			{stories.length} verhalen &middot; {Math.round(totalProse / 1000)}.000 tekens
		</p>

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
