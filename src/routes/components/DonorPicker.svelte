<script context="module" lang="ts">
	/**
	 * One counter for the whole module, so every picker on a page gets its own listbox id.
	 * The submission queue renders one of these per row, and `aria-controls` pointing at a
	 * shared id would make every input claim to control the first row's list.
	 */
	let nextId = 0;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { donors as allDonors } from '$lib/archive';
	import { slugify } from '../../../sharedModels/text';

	/**
	 * Choosing who gave a photograph.
	 *
	 * This was a bare text input in both editors, and a donor has no record anywhere: it is a
	 * string on each photograph, and identity is `slugify(name)` computed at read time. So a
	 * typo does not produce a validation error, it produces a second person - a new
	 * /schenker/<slug> page with one photograph on it, sitting next to the real one with 88.
	 * Nothing warned, because nothing knew.
	 *
	 * The list is built in the browser from the archive the page has already loaded, so this
	 * needs no endpoint. That is deliberate as well as cheap: a donor list is a register of
	 * ~297 named private individuals, and the archive index is already public, so deriving it
	 * here exposes nothing new - where a public `donors` endpoint would have published the
	 * register as a thing in its own right.
	 *
	 * The important behaviour is the warning, not the list. Typing a spelling that slugs to
	 * somebody who already exists says so before the save, because the slug is what merges
	 * them and the curator cannot see a slug.
	 */

	export let value = '';
	export let archive: Archive | null = null;
	/** Shown above the field. */
	export let label = 'Ingezonden door';
	export let placeholder = 'Zoek een schenker, of typ een nieuwe naam';

	const dispatch = createEventDispatcher<{ change: string }>();

	const listId = `schenkers-${(nextId += 1)}`;

	let open = false;
	let highlighted = 0;
	let box: HTMLElement | null = null;

	interface Option {
		slug: string;
		name: string;
		count: number;
	}

	$: everyone = archive
		? allDonors(archive).map((donor) => ({
				slug: donor.slug,
				name: donor.name,
				count: donor.photos.length
		  }))
		: [];

	$: typed = value.trim();
	$: typedSlug = slugify(typed);

	/**
	 * Matches, best first: the ones that start with what was typed, then the ones that merely
	 * contain it. A curator typing "van" wants Van Elst before Van der Auwera, and both before
	 * "Jan van Gorp".
	 */
	$: matches = (() => {
		const needle = typed.toLowerCase();
		if (!needle) return everyone.slice(0, 12);

		const starts: Option[] = [];
		const holds: Option[] = [];
		for (const donor of everyone) {
			const name = donor.name.toLowerCase();
			if (name.startsWith(needle)) starts.push(donor);
			else if (name.includes(needle)) holds.push(donor);
		}

		return [...starts, ...holds].slice(0, 12);
	})();

	/**
	 * Somebody who is already in the archive under a different spelling.
	 *
	 * The slug is the identity, so "Johan van Elst" and "Johan Van Elst" are one man whether
	 * anybody meant them to be. Saying so is the whole point of this component: the merge
	 * happens silently either way, and a curator who did not intend it should find out now.
	 */
	$: sameSlug = typedSlug ? everyone.find((donor) => donor.slug === typedSlug) : undefined;
	$: spellingDiffers = sameSlug !== undefined && sameSlug.name !== typed;
	$: isNew = typed !== '' && sameSlug === undefined;

	function choose(option: Option): void {
		value = option.name;
		open = false;
		dispatch('change', value);
	}

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			open = false;
			return;
		}
		if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			open = true;
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
			choose(matches[highlighted]);
		}
	}

	/** A click anywhere else is a decision to keep what was typed. */
	function onWindowClick(event: MouseEvent): void {
		if (!open || !box) return;
		if (!box.contains(event.target as Node)) open = false;
	}
</script>

<svelte:window on:click={onWindowClick} />

<div class="relative" bind:this={box}>
	<label class="block">
		<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
		<input
			bind:value
			{placeholder}
			role="combobox"
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={open && matches[highlighted]
				? `${listId}-${matches[highlighted].slug}`
				: undefined}
			aria-autocomplete="list"
			autocomplete="off"
			class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
			on:focus={() => {
				open = true;
				highlighted = 0;
			}}
			on:input={() => {
				open = true;
				highlighted = 0;
				dispatch('change', value);
			}}
			on:keydown={onKey}
		/>
	</label>

	{#if typed}
		{#if spellingDiffers}
			<p class="mt-1 text-xs text-amber-800 dark:text-amber-300">
				Zelfde persoon als <strong>{sameSlug?.name}</strong> ({sameSlug?.count}
				{sameSlug?.count === 1 ? 'foto' : "foto's"}) &mdash; deze foto komt bij die pagina terecht.
				<button
					type="button"
					class="underline hover:no-underline"
					on:click={() => sameSlug && choose(sameSlug)}
				>
					Neem die schrijfwijze over
				</button>
			</p>
		{:else if isNew}
			<p class="mt-1 text-xs text-blue-800 dark:text-blue-300">
				Nieuwe schenker &mdash; dit maakt een eigen pagina aan. Staat de naam er al anders in, kies
				die dan hierboven.
			</p>
		{/if}
	{/if}

	{#if open && matches.length > 0}
		<ul
			id={listId}
			role="listbox"
			class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
		>
			{#each matches as option, index (option.slug)}
				<li>
					<button
						type="button"
						id="{listId}-{option.slug}"
						role="option"
						aria-selected={index === highlighted}
						class="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm {index ===
						highlighted
							? 'bg-blue-50 dark:bg-blue-950'
							: ''} hover:bg-blue-50 dark:hover:bg-blue-950"
						on:mouseenter={() => (highlighted = index)}
						on:click={() => choose(option)}
					>
						<span class="text-gray-900 dark:text-gray-100">{option.name}</span>
						<span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400"
							>{option.count}</span
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
