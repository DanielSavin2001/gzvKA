<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import type { Story } from '$lib/stories';
	import { formatBytes, loadStory, readingMinutes } from '$lib/stories';
	import StoryBody from '../../components/StoryBody.svelte';

	export let data: { slug: string };

	let archive: Archive | null = null;
	let story: Story | null = null;
	let error: string | null = null;

	onMount(async () => {
		// The story is what this page is for; the archive only turns its photograph
		// references into pictures. A failure to load the archive must not blank the text.
		const [storyResult, archiveResult] = await Promise.allSettled([
			loadStory(data.slug),
			loadArchive()
		]);

		if (storyResult.status === 'fulfilled') story = storyResult.value;
		else error = 'Dit verhaal konden we niet vinden.';

		if (archiveResult.status === 'fulfilled') archive = archiveResult.value;
	});

	$: places = story
		? story.places
				.map((id) => archive?.placeById.get(id))
				.filter((place): place is NonNullable<typeof place> => place !== undefined)
		: [];

	$: prose = story
		? story.sections.reduce(
				(sum, section) =>
					sum +
					section.parts.reduce(
						(n, part) => n + (part.k === 'p' && !part.credit ? part.t.length : 0),
						0
					),
				0
		  )
		: 0;

	$: photoCount = story
		? story.sections.reduce(
				(sum, section) => sum + section.parts.filter((part) => part.k === 'i').length,
				0
		  )
		: 0;
</script>

<svelte:head>
	<title>{story ? story.title : 'Verhaal'} | gzvKA fotoarchief</title>
	{#if story}
		<meta name="description" content={story.title} />
	{/if}
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<nav class="text-sm text-gray-600">
		<a class="text-blue-800 underline hover:no-underline" href="/">Startpagina</a>
		<span class="mx-2">/</span>
		<a class="text-blue-800 underline hover:no-underline" href="/verhalen">Verhalen</a>
	</nav>

	{#if error}
		<div class="my-8 rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">{error}</p>
			<a class="mt-2 inline-block underline hover:no-underline" href="/verhalen">
				Bekijk alle verhalen
			</a>
		</div>
	{:else if !story}
		<p class="py-16 text-center text-gray-500">Bezig met laden ...</p>
	{:else}
		<header class="mt-3 border-b border-gray-200 pb-6">
			<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
				{story.title}
			</h1>
			<p class="mt-3 text-sm text-gray-600">
				{#if prose > 0}
					{readingMinutes(prose)} min lezen
				{/if}
				{#if photoCount > 0}
					&middot; {photoCount}
					{photoCount === 1 ? 'foto' : "foto's"}
				{/if}
				&middot; overgenomen van de oude gzvka.be
			</p>

			{#if places.length > 0}
				<ul class="mt-4 flex flex-wrap gap-2">
					{#each places as place (place.id)}
						<li>
							<a
								class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-800 transition hover:border-blue-700 hover:bg-blue-50"
								href="/straat/{place.id}"
							>
								{place.name}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</header>

		{#if story.documents && story.documents.length > 0}
			<section class="mt-6 rounded-xl border border-gray-300 bg-gray-50 p-5">
				<h2 class="text-lg font-bold text-gray-900">
					{story.documents.length === 1 ? 'Document bij deze pagina' : 'Documenten bij deze pagina'}
				</h2>
				<ul class="mt-3 space-y-2">
					{#each story.documents as document (document.url)}
						<li>
							<a
								class="inline-flex items-center gap-2 font-medium text-blue-800 underline hover:no-underline"
								href={document.url}
								download
							>
								{document.name}
								<span class="text-sm font-normal text-gray-500"
									>({formatBytes(document.bytes)})</span
								>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<article class="pb-12">
			<StoryBody {archive} sections={story.sections} />
		</article>

		<footer class="border-t border-gray-200 py-6 text-sm text-gray-600">
			<p>
				Deze tekst komt van de oorspronkelijke website gzvka.be en is hier ongewijzigd overgenomen.
				De bronpagina is bewaard als
				<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">legacy-site/{story.source}</code>.
			</p>
		</footer>
	{/if}
</div>
