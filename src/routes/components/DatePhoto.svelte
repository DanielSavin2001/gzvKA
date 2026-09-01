<script lang="ts">
	/**
	 * "Weet jij wanneer dit was?"
	 *
	 * 3,896 of the 4,504 photographs have no year, and nothing in this codebase can give
	 * them one - a year is remembered, not derived. The person who remembers is looking at
	 * the picture right now, and this is the only moment they will ever be asked.
	 *
	 * Deliberately small and closed until pressed. A form open on every photo page turns the
	 * page into a survey; a line of text that opens into one is an invitation.
	 */

	import { EARLIEST_YEAR, PhotoFactError, readYear } from '../../../sharedModels/photo-fact';

	export let photoId: string;
	export let photoTitle: string;
	/** What the archive already claims, if anything. Changes the question that is asked. */
	export let currentYear: string | undefined = undefined;

	const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

	/** The upper bound, worked out in the browser so it is never a year out of date. */
	const latestYear = new Date().getFullYear();

	let open = false;
	let year = '';
	let message = '';
	let name = '';
	let sending = false;
	let sent = false;
	let error: string | null = null;

	/**
	 * Checked here as well as on the server, using the same function.
	 *
	 * Not as a security measure - the server is the one that decides - but so somebody who
	 * types "rond 1950" is told what shape the answer takes while they are still looking at
	 * the box, rather than after a round trip.
	 */
	$: localError = ((): string | null => {
		if (!year.trim()) return null;
		try {
			readYear(year, latestYear);
			return null;
		} catch (problem) {
			return problem instanceof PhotoFactError ? problem.message : null;
		}
	})();

	async function send(): Promise<void> {
		error = null;

		if (!FUNCTIONS_BASE) {
			error = 'Insturen is hier niet ingesteld.';
			return;
		}

		try {
			readYear(year, latestYear);
		} catch (problem) {
			error =
				problem instanceof PhotoFactError ? problem.message : 'Dat jaartal begrijpen we niet.';
			return;
		}

		sending = true;
		try {
			const response = await fetch(`${FUNCTIONS_BASE}submitPhotoFact`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photoId, photoTitle, year, message, name })
			});

			if (!response.ok) throw new Error(await response.text());
			sent = true;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
		} finally {
			sending = false;
		}
	}
</script>

<section
	class="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40 print:hidden"
>
	{#if sent}
		<p class="font-semibold text-amber-900 dark:text-amber-200">Bedankt.</p>
		<p class="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
			Iemand van het archief kijkt ernaar. Klopt het, dan staat {year} bij deze foto.
		</p>
	{:else if !open}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-amber-900 dark:text-amber-200">
				{#if currentYear}
					Het archief zegt <strong>{currentYear}</strong>. Klopt dat niet?
				{:else}
					Van deze foto weten we het jaartal niet.
				{/if}
			</p>
			<button
				type="button"
				class="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
				on:click={() => (open = true)}
			>
				{currentYear ? 'Ik weet een ander jaartal' : 'Weet jij wanneer dit was?'}
			</button>
		</div>
	{:else}
		<h2 class="font-semibold text-amber-900 dark:text-amber-200">Weet jij wanneer dit was?</h2>
		<p class="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
			Een jaartal is genoeg. Twijfel je tussen twee jaren, schrijf dan bijvoorbeeld
			<code>1957-1958</code>.
		</p>

		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			<label class="block">
				<span class="text-sm font-medium text-amber-900 dark:text-amber-200">Jaartal</span>
				<input
					class="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 dark:border-amber-800 dark:bg-gray-900 dark:text-gray-100"
					bind:value={year}
					inputmode="numeric"
					placeholder={String(Math.min(1960, latestYear))}
					aria-describedby="jaartal-hulp"
				/>
			</label>

			<label class="block">
				<span class="text-sm font-medium text-amber-900 dark:text-amber-200">
					Jouw naam <span class="font-normal opacity-70">(mag leeg)</span>
				</span>
				<input
					class="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 dark:border-amber-800 dark:bg-gray-900 dark:text-gray-100"
					bind:value={name}
					autocomplete="name"
				/>
			</label>
		</div>

		<label class="mt-3 block">
			<span class="text-sm font-medium text-amber-900 dark:text-amber-200">
				Hoe weet je dat? <span class="font-normal opacity-70">(mag leeg)</span>
			</span>
			<textarea
				class="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 dark:border-amber-800 dark:bg-gray-900 dark:text-gray-100"
				bind:value={message}
				rows="2"
				placeholder="Bijvoorbeeld: mijn moeder stond erop, ze was toen net getrouwd."
			/>
		</label>

		<p id="jaartal-hulp" class="mt-2 text-xs text-amber-900/70 dark:text-amber-200/70">
			Tussen {EARLIEST_YEAR} en {latestYear}. Iemand van het archief kijkt ernaar voor het op de
			site komt.
		</p>

		{#if localError && !error}
			<p class="mt-2 text-sm text-amber-900 dark:text-amber-200">{localError}</p>
		{/if}
		{#if error}
			<p class="mt-2 text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
		{/if}

		<div class="mt-4 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
				disabled={sending || !year.trim() || localError !== null}
				on:click={send}
			>
				{sending ? 'Bezig ...' : 'Versturen'}
			</button>
			<button
				type="button"
				class="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
				on:click={() => (open = false)}
			>
				Annuleren
			</button>
		</div>
	{/if}
</section>
