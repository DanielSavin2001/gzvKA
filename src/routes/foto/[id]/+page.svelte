<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { detailUrl, loadArchive, sortForDisplay, thumbUrl } from '$lib/archive';
	import { swipe } from '$lib/gestures';
	import type { PhotoContext } from '$lib/stories';
	import { loadStory, loadStoryPhotos, photoContext } from '$lib/stories';

	export let data: { id: string };

	let archive: Archive | null = null;
	let error: string | null = null;

	/** What the old website wrote about this photograph, when it wrote anything. */
	let context: PhotoContext | null = null;

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
		context = null;

		try {
			const map = await loadStoryPhotos();
			const reference = map[id];
			if (!reference) return;

			const story = await loadStory(reference.slug);
			// Guard against a slower fetch for a photograph the reader has already left.
			if (data.id !== id) return;

			context = photoContext(story, reference);
		} catch {
			// The photograph and its details are the page; the story is an extra.
			context = null;
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
	 * The photographs this one sits among, in the order the visitor last saw them.
	 *
	 * The list is named in the `lijst` query parameter that the card they clicked put there,
	 * so the arrows walk the same street page they came from rather than some other order.
	 * Arriving with no parameter - a shared link, a bookmark - falls back to the photograph's
	 * own street, which is the most useful list it belongs to.
	 */
	$: listKey = $page.url.searchParams.get('lijst') ?? '';

	$: siblings = ((): ArchivePhoto[] => {
		if (!archive || !photo) return [];

		const [kind, value] = listKey.includes(':') ? splitOnce(listKey, ':') : ['', ''];

		if (kind === 'straat') return sortForDisplay(archive.photosByPlace.get(value) ?? []);
		if (kind === 'onderwerp') {
			return sortForDisplay(archive.photos.filter((other) => other.s === value));
		}

		const street = places.find((place) => place.isStreet) ?? places[0];
		return street ? sortForDisplay(archive.photosByPlace.get(street.id) ?? []) : [];
	})();

	$: position = photo ? siblings.findIndex((other) => other.id === photo?.id) : -1;
	$: previous = position > 0 ? siblings[position - 1] : null;
	$: next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null;

	/** Keeps the `lijst` parameter across a step, or the next arrow would lose the thread. */
	$: neighbourQuery = listKey ? `?lijst=${encodeURIComponent(listKey)}` : '';

	function splitOnce(value: string, separator: string): [string, string] {
		const at = value.indexOf(separator);
		return [value.slice(0, at), value.slice(at + separator.length)];
	}

	function step(to: ArchivePhoto | null): void {
		if (to) goto(`/foto/${to.id}${neighbourQuery}`);
	}

	function onKey(event: KeyboardEvent): void {
		// Not while someone is typing in the search box in the header.
		const target = event.target as HTMLElement | null;
		if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

		if (event.key === 'ArrowLeft') step(previous);
		if (event.key === 'ArrowRight') step(next);
	}

	/**
	 * Fetches the neighbours' images now, so stepping through the archive is instant rather
	 * than a blank frame per photograph. The browser keeps them in its own cache, so the
	 * `<img>` the next page renders finds them already there.
	 */
	$: if (archive) {
		for (const neighbour of [previous, next]) {
			if (!neighbour) continue;
			const preload = new Image();
			preload.src = detailUrl(archive, neighbour);
		}
	}

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

<svelte:window on:keydown={onKey} />

<svelte:head>
	<title>{photo ? photo.t : 'Foto'} | gzvKA fotoarchief</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	{#if error}
		<div
			class="my-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<p class="py-16 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
	{:else if !photo}
		<div class="py-16 text-center">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Deze foto kennen we niet</h1>
			<a
				class="mt-2 inline-block text-blue-800 dark:text-blue-300 underline hover:no-underline"
				href="/"
			>
				Terug naar de startpagina
			</a>
		</div>
	{:else}
		<nav class="text-sm text-gray-600 dark:text-gray-400">
			<a class="text-blue-800 dark:text-blue-300 underline hover:no-underline" href="/"
				>Startpagina</a
			>
			{#each places.filter((p) => p.isStreet).slice(0, 1) as street (street.id)}
				<span class="mx-2">/</span>
				<a
					class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
					href="/straat/{street.id}"
				>
					{street.name}
				</a>
			{/each}
		</nav>

		<figure class="mt-4">
			<!--
				The photograph, with its neighbours showing at the edges. Seeing a sliver of the
				next picture is what tells you there is one; an arrow on its own does not. The
				slivers are hidden below `lg`, where there is no room beside the photograph for
				anything but the arrows themselves.
			-->
			<!--
				The stage is a fixed height and the photograph is fitted inside it. Letting the
				box follow each picture's own proportions moved the arrows up to 177px between
				one photograph and the next - measured, and thoroughly annoying to click.
			-->
			<div
				class="relative flex h-[58vh] touch-pan-y select-none items-center justify-center gap-3 sm:h-[64vh]"
				use:swipe={{ onLeft: () => step(next), onRight: () => step(previous) }}
			>
				{#if previous}
					<a
						href="/foto/{previous.id}{neighbourQuery}"
						class="hidden h-40 w-24 shrink-0 lg:block xl:h-52 xl:w-32"
						aria-label="Vorige foto: {previous.t}"
					>
						<img
							src={thumbUrl(archive, previous)}
							alt=""
							draggable="false"
							class="h-full w-full select-none rounded-l-lg object-cover opacity-40 transition hover:opacity-80"
						/>
					</a>
				{:else}
					<div class="hidden h-40 w-24 shrink-0 lg:block xl:h-52 xl:w-32" />
				{/if}

				<div class="relative flex h-full min-w-0 flex-1 items-center justify-center">
					<img
						src={detailUrl(archive, photo)}
						on:error={fallBackToThumbnail}
						alt={photo.t}
						draggable="false"
						class="max-h-full max-w-full select-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 object-contain"
					/>

					{#if previous}
						<a
							href="/foto/{previous.id}{neighbourQuery}"
							class="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white dark:bg-gray-900/85 text-2xl text-gray-900 dark:text-gray-100 shadow-md transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							aria-label="Vorige foto"
						>
							&#8592;
						</a>
					{/if}
					{#if next}
						<a
							href="/foto/{next.id}{neighbourQuery}"
							class="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white dark:bg-gray-900/85 text-2xl text-gray-900 dark:text-gray-100 shadow-md transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							aria-label="Volgende foto"
						>
							&#8594;
						</a>
					{/if}
				</div>

				{#if next}
					<a
						href="/foto/{next.id}{neighbourQuery}"
						class="hidden w-24 shrink-0 lg:block xl:w-32"
						aria-label="Volgende foto: {next.t}"
					>
						<img
							src={thumbUrl(archive, next)}
							alt=""
							class="h-40 w-full rounded-r-lg object-cover opacity-40 transition hover:opacity-80 xl:h-52"
						/>
					</a>
				{:else}
					<div class="hidden w-24 shrink-0 lg:block xl:w-32" />
				{/if}
			</div>

			{#if siblings.length > 1 && position >= 0}
				<p class="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
					Foto {position + 1} van {siblings.length}
					{#if listKey.startsWith('straat:') && archive.placeById.get(listKey.slice(7))}
						in de {archive.placeById.get(listKey.slice(7))?.name}
					{/if}
					<span class="ml-2 hidden lg:inline">&middot; gebruik &larr; en &rarr;</span>
					<span class="ml-2 lg:hidden">&middot; veeg om te bladeren</span>
				</p>
			{/if}

			<figcaption class="mt-4">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{photo.t}</h1>

				<dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
					{#if places.length > 0}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Plaats</dt>
							<dd class="flex flex-wrap gap-2">
								{#each places as place (place.id)}
									<a
										class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
										href="/straat/{place.id}"
									>
										{place.name}{#if place.isStreet && photo.hn}&nbsp;{photo.hn}{/if}
									</a>
								{/each}
							</dd>
						</div>
					{/if}
					<div class="flex gap-2">
						<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Onderwerp</dt>
						<dd class="text-gray-900 dark:text-gray-100">{photo.s}</dd>
					</div>
					{#if photo.y}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Jaartal</dt>
							<dd class="text-gray-900 dark:text-gray-100">{photo.y}</dd>
						</div>
					{/if}
					{#if photo.d}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">
								Ingezonden door
							</dt>
							<dd class="text-gray-900 dark:text-gray-100">{photo.d}</dd>
						</div>
					{/if}
					{#if photo.a}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">
								Ontvangen op
							</dt>
							<dd class="text-gray-900 dark:text-gray-100">{photo.a}</dd>
						</div>
					{/if}
				</dl>

				<p
					class="mt-6 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-600 dark:text-gray-400"
				>
					Klopt er iets niet, of weet u meer over deze foto? Laat het ons weten &mdash; deze
					gegevens zijn automatisch uit de bestandsnaam gehaald en niet altijd volledig.
				</p>
			</figcaption>
		</figure>

		{#if context}
			<section
				class="mt-10 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 p-5 sm:p-6"
			>
				<p class="text-sm font-semibold uppercase tracking-wide text-amber-800">
					Uit het archief van de oude website
				</p>

				{#if context.caption}
					<p class="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">{context.caption}</p>
				{/if}

				{#if context.prose.length > 0}
					{#each context.prose as paragraph, i (i)}
						<p class="mt-3 leading-relaxed text-gray-800 dark:text-gray-200">{paragraph}</p>
					{/each}
				{:else}
					<p class="mt-2 text-gray-700 dark:text-gray-300">
						Deze foto stond op de pagina
						<strong>{context.story.title}</strong>{#if context.section.heading}, onder het kopje
							<strong>{context.section.heading}</strong>{/if}. Er stond geen tekst bij deze foto
						zelf.
					</p>
				{/if}

				<a
					class="mt-5 inline-block rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
					href="/verhaal/{context.story.slug}#deel-{context.sectionIndex}"
				>
					Lees &ldquo;{context.story.title}&rdquo;
				</a>
			</section>
		{/if}
	{/if}
</div>
