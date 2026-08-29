<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import { goto } from '$app/navigation';
	import type { Archive, ArchivePlace } from '$lib/archive';
	import { suggestPlaces } from '$lib/archive';

	const dispatch = createEventDispatcher<{ search: string }>();

	export let archive: Archive | null = null;
	export let value = '';
	export let autofocus = false;
	export let placeholder = 'Zoek een straat, een plaats, een naam ...';

	let suggestions: ArchivePlace[] = [];
	let highlighted = -1;
	let open = false;

	$: suggestions = archive && value.trim() !== '' ? suggestPlaces(archive, value) : [];
	$: if (suggestions.length === 0) highlighted = -1;

	/**
	 * Hands the query to whoever is showing the results.
	 *
	 * The box used to navigate to a page of its own, so the search on the home page could
	 * only take you elsewhere to see what it found. The results are shown where the question
	 * was asked now, and the page listening decides what to do with it.
	 */
	function submit(): void {
		const query = value.trim();
		if (query === '') return;

		open = false;
		dispatch('search', query);
	}

	function choose(place: ArchivePlace): void {
		open = false;
		value = place.name;
		goto(`/straat/${place.id}`);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = Math.min(highlighted + 1, suggestions.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = Math.max(highlighted - 1, -1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (highlighted >= 0 && suggestions[highlighted]) choose(suggestions[highlighted]);
			else submit();
		} else if (event.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative w-full">
	<form on:submit|preventDefault={submit} role="search">
		<label class="sr-only" for="archief-zoeken">Zoek in het fotoarchief</label>

		<div
			class="flex overflow-hidden rounded-xl border-2 border-gray-300 bg-white focus-within:border-blue-700"
		>
			<!-- svelte-ignore a11y-autofocus -->
			<input
				id="archief-zoeken"
				type="search"
				bind:value
				on:focus={() => (open = true)}
				on:input={() => (open = true)}
				on:keydown={onKeydown}
				{placeholder}
				autocomplete="off"
				{autofocus}
				class="w-full border-0 px-4 py-3 text-lg text-gray-900 placeholder-gray-500 focus:ring-0"
			/>
			<button
				type="submit"
				class="shrink-0 bg-blue-800 px-5 py-3 text-lg font-semibold text-white transition hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
			>
				Zoek
			</button>
		</div>
	</form>

	{#if open && suggestions.length > 0}
		<ul
			class="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-300 bg-white shadow-lg"
			role="listbox"
		>
			{#each suggestions as place, i (place.id)}
				<li role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-2 text-left text-gray-900 hover:bg-blue-50 {i ===
						highlighted
							? 'bg-blue-50'
							: ''}"
						on:click={() => choose(place)}
					>
						<span class="font-medium">{place.name}</span>
						<span class="text-sm text-gray-500">{place.count} foto's</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
