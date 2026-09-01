<script lang="ts">
	import { onMount } from 'svelte';

	import type { RemovalRequest, RemovalStatus } from '../../../sharedModels/removal-request';
	import { GROUND_LABELS } from '../../../sharedModels/removal-request';
	import { removalRequests, reviewRemovalRequest } from '$lib/admin';

	/**
	 * The queue of people asking to be taken out of the archive.
	 *
	 * This is the one desk where the default is yes. `/contact` says "dat is geen discussie"
	 * and the archive means it, so the accept button is the primary one and declining asks for
	 * a note - not to justify it to the person, who is never shown it, but so the archive has
	 * its own record of why it did not do the thing it promised.
	 *
	 * Accepting hides the photograph through the photo-edit overlay, so it is off the site as
	 * soon as a browser fetches that overlay. The prerendered page and the sitemap entry go at
	 * the next deploy. Rejecting restores, which is why this hides rather than deletes.
	 */

	let showing: RemovalStatus = 'pending';
	let items: RemovalRequest[] = [];
	let loading = true;
	let error: string | null = null;
	let busy: string | null = null;
	let notes: Record<string, string> = {};

	async function refresh(): Promise<void> {
		loading = true;
		error = null;
		try {
			items = await removalRequests(showing);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			loading = false;
		}
	}

	onMount(refresh);

	async function decide(request: RemovalRequest, status: RemovalStatus): Promise<void> {
		busy = request.id;
		error = null;
		try {
			await reviewRemovalRequest(request.id, status, notes[request.id]);
			items = items.filter((other) => other.id !== request.id);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			busy = null;
		}
	}

	const TABS: [RemovalStatus, string][] = [
		['pending', 'Te behandelen'],
		['accepted', 'Weggehaald'],
		['rejected', 'Niet weggehaald']
	];
</script>

<section>
	<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Verzoeken om weg te halen</h2>
	<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
		Mensen die op een foto staan en vragen of ze weg mag. Op <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/contact">Contact</a
		> staat dat dat geen discussie is. Weghalen verbergt de foto meteen overal op de site; de opgeslagen
		pagina en de sitemap volgen bij de eerstvolgende publicatie.
	</p>

	<nav class="mt-4 flex gap-2">
		{#each TABS as [value, label] (value)}
			<button
				type="button"
				class="rounded-lg px-4 py-2 font-medium transition {showing === value
					? 'bg-blue-800 text-white'
					: 'border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'}"
				on:click={() => {
					showing = value;
					refresh();
				}}
			>
				{label}
			</button>
		{/each}
	</nav>

	{#if error}
		<p
			class="mt-4 rounded bg-red-50 p-3 text-sm font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
		>
			{error}
		</p>
	{/if}

	{#if loading}
		<p class="py-10 text-center text-gray-600 dark:text-gray-400">Bezig met laden ...</p>
	{:else if items.length === 0}
		<p class="py-10 text-center text-gray-700 dark:text-gray-300">
			{showing === 'pending' ? 'Niets te behandelen.' : 'Niets hier.'}
		</p>
	{:else}
		<ul class="mt-4 space-y-4">
			{#each items as request (request.id)}
				<li
					class="rounded-xl border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<a
							class="font-semibold text-blue-800 underline hover:no-underline dark:text-blue-300"
							href="/foto/{request.photoId}"
							target="_blank"
							rel="noreferrer">{request.photoTitle}</a
						>
						<span class="text-sm text-gray-600 dark:text-gray-400">
							{new Date(request.submittedAt).toLocaleString('nl-BE')}
						</span>
					</div>

					<p class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
						{GROUND_LABELS[request.ground] ?? request.ground}
					</p>

					{#if request.message}
						<p class="mt-2 whitespace-pre-line text-gray-800 dark:text-gray-200">
							{request.message}
						</p>
					{/if}

					{#if request.contributor?.name || request.contributor?.email}
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
							{request.contributor.name ?? ''}
							{#if request.contributor.email}
								&middot; <a
									class="text-blue-800 underline hover:no-underline dark:text-blue-300"
									href="mailto:{request.contributor.email}">{request.contributor.email}</a
								>
							{/if}
						</p>
					{/if}

					{#if showing === 'pending'}
						<label class="mt-3 block">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Notitie voor het archief
								<span class="font-normal text-gray-600 dark:text-gray-400">
									(verplicht als u niet weghaalt; de aanvrager ziet dit niet)
								</span>
							</span>
							<input
								bind:value={notes[request.id]}
								class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
							/>
						</label>

						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:bg-gray-400"
								disabled={busy === request.id}
								on:click={() => decide(request, 'accepted')}
							>
								{busy === request.id ? 'Bezig ...' : 'Haal de foto weg'}
							</button>
							<button
								type="button"
								class="rounded-lg border border-gray-400 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
								disabled={busy === request.id || !notes[request.id]?.trim()}
								title={notes[request.id]?.trim() ? '' : 'Noteer eerst waarom niet'}
								on:click={() => decide(request, 'rejected')}
							>
								Niet weghalen
							</button>
						</div>
					{:else}
						<div class="mt-3 flex flex-wrap items-center gap-3">
							<span class="text-sm text-gray-600 dark:text-gray-400">
								{request.status === 'accepted' ? 'Weggehaald' : 'Niet weggehaald'} door
								{request.reviewedBy}{#if request.note} &middot; {request.note}{/if}
							</span>
							<button
								type="button"
								class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
								disabled={busy === request.id}
								on:click={() => decide(request, 'pending')}
								title="Zet terug in de wachtrij en maak de foto weer zichtbaar"
							>
								Terug in de wachtrij
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
