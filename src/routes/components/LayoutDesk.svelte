<script lang="ts">
	import { onMount } from 'svelte';

	import type { StoredLayout } from '$lib/admin';
	import { saveSiteLayout, siteLayouts } from '$lib/admin';
	import type { PageBlock } from '$lib/site-layout';
	import { blocksOf, layoutPages, refreshSiteLayout } from '$lib/site-layout';

	/**
	 * Rearranging the pages.
	 *
	 * Up, down, and show or hide - deliberately not drag-and-drop. Two reasons. A list this
	 * short is faster with buttons than with a drag, and a drag is the one interaction that
	 * does not work with a keyboard, a screen reader or a shaky hand without a great deal of
	 * extra code. This desk is used on a phone as often as at a desk.
	 *
	 * Nothing here can produce a broken page: every block is one a developer put in the
	 * page, and the worst an arrangement can do is leave one out.
	 */

	let stored: Record<string, StoredLayout> = {};
	let draft: Record<string, { order: string[]; hidden: string[] }> = {};
	let loading = true;
	let busy: string | null = null;
	let saved: string | null = null;
	let error: string | null = null;
	let openPage: string | null = null;

	const pages = layoutPages();
	const labels: Record<string, string> = { '/': 'Startpagina' };

	function shipped(page: string): string[] {
		return blocksOf(page).map((block) => block.id);
	}

	/** The order to show, which is the stored one extended with anything it predates. */
	function ordered(page: string, order: string[]): string[] {
		const known = shipped(page);
		const placed = order.filter((id) => known.includes(id));
		return [...placed, ...known.filter((id) => !placed.includes(id))];
	}

	onMount(async () => {
		try {
			stored = await siteLayouts();
			for (const page of pages) {
				draft[page] = {
					order: ordered(page, stored[page]?.order ?? []),
					hidden: [...(stored[page]?.hidden ?? [])]
				};
			}
			draft = draft;
			openPage = pages[0] ?? null;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			loading = false;
		}
	});

	function move(page: string, id: string, by: number): void {
		const order = [...draft[page].order];
		const at = order.indexOf(id);
		const to = at + by;
		if (at < 0 || to < 0 || to >= order.length) return;

		order.splice(to, 0, ...order.splice(at, 1));
		draft[page] = { ...draft[page], order };
		draft = draft;
	}

	function toggle(page: string, id: string): void {
		const hidden = draft[page].hidden.includes(id)
			? draft[page].hidden.filter((each) => each !== id)
			: [...draft[page].hidden, id];

		draft[page] = { ...draft[page], hidden };
		draft = draft;
	}

	/** Back to the arrangement the page ships with; saving that clears the stored row. */
	function reset(page: string): void {
		draft[page] = { order: shipped(page), hidden: [] };
		draft = draft;
	}

	/**
	 * Whether this draft differs from what the site is drawing right now.
	 *
	 * Takes the draft it is judging rather than reading `draft` itself, because Svelte works
	 * out what a template expression depends on from the names written in it: `changed(page)`
	 * would never be recomputed when a block moved, and the Opslaan button would sit there
	 * greyed out with unsaved changes behind it.
	 */
	function changed(page: string, edit: { order: string[]; hidden: string[] }): boolean {
		const now = {
			order: ordered(page, stored[page]?.order ?? []),
			hidden: [...(stored[page]?.hidden ?? [])].sort()
		};
		return (
			edit.order.join() !== now.order.join() || [...edit.hidden].sort().join() !== now.hidden.join()
		);
	}

	async function store(page: string): Promise<void> {
		busy = page;
		error = null;
		try {
			// The shipped arrangement is sent as nothing at all, which the endpoint reads as
			// a revert - so "terug naar het origineel" is the same button as "opslaan" rather
			// than a second path that can fall out of step with the first.
			const isShipped =
				draft[page].order.join() === shipped(page).join() && draft[page].hidden.length === 0;

			await saveSiteLayout(page, isShipped ? [] : draft[page].order, draft[page].hidden);
			stored = await siteLayouts();
			await refreshSiteLayout();

			draft[page] = {
				order: ordered(page, stored[page]?.order ?? []),
				hidden: [...(stored[page]?.hidden ?? [])]
			};
			draft = draft;
			saved = page;
			setTimeout(() => (saved = saved === page ? null : saved), 2500);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			busy = null;
		}
	}

	function blockOf(page: string, id: string): PageBlock | undefined {
		return blocksOf(page).find((block) => block.id === id);
	}
