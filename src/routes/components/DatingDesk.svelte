<script lang="ts">
	/**
	 * The curator's desk for years.
	 *
	 * 3,896 of the 4,504 photographs have no year, so the timeline shows an eighth of the
	 * archive. Two things fill that in, and they belong side by side because they are the
	 * same job from two directions: what the public suggests, and what a curator knows.
	 *
	 * The dating tool is built around one observation - photographs in a folder are usually
	 * from the same day. So it works a folder at a time and remembers the last year entered,
	 * which turns "type 1962, Enter" into "Enter" for the rest of the roll. Keyboard only:
	 * the field keeps focus, Enter saves and advances, and a folder of sixty is a couple of
	 * minutes rather than an afternoon of clicking.
	 */

	import { onMount, tick } from 'svelte';

	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { sortForDisplay, thumbUrl } from '$lib/archive';
	import { judgePhotoFact, photoFacts, savePhotoEdit } from '$lib/admin';
	import type { PhotoEdit } from '$lib/photo-edits';
	import { forgetPhotoEdits } from '$lib/photo-edits';
	import type { PhotoFact } from '../../../sharedModels/photo-fact';
	import { PhotoFactError, readYear } from '../../../sharedModels/photo-fact';

	export let archive: Archive;
	/** The corrections already made, so a saved year merges rather than replacing them. */
	export let edits: Record<string, PhotoEdit> = {};

	const latestYear = new Date().getFullYear();

	let mode: 'voorstellen' | 'dateren' = 'voorstellen';

	// ---- What the public suggested -------------------------------------------------

	let suggestions: PhotoFact[] = [];
	let loadingSuggestions = true;
	let busyId: string | null = null;
	let error: string | null = null;

	async function loadSuggestions(): Promise<void> {
		loadingSuggestions = true;
		error = null;
		try {
			suggestions = await photoFacts('pending');
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			loadingSuggestions = false;
		}
	}

	async function judge(fact: PhotoFact, status: 'accepted' | 'rejected'): Promise<void> {
		const reason =
			status === 'rejected' ? window.prompt('Waarom niet? (wordt bewaard)') ?? '' : undefined;

		// A rejection with no reason is refused by the server, so stop here rather than
		// making the round trip to be told.
		if (status === 'rejected' && !reason?.trim()) return;

		busyId = fact.id;
		error = null;
		try {
			await judgePhotoFact({ id: fact.id, status, ...(reason ? { reason } : {}) });
			suggestions = suggestions.filter((other) => other.id !== fact.id);

			// The overlay changed, so anything reading it has to fetch again or the curator
			// sees their own decision fail to appear.
			if (status === 'accepted') forgetPhotoEdits();
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			busyId = null;
		}
	}

	onMount(loadSuggestions);

	// ---- Dating a folder ------------------------------------------------------------

	/**
	 * Every subject folder, with how many of its photographs still have no year.
	 *
	 * One pass over the photographs rather than one pass per folder - the obvious spelling
	 * scans all 4,504 photographs 79 times over.
	 */
	$: folders = ((): { name: string; undated: number; total: number }[] => {
		const counts = new Map<string, { name: string; undated: number; total: number }>();

		for (const photo of archive.photos) {
			let folder = counts.get(photo.s);
			if (!folder) {
				folder = { name: photo.s, undated: 0, total: 0 };
				counts.set(photo.s, folder);
			}
			folder.total += 1;
			if (!photo.y) folder.undated += 1;
		}

		return (
			[...counts.values()]
				.filter((folder) => folder.undated > 0)
				// Most to gain first: a folder of 512 undated photographs is where the
				// timeline actually grows.
				.sort((a, b) => b.undated - a.undated)
		);
	})();

	let chosen = '';
	/** The undated photographs of the chosen folder, fixed when it is chosen. */
	let queue: ArchivePhoto[] = [];
	let at = 0;
	let year = '';
	let saving = false;
	let saved = 0;
	let field: HTMLInputElement | null = null;

	$: current = at < queue.length ? queue[at] : null;

	$: yearProblem = ((): string | null => {
		if (!year.trim()) return null;
		try {
			readYear(year, latestYear);
			return null;
		} catch (problem) {
			return problem instanceof PhotoFactError ? problem.message : null;
		}
	})();

	function openFolder(name: string): void {
		chosen = name;
		queue = sortForDisplay(archive.photos.filter((photo) => photo.s === name && !photo.y));
		at = 0;
		saved = 0;
		focusField();
	}

	async function focusField(): Promise<void> {
		await tick();
		field?.focus();
		field?.select();
	}

	function skip(): void {
		at += 1;
		// The year deliberately survives a skip. A folder is usually one day, so the next
		// photograph is usually the same year, and retyping it sixty times is the whole
		// thing this screen exists to avoid.
		focusField();
	}

	async function keep(): Promise<void> {
		if (!current || yearProblem || !year.trim()) return;

		saving = true;
		error = null;
		try {
			const existing = edits[current.id];
			// The whole patch, not just the year: `savePhotoEdit` replaces rather than
			// merges, so sending the year alone would erase a corrected title or street.
			await savePhotoEdit(current.id, {
				...(existing?.title ? { title: existing.title } : {}),
				...(existing?.subject ? { subject: existing.subject } : {}),
				...(existing?.places ? { places: existing.places } : {}),
				...(existing?.houseNumber ? { houseNumber: existing.houseNumber } : {}),
				...(existing?.donor ? { donor: existing.donor } : {}),
				...(existing?.description ? { description: existing.description } : {}),
				year: readYear(year, latestYear)
			});

			forgetPhotoEdits();
			saved += 1;
			at += 1;
			focusField();
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			saving = false;
		}
	}

	function onFieldKey(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			keep();
		}
		// Down arrow skips, so the whole pass is one hand on the keyboard without ever
		// reaching for the mouse.
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			skip();
		}
	}
