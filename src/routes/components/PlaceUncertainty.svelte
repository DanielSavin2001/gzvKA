<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Approximation, Candidate } from '$lib/approximations';
	import type { CorrectionKind } from '../../../sharedModels/correction';

	/**
	 * What the archive is unsure about, and the way to tell it otherwise.
	 *
	 * Also, now, the way to tell it otherwise when it was not unsure at all. `approximation`
	 * is optional, because most places were never researched - they come straight from the
	 * street register, or a curator made them - and those drew a marker on six maps with
	 * nothing behind it. Being certain is not the same as being right, and the reader who
	 * can see the pin is on the wrong side of the street is exactly the reader worth
	 * hearing. The panel is quieter in that case: no warning triangle, no red, because
	 * there is nothing to warn about until somebody says there is.
	 *
	 * The reasoning is shown in full rather than hidden behind a tooltip, because it is the
	 * only part a reader can actually judge. Somebody who reads "the point comes from the
	 * street name Bunderbeeklaan, because 'Bunder' appears in both" knows in one second
	 * whether that is wrong. "Locatie bij benadering" tells them nothing and invites
	 * nothing, and the correction never arrives.
	 *
	 * The tone is deliberately flat. The circle on the map already says there is doubt; the
	 * words only have to say why and offer the fix.
	 */

	export let approximation: Approximation | null = null;
	/** The place's name, for the panel that has no research record to take it from. */
	export let placeName = '';
	/** A place the person can point at on the map. Set by the parent while picking. */
	export let picked: { lat: number; lng: number } | null = null;
	export let picking = false;
	export let sending = false;
	export let sent = false;
	export let error: string | null = null;

	const dispatch = createEventDispatcher<{
		pick: void;
		cancel: void;
		submit: {
			kind: CorrectionKind;
			lat?: number;
			lng?: number;
			candidateLabel?: string;
			message: string;
			name: string;
			email: string;
		};
	}>();

	let open = false;
	let kind: CorrectionKind = 'coordinate';
	let candidateLabel = '';
	let message = '';
	let name = '';
	let email = '';

	$: isApproximate = approximation?.display === 'benadering';
	$: isCandidates = approximation?.display === 'kandidaten';
	$: isMissing = approximation?.display === 'niet_geplaatst';
	$: isPerson = approximation?.kind === 'persoon';
	/**
	 * The archive is not claiming to be unsure about this one.
	 *
	 * Two cases, and they deserve the same quiet panel. Either there is no research record
	 * at all - most places come straight from the street register, or a curator made them -
	 * or there is one and it says `punt`, which is a geocoded address the research was
	 * confident about. All 64 of those are exactly the records that were marked not
	 * correctable, and framing them in red under "Ligging niet zeker" would invent a doubt
	 * to go with the invitation. Being certain is still not the same as being right, so the
	 * invitation stays; only the alarm goes.
	 */
	$: settled = approximation === null || approximation.display === 'punt';

	/** A coordinate correction is the only kind that needs a point before it can be sent. */
	$: ready =
		(kind === 'coordinate' && picked !== null) ||
		(kind === 'candidate' && candidateLabel !== '') ||
		((kind === 'not-a-place' || kind === 'still-unknown' || kind === 'other') &&
			message.trim() !== '');

	function start(next: CorrectionKind, label = ''): void {
		kind = next;
		candidateLabel = label;
		open = true;
		if (next === 'candidate') {
			const chosen = (approximation?.candidates ?? []).find(
				(candidate: Candidate) => candidate.label === label
			);
			if (chosen) picked = { lat: chosen.lat, lng: chosen.lng };
		}
	}

	function close(): void {
		open = false;
		dispatch('cancel');
	}

	/** The coordinate to send: a chosen candidate's own, else whatever was pointed at. */
	function coordinates(): { lat: number; lng: number } | null {
		if (kind === 'candidate') {
			const chosen = (approximation?.candidates ?? []).find(
				(candidate: Candidate) => candidate.label === candidateLabel
			);
			if (chosen) return { lat: chosen.lat, lng: chosen.lng };
		}

		return picked;
	}

	function send(): void {
		const at = coordinates();

		dispatch('submit', {
			kind,
			...(at ? { lat: at.lat, lng: at.lng } : {}),
			...(candidateLabel ? { candidateLabel } : {}),
			message: message.trim(),
			name: name.trim(),
			email: email.trim()
		});
	}

	/** "± 600 m" reads as a measurement; "ongeveer een halve kilometer" reads as a fact. */
	function readableRadius(metres: number | undefined): string {
		if (!metres) return '';
		return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
	}
