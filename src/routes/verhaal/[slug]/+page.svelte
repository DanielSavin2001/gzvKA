<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import type { Story } from '$lib/stories';
	import { formatBytes, loadStory, readingMinutes } from '$lib/stories';
	import Lightbox from '../../components/Lightbox.svelte';
	import type { LightboxItem } from '../../components/Lightbox.svelte';
	import StoryBody from '../../components/StoryBody.svelte';

	export let data: { slug: string };

	let archive: Archive | null = null;
	let story: Story | null = null;
	let error: string | null = null;

	/** Which photograph the lightbox is showing, as an index into `photos`. -1 is closed. */
	let openPhoto = -1;

	/** The section the reader is currently in, for the contents list. */
	let activeSection = 0;

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

	/**
	 * Every photograph in the story, in the order it appears, so the lightbox can walk the
	 * whole piece rather than only the run the reader happened to click in.
	 */
	$: photos = ((): LightboxItem[] => {
		if (!story || !archive) return [];

		const found: LightboxItem[] = [];
		for (const section of story.sections) {
			for (const part of section.parts) {
				if (part.k !== 'i' || !part.id) continue;
				const photo = archive.photoById.get(part.id);
				if (photo) found.push(part.c ? { photo, caption: part.c } : { photo });
			}
		}
		return found;
	})();

	/** Where each photograph sits in that list, so a click can open the right one. */
	$: photoOffsets = new Map(photos.map((item, i) => [item.photo.id, i]));

	/** Only the sections worth listing: an untitled preamble is not a chapter. */
	$: contents = story
		? story.sections
				.map((section, index) => ({ index, heading: section.heading, kicker: section.kicker }))
				.filter((entry) => entry.heading)
		: [];

	/**
	 * A contents list earns its place once a story has a handful of parts. "Indrukken uit
	 * mijn jeugdjaren" has 59, and without one the only way to reach the fortieth is to
	 * scroll past thirty-nine.
	 */
	$: showContents = contents.length >= 3;

	onMount(() => {
		// Highlights the part being read. `IntersectionObserver` rather than a scroll handler
		// so a 59-section page does not run layout maths on every frame.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const index = Number(entry.target.id.replace('deel-', ''));
					if (Number.isFinite(index)) activeSection = index;
				}
			},
			{ rootMargin: '-20% 0px -70% 0px' }
		);

		// The sections only exist once the story has rendered.
		const attach = setInterval(() => {
			const found = document.querySelectorAll('section[id^="deel-"]');
			if (found.length === 0) return;
			for (const element of found) observer.observe(element);
			clearInterval(attach);
		}, 200);

		return () => {
			clearInterval(attach);
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title>{story ? story.title : 'Verhaal'} | gzvKA fotoarchief</title>
	{#if story}
		<meta name="description" content={story.title} />
	{/if}
</svelte:head>

{#if archive && photos.length > 0}
	<Lightbox
		{archive}
		items={photos}
		index={openPhoto}
		on:close={() => (openPhoto = -1)}
		on:move={(event) => (openPhoto = event.detail)}
	/>
{/if}

<div class="mx-auto max-w-6xl px-4 py-8">
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
			<h1 class="max-w-4xl text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
				{story.title}
			</h1>
			<p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
				{#if prose > 0}
					<span>{readingMinutes(prose)} min lezen</span>
				{/if}
				{#if photos.length > 0}
					<span>
						{photos.length}
						{photos.length === 1 ? 'foto' : "foto's"}
					</span>
				{/if}
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
			<section class="mt-6 max-w-3xl rounded-xl border border-gray-300 bg-gray-50 p-5">
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

		<div class="mt-2 gap-10 lg:flex lg:items-start">
			{#if showContents}
				<!--
					On a long piece the contents are the difference between a readable story and a
					wall. Sticky beside the text on a wide screen; a jump list at the top on a narrow
					one, where there is no room for a column.
				-->
				<nav class="mb-6 lg:sticky lg:top-24 lg:mb-0 lg:w-60 lg:shrink-0" aria-label="Inhoud">
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Inhoud</p>

					<ul class="mt-2 max-h-72 space-y-0.5 overflow-y-auto lg:max-h-[70vh]">
						{#each contents as entry (entry.index)}
							<li>
								<a
									href="#deel-{entry.index}"
									class="block rounded px-2 py-1.5 text-sm leading-snug transition {activeSection ===
									entry.index
										? 'bg-blue-50 font-semibold text-blue-900'
										: 'text-gray-700 hover:bg-gray-100'}"
								>
									{entry.heading}
									{#if entry.kicker}
										<span class="block text-xs font-normal text-gray-500">{entry.kicker}</span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}

			<article class="min-w-0 flex-1 pb-12">
				<StoryBody
					{archive}
					sections={story.sections}
					{photoOffsets}
					on:open={(event) => (openPhoto = event.detail)}
				/>
			</article>
		</div>
	{/if}
</div>