</script>

<section class="mt-6">
	<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">De indeling van de pagina's</h2>
	<p class="mt-1 text-gray-600 dark:text-gray-400">
		Welke blokken op een pagina staan, en in welke volgorde. Wat u opslaat staat er meteen op.
		Verbergen is niets kwijt &mdash; het blok komt terug zodra u het weer aanzet.
	</p>

	{#if error}
		<div
			class="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
		>
			<p class="font-semibold">{error}</p>
		</div>
	{/if}

	{#if loading}
		<p class="py-10 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
	{:else}
		<div class="mt-5 space-y-3">
			{#each pages as page (page)}
				<div class="rounded-xl border border-gray-300 dark:border-gray-700">
					<button
						type="button"
						class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
						on:click={() => (openPage = openPage === page ? null : page)}
					>
						<span class="font-semibold text-gray-900 dark:text-gray-100">
							{labels[page] ?? page}
							<span class="ml-2 font-normal text-gray-500 dark:text-gray-400">{page}</span>
						</span>
						<span class="shrink-0 text-sm text-gray-600 dark:text-gray-400">
							{#if stored[page]}aangepast{:else}zoals ontworpen{/if}
							<span aria-hidden="true">{openPage === page ? ' ▾' : ' ▸'}</span>
						</span>
					</button>

					{#if openPage === page && draft[page]}
						<div class="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
							<ol class="space-y-2">
								{#each draft[page].order as id, index (id)}
									{@const block = blockOf(page, id)}
									{@const off = draft[page].hidden.includes(id)}
									<li
										class="flex flex-wrap items-center gap-3 rounded-lg border p-3 {off
											? 'border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
											: 'border-gray-200 dark:border-gray-700'}"
									>
										<span class="flex shrink-0 flex-col gap-1">
											<button
												type="button"
												class="h-7 w-7 rounded border border-gray-300 text-sm leading-none disabled:opacity-30 dark:border-gray-600"
												aria-label="{block?.label} omhoog"
												disabled={index === 0}
												on:click={() => move(page, id, -1)}>&uarr;</button
											>
											<button
												type="button"
												class="h-7 w-7 rounded border border-gray-300 text-sm leading-none disabled:opacity-30 dark:border-gray-600"
												aria-label="{block?.label} omlaag"
												disabled={index === draft[page].order.length - 1}
												on:click={() => move(page, id, 1)}>&darr;</button
											>
										</span>

										<span class="min-w-0 flex-1">
											<span
												class="block font-medium {off
													? 'text-gray-500 line-through dark:text-gray-500'
													: 'text-gray-900 dark:text-gray-100'}"
											>
												{block?.label ?? id}
											</span>
											<span class="block text-sm text-gray-600 dark:text-gray-400">
												{block?.about ?? ''}
											</span>
										</span>

										{#if !block?.essential}
											<label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
												<input
													type="checkbox"
													class="h-4 w-4"
													checked={!off}
													on:change={() => toggle(page, id)}
												/>
												<span class="text-gray-700 dark:text-gray-300">Tonen</span>
											</label>
										{/if}
									</li>
								{/each}
							</ol>

							<div class="mt-4 flex flex-wrap items-center gap-3">
								<button
									type="button"
									class="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-gray-400"
									disabled={busy === page || !changed(page, draft[page])}
									on:click={() => store(page)}
								>
									{busy === page ? 'Bezig ...' : 'Opslaan'}
								</button>

								<button
									type="button"
									class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
									on:click={() => reset(page)}
								>
									Zoals ontworpen
								</button>

								<a
									class="text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
									href={page}
									target="_blank"
									rel="noreferrer">Bekijk de pagina &rarr;</a
								>

								{#if saved === page}
									<span class="text-sm font-medium text-green-800 dark:text-green-300">
										Opgeslagen &mdash; staat nu op de site.
									</span>
								{/if}
							</div>

							{#if stored[page]}
								<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
									Laatst aangepast door {stored[page].editedBy} op
									{new Date(stored[page].editedAt).toLocaleDateString('nl-BE')}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>