</script>

<!--
	Red says "the archive is unsure about this". A place nobody researched is not unsure,
	it is simply unexamined, and painting its panel red would invent a doubt to go with the
	invitation - so that one is grey and says what it is.
-->
<section
	class="mt-4 rounded-lg border p-4 {settled
		? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
		: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'}"
>
	{#if sent}
		<p class="font-semibold text-green-900 dark:text-green-200">
			Bedankt &mdash; uw melding is doorgegeven.
		</p>
		<p class="mt-1 text-sm text-green-900 dark:text-green-200">
			Iemand van het archief kijkt ernaar. Tot dan blijft de plek staan zoals ze nu staat.
		</p>
	{:else}
		<h3
			class="flex items-center gap-2 font-bold {settled
				? 'text-gray-900 dark:text-gray-100'
				: 'text-red-900 dark:text-red-200'}"
		>
			{#if !settled}<span aria-hidden="true">&#9888;</span>{/if}
			{#if settled}
				Klopt dit?
			{:else if isPerson}
				Dit is geen plaats
			{:else if isMissing}
				Nog niet gevonden
			{:else if isCandidates}
				Twee mogelijke locaties
			{:else if isApproximate}
				Bij benadering geplaatst
			{:else}
				Ligging niet zeker
			{/if}
		</h3>

		<div
			class="mt-2 space-y-2 text-sm {settled
				? 'text-gray-700 dark:text-gray-300'
				: 'text-red-900 dark:text-red-200'}"
		>
			{#if settled}
				<p>
					{placeName || 'Deze plek'} staat op een opgezocht adres, of waar het straatregister of een
					beheerder ze zette. Dat is meestal juist en soms niet &mdash; en wie er woont of gewoond heeft,
					ziet dat in &eacute;&eacute;n oogopslag. Klopt er iets niet, zeg het dan hier.
				</p>
				{#if approximation?.note}
					<!--
						The research's own account of the place: what it was, when it came down,
						the sentence the point rests on. Blokjesweg's says it is the local name
						for the Kalmthoutsesteenweg and that the point is the level crossing in
						the photograph. That is the most useful thing on this panel for somebody
						deciding whether the pin is right.
					-->
					<p class="rounded bg-white p-2 dark:bg-gray-900/70">{approximation.note}</p>
				{/if}
			{:else if isPerson}
				<!--
					This branch has to come first, and what it is guarding against has changed.
					It used to be the circle: the page told a visitor the real location was
					somewhere inside it, directly above the archive's own sentence saying there
					is no location at all. Tajje is `punt_met_twijfel` with no radius, so no
					circle is drawn for him and that is no longer the risk. Without this branch
					he now falls through to the last one, which would print "De straat klopt,
					maar het punt erop is een schatting" about a man. Either way: first.

					It used to say the photographs stood "op de plaats waar het verhaal begint".
					That was never quite true and is now plainly false: Tajje's procession began
					in the Akkerstraat and his pin sits on the Hoevensebaan, part-way along the
					route. A pin for a person is an agreed point and nothing more, so that is
					what this says. The route itself is in `twijfel`, printed just below.
				-->
				<p>
					Deze naam hoort bij een persoon, niet bij een plek. De speld is een afspraak: ze staat er
					zodat de foto's vanaf de kaart te vinden zijn, niet omdat ze daar genomen zijn.
				</p>
			{:else if isMissing}
				<p>Deze plek staat niet op de kaart. We hebben ze nergens teruggevonden.</p>
			{:else if isCandidates}
				<p>
					We weten niet welke van deze twee het is. Ze staan allebei op de kaart, met een
					stippellijn.
				</p>
			{:else if isApproximate}
				<p>
					Deze plek is afgeleid uit een tekstbeschrijving, niet uit een adres. De echte locatie ligt
					ergens binnen de rode cirkel (&plusmn; {readableRadius(approximation?.radius)}).
				</p>
			{:else}
				<p>
					De straat klopt, maar het punt erop is een schatting &mdash; er hangen
					{approximation?.priority ?? 0} foto's aan.
				</p>
			{/if}

			{#if approximation?.doubt}
				<p class="rounded bg-white dark:bg-gray-900/70 p-2">
					<span class="font-semibold">Waarom we twijfelen:</span>
					{approximation.doubt}
				</p>
			{/if}
		</div>

		{#if !open}
			<div class="mt-3 flex flex-wrap gap-2">
				{#if settled}
					<button
						type="button"
						class="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
						on:click={() => start('coordinate')}
					>
						De speld staat verkeerd
					</button>
				{:else if isCandidates}
					{#each approximation?.candidates ?? [] as candidate (candidate.label)}
						<button
							type="button"
							class="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
							on:click={() => start('candidate', candidate.label)}
						>
							Dit is de juiste: {candidate.label}
						</button>
					{/each}
					<button
						type="button"
						class="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
						on:click={() => start('still-unknown')}
					>
						Geen van beide
					</button>
				{:else if isMissing}
					<button
						type="button"
						class="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
						on:click={() => start('coordinate')}
					>
						Help ons deze plek vinden
					</button>
				{:else}
					<button
						type="button"
						class="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
						on:click={() => start('coordinate')}
					>
						Corrigeer dit
					</button>
				{/if}

				{#if isPerson}
					<!-- Tajje de Kotter was a man, and the photographs are of a parade through the
					     whole municipality. Moving a pin cannot fix that, so say so plainly. -->
					<button
						type="button"
						class="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
						on:click={() => start('not-a-place')}
					>
						Dit is geen plaats
					</button>
				{/if}

				<!--
					Offered on every place, whatever the archive thinks it knows. The four other
					kinds each need the archive to have asked the right question first, and
					somebody who can see that a name is misspelled, or that two entries are the
					same place, or that these are photographs of the house next door, had
					nowhere to put it and no reason to come back a second time. The sentence is
					the whole correction.
				-->
				<button
					type="button"
					class="rounded-lg border px-3 py-2 text-sm font-semibold {settled
						? 'border-gray-400 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
						: 'border-red-700 text-red-800 hover:bg-red-100'}"
					on:click={() => start('other')}
				>
					Er klopt iets anders niet
				</button>
			</div>
		{:else}
			<div class="mt-3 space-y-3">
				{#if kind === 'coordinate'}
					<div class="rounded-lg border border-red-200 bg-white dark:bg-gray-900 p-3">
						{#if picked}
							<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
								Aangeduid op {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
							</p>
							<button
								type="button"
								class="mt-1 text-sm font-medium text-blue-800 dark:text-blue-300 underline"
								on:click={() => dispatch('pick')}
							>
								Opnieuw aanduiden
							</button>
						{:else}
							<button
								type="button"
								class="w-full rounded-lg border-2 border-dashed border-red-400 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
								on:click={() => dispatch('pick')}
							>
								{picking ? 'Klik nu op de kaart ...' : 'Duid de juiste plek aan op de kaart'}
							</button>
						{/if}
					</div>
				{/if}

				<label class="block">
					<span class="text-sm font-medium text-gray-800 dark:text-gray-200">
						{kind === 'coordinate'
							? 'Hoe weet u dat? (mag u leeg laten)'
							: kind === 'other'
							? 'Wat klopt er niet?'
							: 'Wat weet u erover?'}
					</span>
					<textarea
						bind:value={message}
						rows="3"
						placeholder="Bijvoorbeeld: het clubhuis van de korfbalclub staat op die plek."
						class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
					/>
				</label>

				<div class="grid gap-2 sm:grid-cols-2">
					<label class="block">
						<span class="text-sm font-medium text-gray-800 dark:text-gray-200">Uw naam</span>
						<input
							bind:value={name}
							placeholder="Mag leeg blijven"
							class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-800 dark:text-gray-200">E-mail</span>
						<input
							bind:value={email}
							type="email"
							placeholder="Alleen om iets te vragen"
							class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
						/>
						<span class="mt-0.5 block text-xs text-gray-600 dark:text-gray-400"
							>Komt niet op de website.</span
						>
					</label>
				</div>

				{#if error}
					<p
						class="rounded bg-red-100 dark:bg-red-900 p-2 text-sm font-medium text-red-900 dark:text-red-200"
					>
						{error}
					</p>
				{/if}

				<div class="flex gap-2">
					<button
						type="button"
						class="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400 {settled
							? 'bg-blue-800 hover:bg-blue-900'
							: 'bg-red-700 hover:bg-red-800'}"
						disabled={!ready || sending}
						on:click={send}
					>
						{sending ? 'Bezig ...' : 'Versturen'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-gray-400 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
						on:click={close}
					>
						Annuleren
					</button>
				</div>
			</div>
		{/if}
	{/if}
</section>
