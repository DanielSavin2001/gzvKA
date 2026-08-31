<script context="module" lang="ts">
	/** One counter per module, so each chooser on a page owns its own listbox id. */
	let nextId = 0;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive, ArchivePlace } from '$lib/archive';
	import { savePlaceRecord } from '$lib/admin';
	import { CURATOR_KINDS, placeIdFrom } from '../../../sharedModels/place-record';
	import { isPersonKind } from '../../../sharedModels/place-family';
	import { normalizeText } from '../../../sharedModels/text';

	/**
	 * Choosing where a photograph was taken - and saying so when the place is not in the
	 * archive yet.
	 *
	 * This was a flat `<select>` of all 131 places sorted by photograph count, with no search
	 * and no way out. A curator looking at a photograph of Kasteel Appel had two options:
	 * file it under the wrong place, or leave it filed under nothing. The archive has 793
	 * photographs with no place at all, and that select is part of why.
	 *
	 * Three things it does that the select could not. It searches, because 131 names in count
	 * order is not a list anybody reads. It shows what a place sits under, so "Begin van de
	 * straat" is not adrift from the street it belongs to. And it creates, writing to the
	 * places overlay so the new place is real on the maps, in the lists and in search before
	 * the curator has finished the sentence.
	 *
	 * The person entry is filtered out here, as the map desk already does: "Tajje" is a man,
	 * and offering him as somewhere a photograph was taken is how he ended up being one.
	 */

	export let chosen: string[] = [];
	export let archive: Archive | null = null;
	export let label = 'Plaats';

	const dispatch = createEventDispatcher<{ change: string[]; created: string }>();

	const listId = `plaatsen-${(nextId += 1)}`;

	let query = '';
	let open = false;
	let highlighted = 0;
	let box: HTMLElement | null = null;

	/** The create form, when the curator has asked for one. */
	let creating = false;
	let newKind = 'building';
	let newParent = '';
	let saving = false;
	let error: string | null = null;

	$: everything = archive ? archive.places.filter((place) => !isPersonKind(place)) : [];
	$: byId = new Map(everything.map((place) => [place.id, place]));

	/** "Stations › Station Kapellen", so a nested place is not adrift from its parent. */
	function trail(place: ArchivePlace): string {
		const parent = place.parentId ? byId.get(place.parentId) : undefined;
		return parent ? `${parent.name} › ${place.name}` : place.name;
	}

	$: needle = normalizeText(query.trim());
	$: matches = (() => {
		const pool = everything.filter((place) => !chosen.includes(place.id));
		if (!needle) return pool.slice(0, 12);

		const starts: ArchivePlace[] = [];
		const holds: ArchivePlace[] = [];
		for (const place of pool) {
			const name = normalizeText(place.name);
			if (name.startsWith(needle)) starts.push(place);
			else if (name.includes(needle)) holds.push(place);
		}

		return [...starts, ...holds].slice(0, 12);
	})();

	/** Whether what was typed is already a place, so "new" is not offered over the top of one. */
	$: exists = needle !== '' && everything.some((place) => normalizeText(place.name) === needle);
	$: canCreate = query.trim() !== '' && !exists && placeIdFrom(query) !== '';

	function add(id: string): void {
		if (!chosen.includes(id)) chosen = [...chosen, id];
		query = '';
		open = false;
		dispatch('change', chosen);
	}

	function drop(id: string): void {
		chosen = chosen.filter((entry) => entry !== id);
		dispatch('change', chosen);
	}

	async function create(): Promise<void> {
		const name = query.trim();
		if (!name || saving) return;

		saving = true;
		error = null;

		try {
			const saved = await savePlaceRecord({
				name,
				kind: newKind,
				...(newParent ? { parentId: newParent } : {})
			});

			creating = false;
			// The parent reloads the archive; until it does, the id is already usable here.
			dispatch('created', saved.id);
			add(saved.id);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			open = false;
			return;
		}
		if (!open) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = Math.min(highlighted + 1, matches.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (event.key === 'Enter' && matches[highlighted]) {
			event.preventDefault();
			add(matches[highlighted].id);
		}
	}

	function onWindowClick(event: MouseEvent): void {
		if (!open || !box || creating) return;
		if (!box.contains(event.target as Node)) open = false;
	}
</script>

<svelte:window on:click={onWindowClick} />

<div class="relative" bind:this={box}>
	{#if label}
		<p class="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
	{/if}

	{#if chosen.length > 0}
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each chosen as id (id)}
				<li>
					<button
						type="button"
						class="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200"
						on:click={() => drop(id)}
					>
						{byId.get(id)?.name ?? id} &times;
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<input
		bind:value={query}
		placeholder="Zoek een straat of plaats, of typ een nieuwe naam"
		role="combobox"
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="list"
		autocomplete="off"
		class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
		on:focus={() => {
			open = true;
			highlighted = 0;
		}}
		on:input={() => {
			open = true;
			highlighted = 0;
		}}
		on:keydown={onKey}
	/>

	{#if error}
		<p class="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
	{/if}

	{#if creating}
		<div
			class="mt-2 rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950"
		>
			<p class="text-sm font-semibold text-blue-900 dark:text-blue-200">
				Nieuwe plaats: &ldquo;{query.trim()}&rdquo;
			</p>
			<p class="mt-1 text-xs text-blue-900 dark:text-blue-200">
				Komt meteen op de kaart en in de lijsten. De id wordt <code>{placeIdFrom(query)}</code>.
			</p>

			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<label class="block">
					<span class="text-xs font-medium text-gray-700 dark:text-gray-300">Soort</span>
					<select
						bind:value={newKind}
						class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					>
						{#each CURATOR_KINDS as kind (kind)}
							<option value={kind}>{kind}</option>
						{/each}
					</select>
				</label>

				<label class="block">
					<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
						Hoort onder (optioneel)
					</span>
					<select
						bind:value={newParent}
						class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					>
						<option value="">&mdash; niets &mdash;</option>
						{#each everything as place (place.id)}
							<option value={place.id}>{trail(place)}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="mt-3 flex gap-2">
				<button
					type="button"
					class="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-gray-400"
					disabled={saving}
					on:click={create}
				>
					{saving ? 'Bezig ...' : 'Plaats aanmaken'}
				</button>
				<button
					type="button"
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 dark:border-gray-700 dark:text-gray-200"
					on:click={() => (creating = false)}
				>
					Annuleren
				</button>
			</div>
		</div>
	{:else if open && (matches.length > 0 || canCreate)}
		<ul
			id={listId}
			role="listbox"
			class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
		>
			{#each matches as place, index (place.id)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={index === highlighted}
						class="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm {index ===
						highlighted
							? 'bg-blue-50 dark:bg-blue-950'
							: ''} hover:bg-blue-50 dark:hover:bg-blue-950"
						on:mouseenter={() => (highlighted = index)}
						on:click={() => add(place.id)}
					>
						<span class="text-gray-900 dark:text-gray-100">{trail(place)}</span>
						<span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{place.count}</span
						>
					</button>
				</li>
			{/each}

			{#if canCreate}
				<li class="border-t border-gray-200 dark:border-gray-700">
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm font-medium text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
						on:click={() => {
							creating = true;
							open = false;
						}}
					>
						&plus; Nieuwe plaats &ldquo;{query.trim()}&rdquo; aanmaken
					</button>
				</li>
			{/if}
		</ul>
	{/if}
</div>
