<script context="module" lang="ts">
	import type { ArchivePhoto } from '$lib/archive';

	/** One photograph in the story, with the caption the old page gave it. */
	export interface LightboxItem {
		photo: ArchivePhoto;
		caption?: string;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { detailUrl, thumbUrl } from '$lib/archive';

	export let archive: Archive;
	export let items: LightboxItem[];
	/** Index of the open photograph. -1 closes the lightbox. */
	export let index = -1;

	const dispatch = createEventDispatcher<{ close: void; move: number }>();

	$: current = index >= 0 && index < items.length ? items[index] : null;
	$: previous = index > 0 ? items[index - 1] : null;
	$: next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

	/**
	 * Fetch the neighbours now, so stepping through a gallery of 167 photographs is instant
	 * rather than a white flash each time.
	 */
	$: if (current) {
		for (const neighbour of [previous, next]) {
			if (!neighbour) continue;
			const preload = new Image();
			preload.src = detailUrl(archive, neighbour.photo);
		}
	}

	function onKey(event: KeyboardEvent): void {
		if (index < 0) return;

		if (event.key === 'Escape') dispatch('close');
		if (event.key === 'ArrowLeft' && previous) dispatch('move', index - 1);
		if (event.key === 'ArrowRight' && next) dispatch('move', index + 1);
	}

	/**
	 * Deploys carry the thumbnails only, so the large file may not be there. Falling back
	 * keeps the photograph on screen rather than showing a broken image.
	 */
	function fallBackToThumbnail(event: Event): void {
		const image = event.currentTarget as HTMLImageElement;
		if (!current) return;

		const thumb = thumbUrl(archive, current.photo);
		if (image.src.endsWith(thumb)) return;
		image.src = thumb;
	}
</script>

<svelte:window on:keydown={onKey} />

{#if current}
	<!--
		A gallery of 167 photographs is unreadable if every click leaves the page. Opening
		here keeps the reader's place in the story, and the arrows walk the story's own
		photographs in the order the page shows them.
	-->
	<div
		class="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label={current.caption ?? current.photo.t}
	>
		<div class="flex items-start justify-between gap-4 p-4 text-white">
			<div class="min-w-0">
				<p class="truncate text-lg font-semibold">{current.photo.t}</p>
				<p class="text-sm text-white/70">{index + 1} van {items.length}</p>
			</div>

			<button
				type="button"
				class="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
				on:click={() => dispatch('close')}
			>
				Sluiten &times;
			</button>
		</div>

		<div class="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
			{#if previous}
				<button
					type="button"
					class="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
					aria-label="Vorige foto"
					on:click={() => dispatch('move', index - 1)}
				>
					&#8592;
				</button>
			{/if}

			<img
				src={detailUrl(archive, current.photo)}
				on:error={fallBackToThumbnail}
				alt={current.caption ?? current.photo.t}
				class="max-h-full max-w-full object-contain"
			/>

			{#if next}
				<button
					type="button"
					class="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
					aria-label="Volgende foto"
					on:click={() => dispatch('move', index + 1)}
				>
					&#8594;
				</button>
			{/if}
		</div>

		<div class="p-4 text-center text-white">
			{#if current.caption}
				<p class="mx-auto max-w-3xl text-sm italic text-white/90">{current.caption}</p>
			{/if}
			<a
				class="mt-2 inline-block text-sm font-semibold text-white/80 underline hover:text-white"
				href="/foto/{current.photo.id}"
			>
				Alle gegevens van deze foto
			</a>
		</div>
	</div>
{/if}
