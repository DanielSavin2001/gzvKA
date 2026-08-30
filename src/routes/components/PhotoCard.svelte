<script lang="ts">
	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { photoAlt, thumbUrl } from '$lib/archive';

	export let archive: Archive;
	export let photo: ArchivePhoto;
	/** Show the subject folder under the title. Off on a page that is already one subject. */
	export let showSubject = true;
	/**
	 * Which list this card belongs to, carried to the photograph so its previous/next
	 * arrows step through the same photographs in the same order the visitor is looking at.
	 * `straat:<id>`, `onderwerp:<name>`, or empty for none.
	 */
	export let list = '';

	$: places = photo.st
		.map((id) => archive.placeById.get(id))
		.filter((place): place is NonNullable<typeof place> => place !== undefined);

	$: street = places.find((place) => place.isStreet);

	// The alt text is the archive's own description of the photograph, which is far more
	// use to a screen reader than "foto". Shared with the photograph's own page, so the
	// thumbnail and the picture it links to describe themselves the same way.
	$: alt = photoAlt(archive, photo);
</script>

<a
	class="group block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
	href="/foto/{photo.id}{list ? `?lijst=${encodeURIComponent(list)}` : ''}"
>
	<div class="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
		<img
			src={thumbUrl(archive, photo)}
			{alt}
			loading="lazy"
			decoding="async"
			class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
		/>
	</div>

	<div class="p-3">
		<h3 class="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{photo.t}</h3>

		<p
			class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
		>
			{#if street}
				<span class="font-medium text-blue-800 dark:text-blue-300">
					{street.name}{#if photo.hn}&nbsp;{photo.hn}{/if}
				</span>
			{/if}
			{#if photo.y}
				<span>{photo.y}</span>
			{/if}
		</p>

		{#if showSubject}
			<p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{photo.s}</p>
		{/if}
	</div>
</a>
