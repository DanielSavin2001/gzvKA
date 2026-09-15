<script lang="ts">
	import { onMount } from 'svelte';

	import type { StoredCopy } from '$lib/admin';
	import { saveSiteCopy, siteCopyEdits } from '$lib/admin';
	import { COPY_LIMITS, COPY_SLOTS, copyPages, refreshSiteCopy } from '$lib/site-copy';

	/**
	 * Rewriting the words on the site.
	 *
	 * Everything a visitor reads that is not a photograph's own caption used to live in a
	 * Svelte component, which meant a developer. That has already cost something readable:
	 * the timeline told people its newest photographs were "tot vorig jaar" for seven years,
	 * because the person who noticed could not change it.
	 *
	 * Each box below is one sentence on one page. Saving one is live immediately - the same
	 * overlay a corrected caption rides - and clearing one puts back the words the site
	 * shipped with, which is why there is no separate "reset" to get wrong.
	 */

	let stored: Record<string, StoredCopy> = {};
	let drafts: Record<string, string> = {};
	let loading = true;
	let busy: string | null = null;
	let saved: string | null = null;
	let error: string | null = null;
	let openPage: string | null = null;

	const pages = copyPages();
	const labels: Record<string, string> = {
		'/': 'Startpagina',
		'/over-ons': 'Over ons',
		'/contact': 'Contact',
		'/privacy': 'Privacy en cookies',
		'/upload': 'Stuur een foto in',
		'/tijdlijn': 'Tijdlijn',
		'/verhalen': 'Verhalen',
		'/onderwerpen': 'Onderwerpen',
		'/straten': 'Straten',
		'/kastelen': 'Kastelen',
		'/wijken': 'Wijken',
		'/toen-en-nu': 'Toen en nu',
		'/schenker': 'Schenkers'
	};

	onMount(async () => {
		try {
			stored = await siteCopyEdits();
			// The box starts on what the site currently says - the curator's own text when
			// there is one, the shipped words otherwise - so editing is always editing what
			// is actually on the page rather than filling an empty field.
			for (const slot of COPY_SLOTS) drafts[slot.id] = stored[slot.id]?.text ?? slot.fallback;
			drafts = drafts;
			openPage = pages[0] ?? null;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			loading = false;
		}
	});

	/** Whether this box differs from what is on the site right now. */
	function changed(id: string, draft: string): boolean {
		const showing = stored[id]?.text ?? COPY_SLOTS.find((slot) => slot.id === id)?.fallback ?? '';
		return draft.trim() !== showing.trim();
	}

	async function store(id: string): Promise<void> {
		busy = id;
		error = null;
		try {
			await saveSiteCopy(id, drafts[id] ?? '');
			stored = await siteCopyEdits();
			// The page a curator is about to go and check reads from the store, not from this
			// desk, so it has to be told past every cache - otherwise they look at their own
			// change and see the sentence they replaced.
			await refreshSiteCopy();

			drafts[id] = stored[id]?.text ?? COPY_SLOTS.find((slot) => slot.id === id)?.fallback ?? '';
			drafts = drafts;
			saved = id;
			setTimeout(() => (saved = saved === id ? null : saved), 2500);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			busy = null;
		}
	}

	/** Puts the shipped words back in the box; saving then clears the stored row. */
	function revert(id: string): void {
		const slot = COPY_SLOTS.find((each) => each.id === id);
		if (!slot) return;

		drafts[id] = slot.fallback;
		drafts = drafts;
	}

	$: rewritten = COPY_SLOTS.filter((slot) => stored[slot.id]).length;
</script>

<section class="mt-6">
	<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">De teksten op de site</h2>
	<p class="mt-1 text-gray-600 dark:text-gray-400">
		Hier staat elke vaste zin van de site. Wat u opslaat staat er meteen op &mdash; er hoeft niets
		opnieuw gebouwd of uitgerold te worden. Maakt u een vakje leeg, of zet u de oorspronkelijke
		tekst terug, dan gebruikt de site weer haar eigen woorden.
	</p>
	<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
		Zinnen met een link erin staan hier niet tussen: die hebben opmaak nodig die niet in een
		tekstvakje past.
		{#if rewritten > 0}
			&middot; {rewritten}
			{rewritten === 1 ? 'zin is' : 'zinnen zijn'} aangepast.
		{/if}
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
				{@const slots = COPY_SLOTS.filter((slot) => slot.page === page)}
				{@const touched = slots.filter((slot) => stored[slot.id]).length}
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
							{slots.length}
							{slots.length === 1 ? 'zin' : 'zinnen'}{#if touched}
								&middot; {touched} aangepast{/if}
							<span aria-hidden="true">{openPage === page ? ' ▾' : ' ▸'}</span>
						</span>
					</button>

					{#if openPage === page}
						<div class="space-y-5 border-t border-gray-200 px-4 py-4 dark:border-gray-800">
							{#each slots as slot (slot.id)}
								<div>
									<label class="block">
										<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
											{slot.label}
											{#if stored[slot.id]}
												<span class="ml-1 font-normal text-amber-700 dark:text-amber-300">
													&middot; aangepast door {stored[slot.id].editedBy} op
													{new Date(stored[slot.id].editedAt).toLocaleDateString('nl-BE')}
												</span>
											{/if}
										</span>
										{#if slot.kind === 'heading'}
											<input
												bind:value={drafts[slot.id]}
												maxlength={COPY_LIMITS.heading}
												class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
											/>
										{:else}
											<textarea
												bind:value={drafts[slot.id]}
												maxlength={COPY_LIMITS.text}
												rows={Math.min(
													8,
													Math.max(2, Math.ceil((drafts[slot.id]?.length ?? 0) / 90))
												)}
												class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
											/>
										{/if}
									</label>

									<div class="mt-2 flex flex-wrap items-center gap-3">
										<button
											type="button"
											class="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:bg-gray-400"
											disabled={busy === slot.id || !changed(slot.id, drafts[slot.id] ?? '')}
											on:click={() => store(slot.id)}
										>
											{busy === slot.id ? 'Bezig ...' : 'Opslaan'}
										</button>

										{#if stored[slot.id] || changed(slot.id, drafts[slot.id] ?? '')}
											<button
												type="button"
												class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
												on:click={() => revert(slot.id)}
											>
												Oorspronkelijke tekst
											</button>
										{/if}

										{#if saved === slot.id}
											<span class="text-sm font-medium text-green-800 dark:text-green-300">
												Opgeslagen &mdash; staat nu op de site.
											</span>
										{/if}
									</div>

									{#if stored[slot.id]?.was}
										<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
											Hiervoor: &ldquo;{stored[slot.id].was}&rdquo;
										</p>
									{/if}
								</div>
							{/each}

							<a
								class="inline-block text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
								href={page}
								target="_blank"
								rel="noreferrer">Bekijk {labels[page] ?? page} op de site &rarr;</a
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>
