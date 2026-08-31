<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { donors as allDonors } from '$lib/archive';
	import { renameDonor } from '$lib/admin';
	import { likelyDuplicates, type DonorLike } from '../../../sharedModels/donor-similarity';
	import { normalizeText } from '../../../sharedModels/text';

	/**
	 * The people who gave the archive its photographs, and the tools to keep them one person
	 * each.
	 *
	 * A donor has no record: the name is a string on every photograph and identity is its
	 * slug, worked out when the site builds its list. So the archive already merges what the
	 * slug merges, and forks on everything else - and it forks silently, into a second
	 * /schenker page with one photograph on it.
	 *
	 * Which is not hypothetical. On the day this was written the live archive held "Swatti
	 * Alix" with 362 photographs and "Alix Swatti" with 2; "Heemkring Hoghescote" with 328 and
	 * "Heemkring Hogeschote" with 20. Nobody was going to find those by reading 295 names.
	 *
	 * So the desk leads with the pairs rather than the list. Renaming is the only operation
	 * there is, because renaming IS merging: write the same string onto both sets and the
	 * slug does the rest.
	 */

	export let archive: Archive | null = null;

	const dispatch = createEventDispatcher<{ changed: void }>();

	let query = '';
	let busy: string | null = null;
	let error: string | null = null;
	let done: string | null = null;
	/** The donor whose rename form is open, by slug. */
	let editing: string | null = null;
	let newName = '';

	$: everyone = archive
		? allDonors(archive).map((donor) => ({
				slug: donor.slug,
				name: donor.name,
				count: donor.photos.length,
				photoIds: donor.photos.map((photo) => photo.id)
		  }))
		: [];

	$: bySlug = new Map(everyone.map((donor) => [donor.slug, donor]));

	/** Pairs worth a look, computed over all of them rather than over the search results. */
	$: pairs = likelyDuplicates(
		everyone.map(({ slug, name, count }): DonorLike => ({ slug, name, count }))
	);

	$: needle = normalizeText(query.trim());
	$: shown = needle
		? everyone.filter((donor) => normalizeText(donor.name).includes(needle))
		: everyone;

	function open(slug: string, name: string): void {
		editing = slug;
		newName = name;
		error = null;
		done = null;
	}

	/**
	 * Writes one name across every photograph of one donor - or of two, which is what a merge
	 * is here. `extra` carries the second donor's photographs when the curator is merging.
	 */
	async function apply(slug: string, extra: string[] = []): Promise<void> {
		const donor = bySlug.get(slug);
		const name = newName.trim();
		if (!donor || !name || busy) return;

		busy = slug;
		error = null;
		done = null;

		try {
			const ids = [...new Set([...donor.photoIds, ...extra])];
			const result = await renameDonor(ids, name);

			done = `${result.changed} ${result.changed === 1 ? 'foto' : "foto's"} staan nu op "${name}".`;
			editing = null;
			dispatch('changed');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = null;
		}
	}

	/** Merge: the smaller side's photographs are rewritten to the larger side's spelling. */
	async function merge(keep: DonorLike, drop: DonorLike): Promise<void> {
		const other = bySlug.get(drop.slug);
		if (!other) return;

		newName = keep.name;
		await apply(keep.slug, other.photoIds);
	}
</script>

<section>
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Schenkers</h2>
			<p class="mt-1 text-gray-600 dark:text-gray-400">
				{everyone.length} namen. Een schenker is geen apart record: de naam staat op elke foto, en twee
				schrijfwijzen zijn twee pagina's. Hernoemen is hier hetzelfde als samenvoegen.
			</p>
		</div>
	</div>

	{#if error}
		<p
			class="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
		>
			{error}
		</p>
	{/if}
	{#if done}
		<p
			class="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
		>
			{done}
		</p>
	{/if}

	{#if pairs.length > 0}
		<div
			class="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
		>
			<h3 class="font-bold text-amber-900 dark:text-amber-200">
				Waarschijnlijk dezelfde persoon ({pairs.length})
			</h3>
			<p class="mt-1 text-sm text-amber-900 dark:text-amber-200">
				Voorstellen, geen zekerheden &mdash; twee broers kunnen echt A. en Alfons heten. Kies zelf
				welke schrijfwijze blijft.
			</p>

			<ul class="mt-3 space-y-2">
				{#each pairs as pair (pair.a.slug + pair.b.slug)}
					<li
						class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white p-3 dark:bg-gray-900"
					>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							<strong>{pair.a.name}</strong> ({pair.a.count}) &harr;
							<strong>{pair.b.name}</strong> ({pair.b.count})
						</span>
						<span class="text-xs text-gray-500 dark:text-gray-400">{pair.reason}</span>

						<span class="ml-auto flex flex-wrap gap-2">
							<button
								type="button"
								class="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-blue-950"
								disabled={busy !== null}
								on:click={() => merge(pair.a, pair.b)}
							>
								Alles &rarr; {pair.a.name}
							</button>
							<button
								type="button"
								class="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-blue-950"
								disabled={busy !== null}
								on:click={() => merge(pair.b, pair.a)}
							>
								Alles &rarr; {pair.b.name}
							</button>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<label class="mt-6 block">
		<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Zoek een schenker</span>
		<input
			bind:value={query}
			placeholder="Naam"
			class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
		/>
	</label>

	<ul class="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
		{#each shown.slice(0, 200) as donor (donor.slug)}
			<li class="py-2">
				<div class="flex flex-wrap items-center gap-3">
					<a
						class="font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
						href="/schenker/{donor.slug}"
						target="_blank"
						rel="noreferrer"
					>
						{donor.name}
					</a>
					<span class="text-sm tabular-nums text-gray-500 dark:text-gray-400">
						{donor.count}
						{donor.count === 1 ? 'foto' : "foto's"}
					</span>
					<button
						type="button"
						class="ml-auto rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-blue-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-blue-950"
						on:click={() =>
							editing === donor.slug ? (editing = null) : open(donor.slug, donor.name)}
					>
						Hernoemen
					</button>
				</div>

				{#if editing === donor.slug}
					<div class="mt-2 flex flex-wrap items-end gap-2">
						<label class="min-w-[16rem] flex-1">
							<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
								Nieuwe schrijfwijze &mdash; op alle {donor.count}
								{donor.count === 1 ? 'foto' : "foto's"}
							</span>
							<input
								bind:value={newName}
								class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
							/>
						</label>
						<button
							type="button"
							class="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-gray-400"
							disabled={busy !== null || !newName.trim() || newName.trim() === donor.name}
							on:click={() => apply(donor.slug)}
						>
							{busy === donor.slug ? 'Bezig ...' : 'Opslaan'}
						</button>
					</div>
					{#if bySlug.has(donor.slug) && newName.trim() && newName.trim() !== donor.name}
						<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
							Bestaat die naam al, dan komen deze foto's bij die pagina terecht &mdash; dat is hoe
							samenvoegen werkt.
						</p>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>

	{#if shown.length > 200}
		<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
			{shown.length} gevonden, de eerste 200 staan hierboven. Zoek verder om te verfijnen.
		</p>
	{/if}
</section>
