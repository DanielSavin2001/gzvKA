<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { thumbUrl } from '$lib/archive';
	import type { StoryPart, StorySection } from '$lib/stories';

	export let archive: Archive | null = null;
	export let sections: StorySection[];
	/** Show only this section. -1, the default, shows all of them. */
	export let only = -1;
	/** Headings sit under the page's own title, so they are one level down from it. */
	export let headingLevel: 'h2' | 'h3' = 'h2';
	/**
	 * Off where the photographs are already on the page - a photo page showing the passage
	 * its picture came from would otherwise print that same picture twice.
	 */
	export let showImages = true;
	/**
	 * The running number each photograph has in the whole story, so opening one in the
	 * lightbox knows where it sits among the rest.
	 */
	export let photoOffsets: Map<string, number> = new Map();

	const dispatch = createEventDispatcher<{ open: number }>();

	$: shown = only >= 0 ? sections.slice(only, only + 1) : sections;

	function photoOf(id: string | undefined): ArchivePhoto | undefined {
		return id && archive ? archive.photoById.get(id) : undefined;
	}

	type Block =
		| { kind: 'prose'; parts: Extract<StoryPart, { k: 'p' }>[] }
		| { kind: 'gallery'; parts: Extract<StoryPart, { k: 'i' }>[] };

	/**
	 * Groups a section's parts into runs of prose and runs of photographs.
	 *
	 * This is what stops a story being an endless column. The old pages routinely put long
	 * runs of photographs one after another - "De Uitlegger" is 167 of them in a row, "Het
	 * Rood" 144 - and rendering each full width made a page tens of thousands of pixels
	 * tall. A run becomes a grid instead; a photograph standing alone between two paragraphs
	 * stays full width, because there it is illustrating the text rather than being one of a
	 * set.
	 */
	function group(parts: StoryPart[]): Block[] {
		const blocks: Block[] = [];

		for (const part of parts) {
			const last = blocks[blocks.length - 1];

			if (part.k === 'p') {
				if (last?.kind === 'prose') last.parts.push(part);
				else blocks.push({ kind: 'prose', parts: [part] });
			} else {
				if (last?.kind === 'gallery') last.parts.push(part);
				else blocks.push({ kind: 'gallery', parts: [part] });
			}
		}

		return blocks;
	}
</script>

<div class="story">
	{#each shown as section, index (only >= 0 ? only : index)}
		{@const sectionIndex = only >= 0 ? only : index}
		<section id="deel-{sectionIndex}" class="scroll-mt-24 pt-2">
			{#if section.kicker || section.heading}
				<header class="mx-auto max-w-3xl">
					{#if section.kicker}
						<p
							class="mt-8 text-sm font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300"
						>
							{section.kicker}
						</p>
					{/if}
					{#if section.heading}
						{#if headingLevel === 'h2'}
							<h2 class="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
								{section.heading}
							</h2>
						{:else}
							<h3 class="mt-2 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
								{section.heading}
							</h3>
						{/if}
					{/if}
				</header>
			{/if}

			{#each group(section.parts) as block, blockIndex (blockIndex)}
				{#if block.kind === 'prose'}
					<div class="mx-auto max-w-3xl">
						{#each block.parts as part, i (i)}
							{#if part.credit}
								<p class="mt-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
									&mdash; {part.t}
								</p>
							{:else}
								<p class="mt-4 text-lg leading-relaxed text-gray-800 dark:text-gray-200">
									{part.t}
								</p>
							{/if}
						{/each}
					</div>
				{:else if showImages}
					{#if block.parts.length === 1}
						{@const part = block.parts[0]}
						{@const photo = photoOf(part.id)}
						<figure class="mx-auto mt-6 max-w-3xl">
							{#if photo && archive}
								<button
									type="button"
									class="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
									on:click={() => dispatch('open', photoOffsets.get(photo.id) ?? 0)}
								>
									<img
										src={thumbUrl(archive, photo)}
										alt={part.c ?? photo.t}
										loading="lazy"
										decoding="async"
										class="mx-auto max-h-[60vh] w-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
									/>
								</button>
							{:else}
								<div
									class="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
								>
									Deze foto staat nog niet in het archief.
								</div>
							{/if}
							{#if part.c}
								<figcaption
									class="mt-2 text-center text-sm italic text-gray-600 dark:text-gray-400"
								>
									{part.c}
								</figcaption>
							{/if}
						</figure>
					{:else}
						<!-- A run of photographs: a grid, not a column tens of thousands of pixels tall. -->
						<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{#each block.parts as part, i (i)}
								{@const photo = photoOf(part.id)}
								{#if photo && archive}
									<button
										type="button"
										class="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
										on:click={() => dispatch('open', photoOffsets.get(photo.id) ?? 0)}
									>
										<div
											class="aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
										>
											<img
												src={thumbUrl(archive, photo)}
												alt={part.c ?? photo.t}
												loading="lazy"
												decoding="async"
												class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
											/>
										</div>
										<!--
											The caption keeps its space whether or not there is one, so the rows
											of a 167-photograph grid line up instead of stepping.
										-->
										<p
											class="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-snug text-gray-600 dark:text-gray-400"
										>
											{part.c ?? ''}
										</p>
									</button>
								{:else}
									<div
										class="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-center text-xs text-gray-500 dark:text-gray-400"
									>
										Nog niet in het archief
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				{/if}
			{/each}
		</section>
	{/each}
</div>
