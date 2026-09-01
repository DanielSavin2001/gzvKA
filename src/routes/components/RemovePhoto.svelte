<script lang="ts">
	import type { RemovalGround } from '../../../sharedModels/removal-request';
	import { GROUND_LABELS, GROUNDS } from '../../../sharedModels/removal-request';

	/**
	 * "Ik sta hierop."
	 *
	 * `/contact` has promised since the site went up that a photograph of you goes if you ask,
	 * and there was no way to ask. The page names no address on purpose, and the one route it
	 * pointed at - the comment box on `/upload` - cannot be sent without attaching a
	 * photograph. Somebody who wanted out of the archive had to put something into it first.
	 *
	 * So the asking happens here, on the page with the photograph on it, because that is where
	 * a person is standing when they recognise themselves.
	 *
	 * Deliberately quiet: a small line of text, not a button competing with Bewaren and Delen.
	 * Most readers never need it, and one that shouts invites the click that wastes a
	 * curator's afternoon. It is not hidden either - somebody looking for it finds it under
	 * the photograph, which is the only place they would look.
	 */

	export let photoId: string;
	export let photoTitle: string;

	const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

	let open = false;
	let sending = false;
	let sent = false;
	let error: string | null = null;

	let ground: RemovalGround = 'ikzelf';
	let message = '';
	let name = '';
	let email = '';

	async function send(): Promise<void> {
		error = null;

		if (!FUNCTIONS_BASE) {
			error = 'Dit formulier is hier niet ingesteld. Laat het weten via Foto insturen.';
			return;
		}

		sending = true;
		try {
			const response = await fetch(`${FUNCTIONS_BASE}submitRemovalRequest`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photoId, photoTitle, ground, message, name, email })
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

<section class="mt-4 print:hidden">
	{#if sent}
		<div
			class="rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="font-semibold text-gray-900 dark:text-gray-100">Het verzoek is aangekomen.</p>
			<!--
				What it says is what the mechanism does. The overlay hides the photograph across
				the whole site at once; the prerendered page and the sitemap entry are build
				artefacts and go at the next update. Saying "binnen enkele dagen weg overal" would
				be the easier sentence and it would not be true.
			-->
			<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
				Iemand van het archief leest het en haalt de foto weg. Ze verdwijnt dan meteen uit het
				archief, de zoekfunctie en de kaart. Het kan nog een paar dagen duren voor ook de opgeslagen
				versie van deze pagina en de zoekmachines bij zijn.
			</p>
		</div>
	{:else if !open}
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Staat u op deze foto en wilt u dat ze weggaat?
			<button
				type="button"
				class="text-blue-800 underline hover:no-underline dark:text-blue-300"
				on:click={() => (open = true)}
			>
				Laat het weten
			</button>
			&mdash; dat is geen discussie.
		</p>
	{:else}
		<div
			class="rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
		>
			<h2 class="font-semibold text-gray-900 dark:text-gray-100">Deze foto weghalen</h2>
			<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
				U hoeft niets uit te leggen. Eén vinkje volstaat; de rest is er alleen als u er iets bij
				kwijt wilt.
			</p>

			<fieldset class="mt-4">
				<legend class="text-sm font-medium text-gray-800 dark:text-gray-200">Wie bent u?</legend>
				<div class="mt-2 space-y-2">
					{#each GROUNDS as option (option)}
						<label class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
							<input type="radio" bind:group={ground} value={option} class="h-4 w-4" />
							{GROUND_LABELS[option]}
						</label>
					{/each}
				</div>
			</fieldset>

			<label class="mt-4 block">
				<span class="text-sm font-medium text-gray-800 dark:text-gray-200">
					Iets erbij <span class="font-normal text-gray-600 dark:text-gray-400">(mag leeg)</span>
				</span>
				<textarea
					bind:value={message}
					rows="3"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>

			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm font-medium text-gray-800 dark:text-gray-200">
						Naam <span class="font-normal text-gray-600 dark:text-gray-400">(mag leeg)</span>
					</span>
					<input
						bind:value={name}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
					/>
				</label>
				<label class="block">
					<span class="text-sm font-medium text-gray-800 dark:text-gray-200">
						E-mail
						<span class="font-normal text-gray-600 dark:text-gray-400">
							(alleen als u antwoord wilt)
						</span>
					</span>
					<input
						type="email"
						bind:value={email}
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
					/>
				</label>
			</div>

			{#if error}
				<p
					class="mt-3 rounded bg-red-50 p-2 text-sm font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
				>
					{error}
				</p>
			{/if}

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-400"
					disabled={sending}
					on:click={send}
				>
					{sending ? 'Bezig ...' : 'Verstuur het verzoek'}
				</button>
				<button
					type="button"
					class="rounded-lg border border-gray-400 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
					on:click={() => (open = false)}
				>
					Laat maar
				</button>
			</div>
		</div>
	{/if}
</section>
