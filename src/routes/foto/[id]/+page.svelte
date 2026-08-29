<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { detailUrl, loadArchive, thumbUrl } from '$lib/archive';
	import type { Story } from '$lib/stories';
	import { loadStory, loadStoryPhotos } from '$lib/stories';
	import StoryBody from '../../components/StoryBody.svelte';

	export let data: { id: string };

	let archive: Archive | null = null;
	let error: string | null = null;

	/** The piece of writing this photograph appeared in, when the old site had one. */
	let story: Story | null = null;
	let storySection = -1;

	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// A photograph can be opened from another without the page remounting, so the story
	// follows the id rather than being fetched once on mount.
	$: loadStoryFor(data.id);

	async function loadStoryFor(id: string): Promise<void> {
		story = null;
		storySection = -1;

		try {
			const map = await loadStoryPhotos();
			const reference = map[id];
			if (!reference) return;

			const loaded = await loadStory(reference.slug);
			// Guard against a slower fetch for a photograph the reader has already left.
			if (data.id !== id) return;

			story = loaded;
			storySection = reference.section;
		} catch {
			// The photograph and its details are the page; the story is an extra.
			story = null;
		}
	}

	let photo: ArchivePhoto | undefined;
	$: photo = archive?.photoById.get(data.id);

	$: places = photo
		? photo.st
				.map((id) => archive?.placeById.get(id))
				.filter((place): place is NonNullable<typeof place> => place !== undefined)
		: [];

	/**
	 * Deploys carry the thumbnails only, because both sizes together come to 443 MB and
	 * hosting keeps every version. When the larger file is not there, show the thumbnail
	 * rather than a broken image - the photograph is still the point.
	 */
	function fallBackToThumbnail(event: Event): void {
		const image = event.currentTarget as HTMLImageElement;
		if (!archive || !photo) return;

		const thumb = thumbUrl(archive, photo);
		if (image.src.endsWith(thumb)) return; // already the fallback; let it fail visibly

		image.src = thumb;
	}
</script>

<svelte:head>
	<title>{photo ? photo.t : 'Foto'} | gzvKA fotoarchief</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	{#if error}
		<div class="my-8 rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<p class="py-16 text-center text-gray-500">Bezig met laden ...</p>
	{:else if !photo}
		<div class="py-16 text-center">
			<h1 class="text-2xl font-bold text-gray-900">Deze foto kennen we niet</h1>
			<a class="mt-2 inline-block text-blue-800 underline hover:no-underline" href="/">
				Terug naar de startpagina
			</a>
		</div>
	{:else}
		<nav class="text-sm text-gray-600">
			<a class="text-blue-800 underline hover:no-underline" href="/">Startpagina</a>
			{#each places.filter((p) => p.isStreet).slice(0, 1) as street (street.id)}
				<span class="mx-2">/</span>
				<a class="text-blue-800 underline hover:no-underline" href="/straat/{street.id}">
					{street.name}
				</a>
			{/each}
		</nav>

		<figure class="mt-4">
			<img
				src={detailUrl(archive, photo)}
				on:error={fallBackToThumbnail}
				alt={photo.t}
				class="mx-auto max-h-[70vh] w-auto rounded-lg border border-gray-200 bg-gray-100 object-contain"
			/>
			<figcaption class="mt-4">
				<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">{photo.t}</h1>

				<dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
					{#if places.length > 0}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700">Plaats</dt>
							<dd class="flex flex-wrap gap-2">
								{#each places as place (place.id)}
									<a class="text-blue-800 underline hover:no-underline" href="/straat/{place.id}">
										{place.name}{#if place.isStreet && photo.hn}&nbsp;{photo.hn}{/if}
									</a>
								{/each}
							</dd>
						</div>
					{/if}
					<div class="flex gap-2">
						<dt class="w-36 shrink-0 font-semibold text-gray-700">Onderwerp</dt>
						<dd class="text-gray-900">{photo.s}</dd>
					</div>
					{#if photo.y}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700">Jaartal</dt>
							<dd class="text-gray-900">{photo.y}</dd>
						</div>
					{/if}
					{#if photo.d}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700">Ingezonden door</dt>
							<dd class="text-gray-900">{photo.d}</dd>
						</div>
					{/if}
					{#if photo.a}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700">Ontvangen op</dt>
							<dd class="text-gray-900">{photo.a}</dd>
						</div>
					{/if}
				</dl>

				<p class="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
					Klopt er iets niet, of weet u meer over deze foto? Laat het ons weten &mdash; deze
					gegevens zijn automatisch uit de bestandsnaam gehaald en niet altijd volledig.
				</p>
			</figcaption>
		</figure>

		{#if story && storySection >= 0}
			<section class="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
				<p class="text-sm font-semibold uppercase tracking-wide text-amber-800">
					Bij deze foto hoort een verhaal
				</p>

				<div class="mt-1">
					<StoryBody
						sections={story.sections}
						only={storySection}
						showImages={false}
						headingLevel="h3"
					/>
				</div>

				<a
					class="mt-5 inline-block rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
					href="/verhaal/{story.slug}#deel-{storySection}"
				>
					Lees &ldquo;{story.title}&rdquo;
				</a>
			</section>
		{/if}
	{/if}
</div>
