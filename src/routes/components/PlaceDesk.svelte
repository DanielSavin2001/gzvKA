<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type { Archive, ArchivePlace } from '$lib/archive';
	import { revertPlaceRecord, savePlaceRecord } from '$lib/admin';
	import type { Approximation } from '$lib/approximations';
	import type { StreetGeometry } from '$lib/coordinates';
	import type { CuratorApproximation, Line } from '../../../sharedModels/place-overlay';
	import { DISPLAYS, GRADES } from '../../../sharedModels/place-overlay';
	import type { PlaceRecord } from '../../../sharedModels/place-record';
	import {
		CURATOR_KINDS,
		DISTRICTS,
		placeIdFrom,
		wouldLoop
	} from '../../../sharedModels/place-record';
	import PlaceShapeEditor from './PlaceShapeEditor.svelte';

	/**
	 * Everything the archive says about one place, in one place.
	 *
	 * The pieces existed and were scattered: a name and a kind in a generated file, a pin on
	 * one desk, a radius of doubt in a JSON file only a clone could reach. So the answer to
	 * "what does the site claim about Kasteel Appel, and how sure is it" had no single screen,
	 * and the least certain places in the archive - the castles, hamlets and demolished cafes,
	 * 3,644 photographs of them - were the hardest to correct.
	 *
	 * The doubt is a field here, not a footnote. A local who reads "the point comes from the
	 * street name Bunderbeeklaan, because 'Bunder' appears in both" knows in one second
	 * whether that reasoning is wrong; "location approximate" tells them nothing and invites
	 * nothing, and a wrong pin nobody is invited to challenge stays wrong for years.
	 */

	/**
	 * The place being edited. For a new one this is a blank stub with an empty id, and the id
	 * is then derived from the name the same way the gazetteer build derives it - so a place
	 * made here and the same place added to `seed.ts` later land on one id rather than two.
	 */
	export let place: ArchivePlace;
	export let archive: Archive;
	/** What the site currently says, whatever the source, so the desk opens on the truth. */
	export let approximation: Approximation | undefined = undefined;
	/** Where the place actually resolves to today, from whichever tier answered. */
	export let located: { lat: number; lng: number } | null = null;
	export let geometry: StreetGeometry | undefined = undefined;
	/** The record already stored for this place, if any - what "Terugzetten" would drop. */
	export let record: PlaceRecord | undefined = undefined;

	const dispatch = createEventDispatcher<{ saved: PlaceRecord; reverted: string; close: void }>();

	const KIND_LABELS: Record<string, string> = {
		street: 'Straat',
		square: 'Plein',
		park: 'Park',
		'castle-estate': 'Kasteel of domein',
		fort: 'Fort',
		building: 'Gebouw',
		area: 'Gebied of wijk',
		person: 'Persoon'
	};

	const DISPLAY_LABELS: Record<string, string> = {
		punt: 'Punt - we weten waar het is',
		punt_met_twijfel: 'Punt met twijfel - vermoedelijk hier',
		benadering: 'Bij benadering - ergens in een cirkel',
		kandidaten: 'Kandidaten - twee of meer mogelijkheden',
		niet_geplaatst: 'Niet geplaatst - we weten het niet'
	};

	const GRADE_LABELS: Record<string, string> = {
		A: 'A - een adres of coördinaat',
		B: 'B - de straat staat vast',
		C: 'C - afgeleid uit een beschrijving',
		'?': '? - niet teruggevonden'
	};

	const DISTRICT_LABELS: Record<string, string> = {
		kapellen: 'Kapellen',
		hoogboom: 'Hoogboom',
		'putte-kapellen': 'Putte-Kapellen',
		ertbrand: 'Ertbrand',
		unknown: 'Onbekend'
	};

	let name = place.name;
	let kind = CURATOR_KINDS.includes(place.kind as never) ? place.kind : 'area';
	let parentId = place.parentId ?? '';
	let district = place.district ?? 'unknown';

	let grade = approximation?.grade ?? '?';
	let display = approximation?.display ?? 'niet_geplaatst';
	let radius = approximation?.radius ?? 0;
	let note = approximation?.note ?? '';
	let doubt = approximation?.doubt ?? '';
	let research = approximation?.research ?? '';
	let correctable = approximation?.correctable ?? false;
	let outsideKapellen = approximation?.outsideKapellen ?? false;
	let candidates = (approximation?.candidates ?? []).map((candidate) => ({ ...candidate }));

	let point: { lat: number; lng: number } | null =
		approximation?.lat != null && approximation?.lng != null
			? { lat: approximation.lat, lng: approximation.lng }
			: located;

	/**
	 * Whether this record states where the place is, rather than leaving that to the register.
	 *
	 * Off by default for a place nobody has recorded a judgement about, and the reason is a
	 * bug this had before the toggle existed. A record is stored whole, so saving one wrote
	 * the position fields whatever the curator came here to do - and the fields default to
	 * "not placed". Renaming the Dorpsstraat therefore wrote `niet_geplaatst` over a street
	 * the register positions perfectly, and `isDrawable` then dropped it from every map on
	 * the site. Nothing on this screen would have shown that it had happened.
	 *
	 * So an untouched record says nothing about where the place is, which is exactly what the
	 * overlay means by an absent block: the register and the shipped research keep answering.
	 * Clicking a point turns it on, because that is unambiguously somebody deciding.
	 */
	let overrides = Boolean(record?.approximation);

	/**
	 * The drawn shape starts from the record only, never from the register.
	 *
	 * Seeding it from `geometry.lines` would look helpful and would be a trap: the register's
	 * line for a street is hundreds of points, and the moment a curator clicked once the desk
	 * would save all of them back as a hand drawing, freezing today's register into the
	 * overlay where no later `npm run streets` could ever improve it. The register's line is
	 * shown underneath instead, to draw against.
	 */
	let lines: Line[] = (record?.geometry?.lines ?? []).map((line) => [...line]);

	let saving = false;
	let error: string | null = null;

	$: byId = new Map(archive.places.map((entry) => [entry.id, entry]));
	$: parents = archive.places
		.filter((entry) => entry.id !== place.id)
		.filter((entry) => !wouldLoop(place.id, entry.id, Object.fromEntries(byId)))
		.sort((a, b) => a.name.localeCompare(b.name));

	/** The register's own line, to draw against rather than over. */
	$: reference = (record?.geometry ? [] : geometry?.lines ?? []) as Line[];

	$: needsPoint = overrides && display !== 'kandidaten' && display !== 'niet_geplaatst';
	$: drawn = lines.filter((line) => line.length >= 2);

	/** Empty for an existing place; the slug the name will produce for a new one. */
	$: newId = place.id ? '' : placeIdFrom(name);
	$: taken = newId !== '' && byId.has(newId);

	/**
	 * What the endpoint would refuse, said before the curator clicks save.
	 *
	 * The same three rules `readCuratorApproximation` enforces, checked here so they read as
	 * guidance rather than as a rejection. The server still enforces them - this is a
	 * courtesy, not the boundary.
	 */
	$: problem = (() => {
		if (!name.trim()) return 'Geef de plaats een naam.';
		if (!place.id && !newId) return 'Die naam levert geen bruikbare id op.';
		if (taken) return `"${byId.get(newId)?.name}" bestaat al. Beheer die plaats in plaats hiervan.`;
		if (needsPoint && !point) return 'Zet de plaats op de kaart, of kies "niet geplaatst".';
		if (!overrides) return null;
		if (display === 'benadering' && !(radius > 0)) {
			return 'Kies een straal, of toon de plaats als punt.';
		}
		if (display === 'kandidaten' && candidates.length === 0) {
			return 'Geef minstens één mogelijke plaats, of kies een andere weergave.';
		}
		if (candidates.some((candidate) => !candidate.label.trim())) {
			return 'Zeg bij elke mogelijke plaats waarop ze berust.';
		}
		return null;
	})();

	/**
	 * A click on the map in point mode is somebody deciding where the place is, so it turns
	 * the override on rather than being quietly discarded on save.
	 */
	function shapeChanged(event: CustomEvent<'punt' | 'vorm'>): void {
		if (event.detail !== 'punt' || overrides) return;

		overrides = true;
		// A place with a point is a point. Leaving it at the "not placed" default would put
		// a marker on this map that the site would then refuse to draw.
		if (display === 'niet_geplaatst') display = 'punt';
	}

	function addCandidate(): void {
		const from = point ?? { lat: 51.3125, lng: 4.4295 };
		candidates = [...candidates, { lat: from.lat, lng: from.lng, label: '' }];
	}

	function dropCandidate(index: number): void {
		candidates = candidates.filter((_, at) => at !== index);
	}

	/** The judgement as the endpoint wants it. Nothing about where it is is left implicit. */
	function judgement(): CuratorApproximation {
		const fields: CuratorApproximation = { grade, display };

		if (point) {
			fields.lat = point.lat;
			fields.lng = point.lng;
		}
		if (display === 'benadering' && radius > 0) fields.radius = Math.round(radius);
		if (display === 'kandidaten' && candidates.length > 0) fields.candidates = candidates;
		if (note.trim()) fields.note = note.trim();
		if (doubt.trim()) fields.doubt = doubt.trim();
		if (research.trim()) fields.research = research.trim();
		if (correctable) fields.correctable = true;
		if (outsideKapellen) fields.outsideKapellen = true;

		return fields;
	}

	async function save(): Promise<void> {
		if (saving || problem) return;

		saving = true;
		error = null;

		try {
			// Sent whole every time, because the record is stored with a plain `set`. That is
			// what makes clearing a field expressible at all: a shape wiped from the map has to
			// travel as an absent block, not as an omission the server reads as "unchanged".
			const saved = await savePlaceRecord({
				// Omitted for a new place, so the server derives the id from the name exactly as
				// the gazetteer build does rather than trusting one this page made up.
				...(place.id ? { id: place.id } : {}),
				name: name.trim(),
				kind,
				...(parentId ? { parentId } : {}),
				...(district && district !== 'unknown' ? { district } : {}),
				...(overrides ? { approximation: judgement() } : {}),
				...(drawn.length > 0 ? { geometry: { lines: drawn } } : {})
			});

			record = saved;
			dispatch('saved', saved);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	async function revert(): Promise<void> {
		saving = true;
		error = null;

		try {
			await revertPlaceRecord(place.id);
			dispatch('reverted', place.id);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
	on:click|self={() => dispatch('close')}
>
	<div
		class="my-4 w-full max-w-5xl rounded-xl border border-gray-300 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
		role="dialog"
		aria-label="Beheer {place.name}"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
					{place.id ? place.name : 'Nieuwe plaats'}
				</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					{#if place.id}
						{place.count}
						{place.count === 1 ? 'foto' : "foto's"}
						{#if record}
							&middot; aangepast door {record.by} op
							{new Date(record.on).toLocaleDateString('nl-BE')}
						{/if}
					{:else if newId}
						Wordt opgeslagen als <code>{newId}</code>
					{:else}
						Geef de plaats een naam.
					{/if}
				</p>
			</div>
			<button
				type="button"
				class="rounded px-2 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
				aria-label="Sluiten"
				on:click={() => dispatch('close')}
			>
				&times;
			</button>
		</div>

		<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<label class="block sm:col-span-2">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Naam</span>
				<input
					bind:value={name}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>

			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Soort</span>
				<select
					bind:value={kind}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				>
					{#each CURATOR_KINDS as option (option)}
						<option value={option}>{KIND_LABELS[option] ?? option}</option>
					{/each}
				</select>
			</label>

			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Deelgemeente</span>
				<select
					bind:value={district}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				>
					{#each DISTRICTS as option (option)}
						<option value={option}>{DISTRICT_LABELS[option] ?? option}</option>
					{/each}
				</select>
			</label>

			<label class="block sm:col-span-2 lg:col-span-4">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Staat onder
					<span class="font-normal text-gray-500 dark:text-gray-400">
						(voor een onderdeel van een grotere plaats)
					</span>
				</span>
				<select
					bind:value={parentId}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				>
					<option value="">Staat op zichzelf</option>
					{#each parents as option (option.id)}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="mt-4">
			<PlaceShapeEditor
				placeName={name}
				bind:point
				bind:lines
				radius={overrides ? radius : 0}
				{reference}
				on:change={shapeChanged}
			/>
		</div>

		<label
			class="mt-3 flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
		>
			<input type="checkbox" bind:checked={overrides} class="mt-0.5 h-4 w-4 shrink-0" />
			<span>
				<strong>Ik leg de ligging hier vast.</strong>
				<span class="block text-gray-600 dark:text-gray-400">
					Laat dit uit als het stratenregister of het bestaande onderzoek de plaats al goed zet -
					dan verandert er niets aan de kaart en past u alleen de naam, de soort of de vorm aan.
				</span>
			</span>
		</label>

		<div class="mt-3 grid gap-3 sm:grid-cols-2" class:hidden={!overrides}>
			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Hoe tonen</span>
				<select
					bind:value={display}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				>
					{#each DISPLAYS as option (option)}
						<option value={option}>{DISPLAY_LABELS[option] ?? option}</option>
					{/each}
				</select>
			</label>

			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Zekerheid</span>
				<select
					bind:value={grade}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				>
					{#each GRADES as option (option)}
						<option value={option}>{GRADE_LABELS[option] ?? option}</option>
					{/each}
				</select>
			</label>
		</div>

		{#if overrides && display === 'benadering'}
			<label class="mt-3 block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Straal van de twijfel:
					{#if radius > 0}
						<strong>{Math.round(radius)} m</strong>
					{:else}
						<!-- Not defaulted to a number: a circle is a claim on the map about how far
						     out a place might be, and one nobody chose is a claim nobody made. -->
						<strong>nog niet gekozen</strong>
					{/if}
				</span>
				<input type="range" min="25" max="2000" step="25" bind:value={radius} class="mt-1 w-full" />
				<span class="text-xs text-gray-500 dark:text-gray-400">
					De cirkel op de kaart hierboven is precies wat de bezoeker te zien krijgt.
				</span>
			</label>
		{/if}

		{#if overrides && display === 'kandidaten'}
			<div class="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Mogelijke plaatsen</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Zeg bij elke mogelijkheid waarop ze berust. Twee spelden zonder uitleg stellen een vraag
					die de lezer niet kan beantwoorden.
				</p>

				{#each candidates as candidate, index (index)}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<input
							type="number"
							step="0.00001"
							bind:value={candidate.lat}
							aria-label="Breedtegraad"
							class="w-32 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
						/>
						<input
							type="number"
							step="0.00001"
							bind:value={candidate.lng}
							aria-label="Lengtegraad"
							class="w-32 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
						/>
						<input
							bind:value={candidate.label}
							placeholder="Waarop berust deze mogelijkheid?"
							class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
						/>
						<button
							type="button"
							class="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
							on:click={() => dropCandidate(index)}>Weg</button
						>
					</div>
				{/each}

				<button
					type="button"
					class="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
					on:click={addCandidate}>Mogelijkheid toevoegen</button
				>
			</div>
		{/if}

		<label class="mt-3 block" class:hidden={!overrides}>
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Waarom we twijfelen
				<span class="font-normal text-gray-500 dark:text-gray-400">
					(staat letterlijk op de pagina)
				</span>
			</span>
			<textarea
				bind:value={doubt}
				rows="2"
				placeholder="Het punt komt van de straatnaam, omdat 'Bunder' in beide voorkomt."
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
			/>
		</label>

		<div class="mt-3 grid gap-3 sm:grid-cols-2" class:hidden={!overrides}>
			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Notitie</span>
				<textarea
					bind:value={note}
					rows="2"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>
			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Onderzoek
					<span class="font-normal text-gray-500 dark:text-gray-400">(voor de beheerder)</span>
				</span>
				<textarea
					bind:value={research}
					rows="2"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>
		</div>

		<div class="mt-3 flex flex-wrap gap-4" class:hidden={!overrides}>
			<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
				<input type="checkbox" bind:checked={correctable} class="h-4 w-4" />
				Vraag bezoekers om dit te verbeteren
			</label>
			<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
				<input type="checkbox" bind:checked={outsideKapellen} class="h-4 w-4" />
				Ligt buiten Kapellen
			</label>
		</div>

		{#if error}
			<p
				class="mt-3 rounded bg-red-50 p-2 text-sm font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
			>
				{error}
			</p>
		{/if}

		{#if problem}
			<p class="mt-3 text-sm font-medium text-orange-700 dark:text-orange-300">{problem}</p>
		{/if}

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-400"
				disabled={saving || problem !== null}
				on:click={save}
			>
				{saving ? 'Bezig ...' : place.id ? 'Bewaar deze plaats' : 'Maak deze plaats aan'}
			</button>

			{#if record}
				<button
					type="button"
					class="rounded-lg border-2 border-red-600 px-4 py-2.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
					disabled={saving}
					on:click={revert}
					title="Zet deze plaats terug naar wat het gegenereerde bestand zegt"
				>
					Terugzetten
				</button>
			{/if}

			<span class="text-sm text-gray-500 dark:text-gray-400">
				Meteen zichtbaar op de kaart en op elke pagina die deze plaats toont.
			</span>
		</div>
	</div>
</div>
