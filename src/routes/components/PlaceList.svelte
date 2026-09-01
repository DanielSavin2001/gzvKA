<script lang="ts">
	/**
	 * A list of places, short on a phone and whole on a desktop.
	 *
	 * 104 street names stacked vertically is a fine index on a wide screen, where they sit
	 * in three columns and the eye takes them in at once. On a phone the same list is a
	 * single column you scroll past for half a minute, and the rest of the page - the
	 * stories, the photographs - is somewhere below it. The overview is what gets lost.
	 *
	 * So a phone gets the ten with the most photographs and a button for ten more. The
	 * button is the only way the rest arrive, which means the ordering matters: busiest
	 * first, because those are the ones somebody is most likely to be looking for. On a
	 * wide screen every place is shown at once and the button never appears.
	 *
	 * Server-rendered as the full list, then trimmed on mount. A crawler and a reader with
	 * no JavaScript get all 104 links, which is the whole point of prerendering them.
	 *
	 * ## Places that sit under other places
	 *
	 * A place may name a parent - "Station Kapellen" under "Stations", the near end of a
	 * street under the street - and then it is shown indented beneath it rather than
	 * alphabetically somewhere else entirely. The unit of trimming is the parent and its
	 * children together: showing a "begin van de straat" whose street is four taps below it
	 * is worse than showing neither, because the reader cannot tell what it is the beginning
	 * of.
	 *
	 * A child whose parent is in a different family - a building under a castle, say, on the
	 * streets page - is listed at the top level here. It has to be listed somewhere, and the
	 * alternative is that it silently disappears from the only index it appears in.
	 */

	import { onMount } from 'svelte';

	export let places: { id: string; name: string; count: number; parentId?: string }[];
	/** Wording for the button, e.g. "straten" -> "Toon 10 straten meer". */
	export let noun = 'plaatsen';

	/** How many are added each time, and how many are shown to begin with. */
	const STEP = 10;

	/**
	 * Everything, until the browser says otherwise.
	 *
	 * Starting at `places.length` rather than at 10 is deliberate: the prerendered HTML then
	 * contains every link, and the trim happens after hydration on the screens that need
	 * it. Starting short would have hidden 94 streets from search engines to tidy a phone.
	 */
	let shown = places.length;

	/** True once we know this is a narrow screen, so the button may appear. */
	let trimming = false;

	onMount(() => {
		// Tailwind's `lg` breakpoint, which is where the surrounding grid goes to three
		// columns and a long list stops being a wall.
		const wide = window.matchMedia('(min-width: 1024px)');

		const apply = () => {
			trimming = !wide.matches;
			shown = trimming ? Math.min(STEP, groups.length) : groups.length;
		};

		apply();
		wide.addEventListener('change', apply);
		return () => wide.removeEventListener('change', apply);
	});

	type Place = (typeof places)[number];

	/** A parent and whatever sits under it, in the order the page received them. */
	$: groups = ((): { place: Place; children: Place[] }[] => {
		const here = new Set(places.map((place) => place.id));
		const children = new Map<string, Place[]>();

		for (const place of places) {
			if (!place.parentId || !here.has(place.parentId)) continue;
			children.set(place.parentId, [...(children.get(place.parentId) ?? []), place]);
		}

		return places
			.filter((place) => !place.parentId || !here.has(place.parentId))
			.map((place) => ({ place, children: children.get(place.id) ?? [] }));
	})();

	/**
	 * Busiest first on a phone, counting a parent's children with it: a street with two ends
	 * under it is bigger than the sum shown on its own line, and the ten shown should be the
	 * ten worth showing.
	 */
	$: ordered = trimming ? [...groups].sort((a, b) => weight(b) - weight(a)) : groups;

	function weight(group: { place: Place; children: Place[] }): number {
		return group.children.reduce((sum, child) => sum + child.count, group.place.count);
	}

	$: visible = ordered.slice(0, shown);
	$: remaining = ordered.length - visible.length;
</script>

<ul class="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
	{#each visible as group (group.place.id)}
		<li>
			<a
				class="flex items-baseline justify-between gap-3 rounded px-2 py-2.5 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-blue-950"
				href="/straat/{group.place.id}"
			>
				<span class="font-medium text-gray-900 dark:text-gray-100">{group.place.name}</span>
				<span class="shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-400"
					>{group.place.count}</span
				>
			</a>

			{#if group.children.length > 0}
				<ul class="ml-3 border-l border-gray-200 pl-2 dark:border-gray-700">
					{#each group.children as child (child.id)}
						<li>
							<a
								class="flex items-baseline justify-between gap-3 rounded px-2 py-3 text-sm hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-blue-950"
								href="/straat/{child.id}"
							>
								<span class="text-gray-700 dark:text-gray-300">{child.name}</span>
								<span class="shrink-0 tabular-nums text-gray-600 dark:text-gray-400"
									>{child.count}</span
								>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

{#if remaining > 0}
	<button
		type="button"
		class="mt-4 w-full rounded-lg border border-gray-400 px-4 py-2.5 font-semibold text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-blue-950"
		on:click={() => (shown += STEP)}
	>
		Toon {Math.min(STEP, remaining)}
		{noun} meer
		<span class="font-normal text-gray-600 dark:text-gray-400">({remaining} nog)</span>
	</button>
{/if}
