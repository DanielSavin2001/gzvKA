<script lang="ts">
	import type { Archive } from '$lib/archive';
	import { thumbUrl } from '$lib/archive';
	import type { StorySection } from '$lib/stories';

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

	$: shown = only >= 0 ? sections.slice(only, only + 1) : sections;

	/**
	 * The old pages reference a photograph by filename; the build resolved that to an id in
	 * this archive wherever the file is actually here. Where it is not - 1,572 of the
	 * references are to photographs that live only on the old server - the caption is still
	 * worth showing, so the reader learns the picture existed rather than seeing nothing.
	 */
	function photoOf(id: string | undefined) {
		return id && archive ? archive.photoById.get(id) : undefined;
	}
</script>

<div class="story">
	{#each shown as section, index (only >= 0 ? only : index)}
		<section id="deel-{only >= 0 ? only : index}" class="scroll-mt-24">
			{#if section.kicker}
				<p class="mt-8 text-sm font-semibold uppercase tracking-wide text-blue-800">
					{section.kicker}
				</p>
			{/if}

			{#if section.heading}
				{#if headingLevel === 'h2'}
					<h2 class="mt-2 text-2xl font-bold tracking-tight text-gray-900">{section.heading}</h2>
				{:else}
					<h3 class="mt-2 text-xl font-bold tracking-tight text-gray-900">{section.heading}</h3>
				{/if}
			{/if}

			{#each section.parts as part, partIndex (partIndex)}
				{#if part.k === 'p'}
					{#if part.credit}
						<p class="mt-4 text-right text-sm font-semibold text-gray-700">&mdash; {part.t}</p>
					{:else}
						<p class="mt-4 leading-relaxed text-gray-800">{part.t}</p>
					{/if}
				{:else if showImages}
					{@const photo = photoOf(part.id)}
					<figure class="mt-6">
						{#if photo && archive}
							<a href="/foto/{photo.id}" class="block">
								<img
									src={thumbUrl(archive, photo)}
									alt={part.c ?? photo.t}
									loading="lazy"
									decoding="async"
									class="mx-auto max-h-[60vh] w-auto rounded-lg border border-gray-200 bg-gray-100"
								/>
							</a>
						{:else}
							<div
								class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
							>
								Deze foto staat nog niet in het archief.
							</div>
						{/if}

						{#if part.c}
							<figcaption class="mt-2 text-center text-sm italic text-gray-600">
								{part.c}
							</figcaption>
						{/if}
					</figure>
				{/if}
			{/each}
		</section>
	{/each}
</div>