</script>

<nav class="mt-6 flex gap-2">
	{#each [['voorstellen', 'Voorstellen van bezoekers'], ['dateren', 'Zelf dateren']] as [value, label] (value)}
		<button
			type="button"
			class="rounded-lg px-4 py-2 font-medium transition {mode === value
				? 'bg-blue-800 text-white'
				: 'border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'}"
			on:click={() => (mode = value === 'dateren' ? 'dateren' : 'voorstellen')}
		>
			{label}
			{#if value === 'voorstellen' && suggestions.length > 0}
				<span class="ml-1 rounded-full bg-amber-500 px-2 text-sm text-white">
					{suggestions.length}
				</span>
			{/if}
		</button>
	{/each}
</nav>

{#if error}
	<p
		class="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
	>
		{error}
	</p>
{/if}

{#if mode === 'voorstellen'}
	<section class="mt-6">
		{#if loadingSuggestions}
			<p class="py-10 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
		{:else if suggestions.length === 0}
			<p class="py-10 text-center text-gray-500 dark:text-gray-400">
				Geen voorstellen op dit moment.
			</p>
		{:else}
			<ul class="space-y-4">
				{#each suggestions as fact (fact.id)}
					{@const photo = archive.photoById.get(fact.photoId)}
					<li
						class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row dark:border-gray-700 dark:bg-gray-900"
					>
						{#if photo}
							<a href="/foto/{photo.id}" class="shrink-0">
								<img
									src={thumbUrl(archive, photo)}
									alt={photo.t}
									class="h-32 w-44 rounded-lg object-cover"
								/>
							</a>
						{/if}

						<div class="min-w-0 flex-1">
							<p class="font-semibold text-gray-900 dark:text-gray-100">{fact.photoTitle}</p>
							<p class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
								{fact.year}
								{#if fact.previousYear}
									<span class="text-sm font-normal text-gray-500 line-through dark:text-gray-400">
										{fact.previousYear}
									</span>
								{/if}
							</p>
							{#if fact.message}
								<p class="mt-1 text-sm italic text-gray-700 dark:text-gray-300">
									&ldquo;{fact.message}&rdquo;
								</p>
							{/if}
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{fact.contributor.name || 'Anoniem'} &middot; {new Date(
									fact.submittedAt
								).toLocaleDateString('nl-BE')}
							</p>

							<div class="mt-3 flex gap-2">
								<button
									type="button"
									class="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
									disabled={busyId === fact.id}
									on:click={() => judge(fact, 'accepted')}
								>
									Klopt &mdash; zet erbij
								</button>
								<button
									type="button"
									class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
									disabled={busyId === fact.id}
									on:click={() => judge(fact, 'rejected')}
								>
									Afwijzen
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{:else}
	<section class="mt-6">
		{#if !chosen}
			<p class="text-gray-600 dark:text-gray-400">
				Kies een map. Foto's uit dezelfde map zijn meestal van dezelfde dag, dus het jaartal blijft
				staan &mdash; na de eerste is het meestal alleen nog Enter.
			</p>
			<ul class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each folders as folder (folder.name)}
					<li>
						<button
							type="button"
							class="flex w-full items-baseline justify-between gap-3 rounded-lg border border-gray-300 px-3 py-2 text-left hover:border-blue-700 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950"
							on:click={() => openFolder(folder.name)}
						>
							<span class="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">
								{folder.name}
							</span>
							<span class="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">
								{folder.undated}/{folder.total}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="font-semibold text-gray-900 dark:text-gray-100">{chosen}</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{Math.min(at + 1, queue.length)} van {queue.length} &middot; {saved} gedateerd
					</p>
				</div>
				<button
					type="button"
					class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
					on:click={() => (chosen = '')}
				>
					Andere map
				</button>
			</div>

			{#if !current}
				<p
					class="mt-8 rounded-xl border border-green-300 bg-green-50 p-6 text-center font-semibold text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
				>
					Klaar met deze map. {saved}
					{saved === 1 ? 'foto' : "foto's"} gedateerd.
				</p>
			{:else}
				<div class="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
					<div
						class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
					>
						<img
							src={thumbUrl(archive, current)}
							alt={current.t}
							class="mx-auto max-h-[60vh] w-auto rounded-lg object-contain"
						/>
					</div>

					<div>
						<p class="font-semibold text-gray-900 dark:text-gray-100">{current.t}</p>
						{#if current.d}
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">van {current.d}</p>
						{/if}
						{#if current.a}
							<p class="text-sm text-gray-500 dark:text-gray-400">
								ontvangen {current.a}
							</p>
						{/if}

						<label class="mt-4 block">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Jaartal</span>
							<input
								bind:this={field}
								bind:value={year}
								on:keydown={onFieldKey}
								inputmode="numeric"
								placeholder="1962"
								class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-2xl font-bold tabular-nums text-gray-900 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
							/>
						</label>

						{#if yearProblem}
							<p class="mt-2 text-sm font-semibold text-red-800 dark:text-red-300">{yearProblem}</p>
						{/if}

						<div class="mt-4 flex gap-2">
							<button
								type="button"
								class="rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
								disabled={saving || !year.trim() || yearProblem !== null}
								on:click={keep}
							>
								{saving ? 'Bezig ...' : 'Bewaren'}
							</button>
							<button
								type="button"
								class="rounded-lg border border-gray-400 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
								on:click={skip}
							>
								Overslaan
							</button>
						</div>

						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							<kbd class="rounded border px-1">Enter</kbd> bewaart en gaat door,
							<kbd class="rounded border px-1">&darr;</kbd> slaat over. Het jaartal blijft staan.
						</p>

						<a
							class="mt-4 inline-block text-sm text-blue-800 underline hover:no-underline dark:text-blue-300"
							href="/foto/{current.id}"
							target="_blank"
							rel="noreferrer"
						>
							Deze foto openen
						</a>
					</div>
				</div>
			{/if}
		{/if}
	</section>
{/if}
