<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import type { Archive } from '$lib/archive';
	import { suggestPlaces } from '$lib/archive';
	import { registerStreets } from '$lib/page-data';
	import type { RegisterStreet } from '../../../sharedModels/street-register';
	import { suggestRegisterStreets } from '../../../sharedModels/street-register';

	const dispatch = createEventDispatcher<{ search: string }>();

	export let archive: Archive | null = null;
	export let value = '';
	export let autofocus = false;
	export let placeholder = 'Zoek een straat, een plaats, een naam ...';

	/** One row of the dropdown. `count` is 0 for a street the archive has nothing of yet. */
	type Suggestion = { id: string; name: string; count: number };

	let suggestions: Suggestion[] = [];
	let highlighted = -1;
	let open = false;

	/**
	 * The streets with no photographs, so typing one of them is not a dead end.
	 *
	 * 24 KB against the archive's 1.1 MB, loaded once and cached, and only in the browser -
	 * a missing file simply means the box behaves as it did before.
	 */
	let register: RegisterStreet[] = [];

	onMount(async () => {
		try {
			register = await registerStreets(fetch);
		} catch {
			register = [];
		}
	});

	$: withPhotos = archive && value.trim() !== '' ? suggestPlaces(archive, value) : [];

	/**
	 * Places with photographs first, then streets without.
	 *
	 * Never the other way round: somebody typing "hoevense" wants the 96 photographs of the
	 * Hoevensebaan, not an alphabetical neighbour with nothing behind it.
	 */
	$: suggestions = [
		...withPhotos.map((place) => ({ id: place.id, name: place.name, count: place.count })),
		...(value.trim() === ''
			? []
			: suggestRegisterStreets(
					register,
					value,
					new Set(withPhotos.map((place) => place.id)),
					Math.max(0, 8 - withPhotos.length)
			  ).map((street) => ({ id: street.slug, name: street.name, count: 0 })))
	];
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

	function choose(place: Suggestion): void {
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
			class="flex overflow-hidden rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:border-blue-700"
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
				class="w-full border-0 bg-white px-4 py-3 text-lg text-gray-900 placeholder-gray-500 focus:ring-0 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
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
			class="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
			role="listbox"
		>
			{#each suggestions as place, i (place.id)}
				<li role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-2 text-left text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-950 {i ===
						highlighted
							? 'bg-blue-50 dark:bg-blue-950'
							: ''}"
						on:click={() => choose(place)}
					>
						<span class="font-medium">{place.name}</span>
						<span class="text-sm text-gray-600 dark:text-gray-400">
							{#if place.count === 0}
								nog geen foto's
							{:else}
								{place.count} foto's
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
