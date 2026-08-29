<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import type { Curator, Decision, QueuedSubmission } from '$lib/admin';
	import { isConfigured, queue, review, signIn, signOut, watchSignIn, whoAmI } from '$lib/admin';

	/**
	 * The curator's desk.
	 *
	 * Everything an approved photograph needs that a filename cannot give it - a title, the
	 * street it belongs to, a house number, a year, who gave it - is set here by a person,
	 * one photograph at a time. Approving publishes it immediately; the archive's own record
	 * catches up later.
	 *
	 * The page shows nothing until the server has confirmed the account curates this archive.
	 * That check is the server's, not this page's: hiding a button protects nobody.
	 */

	let archive: Archive | null = null;
	let curator: Curator | null = null;
	let signedInAs: string | null = null;
	let checking = true;
	let error: string | null = null;

	let showing: 'pending' | 'approved' | 'rejected' = 'pending';

	const tabs: ['pending' | 'approved' | 'rejected', string][] = [
		['pending', 'Te bekijken'],
		['approved', 'Goedgekeurd'],
		['rejected', 'Afgewezen']
	];
	let items: QueuedSubmission[] = [];
	let loading = false;

	/** Edits in progress, keyed by submission id, so a half-filled form is not lost. */
	let edits: Record<string, Decision> = {};
	let busy: string | null = null;

	onMount(async () => {
		if (!isConfigured()) {
			error =
				'Firebase is niet ingesteld in deze build. Zet de VITE_FIREBASE_* waarden in .env - zie .env.example.';
			checking = false;
			return;
		}

		try {
			await watchSignIn(async (email) => {
				signedInAs = email;
				curator = null;

				if (!email) {
					checking = false;
					return;
				}

				checking = true;
				try {
					curator = await whoAmI();
					error = null;
					await refresh();
				} catch (e) {
					// A signed-in account that is not on the list: say so plainly rather than
					// showing an empty page that looks broken.
					error = e instanceof Error ? e.message : String(e);
				} finally {
					checking = false;
				}
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			checking = false;
		}

		try {
			archive = await loadArchive();
		} catch {
			// The queue works without it; only the street picker needs the archive.
		}
	});

	async function refresh(): Promise<void> {
		loading = true;
		try {
			items = await queue(showing);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function editsFor(item: QueuedSubmission): Decision {
		if (!edits[item.id]) {
			edits[item.id] = {
				id: item.id,
				status: 'approved',
				title: item.title ?? item.originalName.replace(/\.[^.]+$/, ''),
				places: item.places ?? [],
				...(item.houseNumber != null ? { houseNumber: item.houseNumber } : {}),
				...(item.year ? { year: item.year } : {}),
				donor: item.donor ?? item.contributor.name ?? ''
			};
		}
		return edits[item.id];
	}

	async function decide(item: QueuedSubmission, status: Decision['status']): Promise<void> {
		busy = item.id;
		try {
			const decision: Decision = { ...editsFor(item), status };

			if (status === 'rejected') {
				const reason = window.prompt('Waarom wordt deze foto afgewezen?') ?? '';
				if (!reason.trim()) {
					busy = null;
					return;
				}
				decision.rejectionReason = reason.trim();
			}

			await review(decision);
			delete edits[item.id];
			edits = edits;
			items = items.filter((other) => other.id !== item.id);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = null;
		}
	}

	/** Places a curator can file a photograph under, busiest first so the common ones lead. */
	$: places = archive
		? [...archive.places].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		: [];

	function togglePlace(item: QueuedSubmission, placeId: string): void {
		const current = editsFor(item);
		const chosen = current.places ?? [];
		current.places = chosen.includes(placeId)
			? chosen.filter((id) => id !== placeId)
			: [...chosen, placeId];
		edits = edits;
	}

	function readableSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
	}
</script>

<svelte:head>
	<title>Beheer | gzvKA fotoarchief</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900">Beheer</h1>

		{#if signedInAs}
			<div class="flex items-center gap-3 text-sm">
				<span class="text-gray-600">{signedInAs}</span>
				<button
					type="button"
					class="rounded border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-100"
					on:click={signOut}
				>
					Afmelden
				</button>
			</div>
		{/if}
	</header>

	{#if error}
		<div class="mt-6 rounded-xl border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">{error}</p>
		</div>
	{/if}

	{#if checking}
		<p class="py-16 text-center text-gray-500">Bezig met aanmelden ...</p>
	{:else if !curator}
		<div class="mt-8 rounded-xl border border-gray-300 bg-gray-50 p-8 text-center">
			<h2 class="text-xl font-bold text-gray-900">Aanmelden</h2>
			<p class="mx-auto mt-2 max-w-md text-gray-600">
				Deze pagina is voor wie het archief beheert. Meld u aan met het Google-account dat op de
				beheerderslijst staat.
			</p>
			<button
				type="button"
				class="mt-5 rounded-lg bg-blue-800 px-6 py-3 font-semibold text-white hover:bg-blue-900"
				on:click={signIn}
				disabled={!isConfigured()}
			>
				Aanmelden met Google
			</button>
		</div>
	{:else}
		<nav class="mt-6 flex gap-2">
			{#each tabs as [value, label] (value)}
				<button
					type="button"
					class="rounded-lg px-4 py-2 font-medium transition {showing === value
						? 'bg-blue-800 text-white'
						: 'border border-gray-300 text-gray-800 hover:bg-gray-100'}"
					on:click={() => {
						showing = value;
						refresh();
					}}
				>
					{label}
				</button>
			{/each}
		</nav>

		{#if loading}
			<p class="py-16 text-center text-gray-500">Bezig met laden ...</p>
		{:else if items.length === 0}
			<p class="py-16 text-center text-gray-600">
				{showing === 'pending' ? 'Niets te bekijken. Alles is afgehandeld.' : 'Niets hier.'}
			</p>
		{:else}
			<ul class="mt-6 space-y-6">
				{#each items as item (item.id)}
					{@const ready = editsFor(item)}
					<li class="rounded-xl border border-gray-300 bg-white p-4 lg:flex lg:gap-6">
						<div class="lg:w-80 lg:shrink-0">
							<img
								src={item.previewUrl}
								alt={item.originalName}
								class="w-full rounded-lg border border-gray-200 bg-gray-100 object-contain"
							/>
							<p class="mt-2 truncate text-sm text-gray-500" title={item.originalName}>
								{item.originalName} &middot; {readableSize(item.bytes)}
							</p>
							<p class="text-sm text-gray-500">
								Ingestuurd {new Date(item.submittedAt).toLocaleDateString('nl-BE')}
								{#if item.contributor.name}door {item.contributor.name}{/if}
							</p>
							{#if item.contributor.email}
								<p class="text-sm text-gray-500">{item.contributor.email}</p>
							{/if}
							{#if item.contributor.note}
								<p class="mt-2 rounded bg-amber-50 p-2 text-sm text-gray-800">
									&ldquo;{item.contributor.note}&rdquo;
								</p>
							{/if}
							{#if item.rejectionReason}
								<p class="mt-2 rounded bg-red-50 p-2 text-sm text-red-900">
									Afgewezen: {item.rejectionReason}
								</p>
							{/if}
						</div>

						<div class="mt-4 min-w-0 flex-1 lg:mt-0">
							<label class="block">
								<span class="text-sm font-medium text-gray-700">Titel</span>
								<input
									bind:value={edits[item.id].title}
									class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
								/>
							</label>

							<div class="mt-3 grid gap-3 sm:grid-cols-3">
								<label class="block">
									<span class="text-sm font-medium text-gray-700">Huisnummer</span>
									<input
										type="number"
										bind:value={edits[item.id].houseNumber}
										class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
									/>
								</label>
								<label class="block">
									<span class="text-sm font-medium text-gray-700">Jaartal</span>
									<input
										bind:value={edits[item.id].year}
										placeholder="1935"
										class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
									/>
								</label>
								<label class="block">
									<span class="text-sm font-medium text-gray-700">Ingezonden door</span>
									<input
										bind:value={edits[item.id].donor}
										class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
									/>
								</label>
							</div>

							<div class="mt-3">
								<p class="text-sm font-medium text-gray-700">
									Plaats
									{#if ready.places && ready.places.length > 0}
										<span class="font-normal text-gray-500">({ready.places.length} gekozen)</span>
									{/if}
								</p>

								{#if ready.places && ready.places.length > 0}
									<ul class="mt-1 flex flex-wrap gap-1">
										{#each ready.places as placeId (placeId)}
											<li>
												<button
													type="button"
													class="rounded-full bg-blue-800 px-3 py-1 text-sm text-white"
													on:click={() => togglePlace(item, placeId)}
												>
													{archive?.placeById.get(placeId)?.name ?? placeId} &times;
												</button>
											</li>
										{/each}
									</ul>
								{/if}

								<select
									class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
									on:change={(event) => {
										if (event.currentTarget.value) togglePlace(item, event.currentTarget.value);
										event.currentTarget.value = '';
									}}
								>
									<option value="">Straat of plaats toevoegen ...</option>
									{#each places as place (place.id)}
										<option value={place.id}>{place.name} ({place.count})</option>
									{/each}
								</select>
							</div>

							<div class="mt-5 flex flex-wrap gap-2">
								{#if item.status !== 'approved'}
									<button
										type="button"
										class="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:bg-gray-400"
										disabled={busy === item.id}
										on:click={() => decide(item, 'approved')}
									>
										{busy === item.id ? 'Bezig ...' : 'Goedkeuren en publiceren'}
									</button>
								{/if}

								{#if item.status !== 'rejected'}
									<button
										type="button"
										class="rounded-lg border-2 border-red-600 px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
										disabled={busy === item.id}
										on:click={() => decide(item, 'rejected')}
									>
										Afwijzen
									</button>
								{/if}

								{#if item.status !== 'pending'}
									<button
										type="button"
										class="rounded-lg border border-gray-400 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
										disabled={busy === item.id}
										on:click={() => decide(item, 'pending')}
									>
										Terug naar de wachtrij
									</button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
