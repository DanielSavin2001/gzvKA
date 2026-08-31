<script lang="ts">
	/**
	 * A map of one part of the archive, for the pages that list that part.
	 *
	 * The castles page named twenty-one castles and showed no hint of where any of them were,
	 * which is an odd thing for a page about castles: half of them are gone and the only
	 * question a reader has is where they stood. The same page existed for the districts, for
	 * the stories, and for each of the 298 people who gave the archive photographs.
	 *
	 * Deliberately not the front page's map. That one draws every place in Kapellen and
	 * carries the curator's placing tool; this draws the handful the page is about, and its
	 * panel is whatever that page wants to say about the place you clicked.
	 *
	 * ## What it costs
	 *
	 * `places` is a prop rather than something read from the archive, because the pages that
	 * use this already have their list from `load`, in the prerendered HTML. Asking for the
	 * 1.1 MB index just to rebuild a list the page is already holding would put the whole
	 * download in front of the map; the three coordinate files it does fetch on mount come to
	 * about 100 KB between them, and the map draws as soon as they land.
	 *
	 * The index is fetched at most once, on the first click, and only when this component is
	 * drawing the default panel - that panel's thumbnails are the one thing here that needs
	 * it. A page that supplies its own `panel` slot never triggers the fetch, because its
	 * panel is built from what the page already knows: `/verhalen` lists stories, a donor page
	 * lists that person's count.
	 *
	 * In practice most of these pages have loaded the index in `load` anyway, so the click is
	 * a cache hit. That is a fact about today's callers, not something this component leans
	 * on - it works the same on a page whose `load` never touches the archive.
	 */

	import { onMount } from 'svelte';

	import type { Archive, ArchivePlace } from '$lib/archive';
	import { loadArchive, sortForDisplay, thumbUrl } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { loadCoordinates, loadStreetGeometry } from '$lib/coordinates';
	import type { Approximation } from '$lib/approximations';
	import { loadApproximations } from '$lib/approximations';
	import { splitPlaces } from '$lib/map-places';
	import ArchiveMap from './ArchiveMap.svelte';

	/**
	 * The places this map is about.
	 *
	 * `isStreet` only decides a marker's colour - blue for a street or a square, green for
	 * everything else - so a page whose places are all of one kind can leave it off.
	 */
	export let places: { id: string; name: string; count: number; isStreet?: boolean }[] = [];
	/** Wording for the captions, e.g. "kastelen" -> "18 van de 21 kastelen". */
	export let noun = 'plaatsen';
	/** What the marker numbers count, for the legend. */
	export let counting = "foto's";
	export let height = '400px';
	export let zoom = 12.4;
	/** The heading above the map. */
	export let title = 'Op de kaart';
	/** One line under the heading, in the page's own words. */
	export let intro = '';
	/** Anchor, so a menu or a story can link straight to this map. */
	export let id = 'kaart';
	/**
	 * Draw the street centrelines underneath, as the front page does.
	 *
	 * Without them a map of twenty castles is twenty dots on a beige rectangle until the
	 * OpenStreetMap tiles arrive - and on a phone on mobile data that is several seconds, if
	 * they arrive at all. The centrelines ship with the site, so they draw immediately, and
	 * they are the streets this archive actually holds photographs of: they say where
	 * Kapellen is and which part of it the archive knows.
	 */
	export let showStreets = true;

	let placed: Record<string, PlacedCoordinate> = {};
	let geometry: Record<string, StreetGeometry> = {};
	let approximations: Record<string, Approximation> = {};
	/** True once the coordinates have arrived, so the box can say why it is still empty. */
	let ready = false;

	/** Fetched on the first click, never before. See the note at the top. */
	let archive: Archive | null = null;
	let loadingPhotos = false;

	/**
	 * The open place, held as an id rather than as a record.
	 *
	 * Holding the record looked simpler and was wrong. Going from one donor to the next is a
	 * client-side navigation, so Svelte reuses this component and swaps `places` underneath
	 * it - and a record captured on the way in keeps the count it had then. The donor panel
	 * pairs that count with the *new* donor's name, so after clicking Dorpsstraat on Alix
	 * Swatti's page and following a link to Hugo De Hoon's, the panel read "Dorpsstraat - 47
	 * foto's van Hugo De Hoon". The 47 were Alix Swatti's. An archive that invents a number
	 * about a named person has done the one thing it must never do.
	 *
	 * Comparing ids and clearing the selection on a mismatch does not fix it: Dorpsstraat is
	 * in both donors' lists, so the id matches and the stale count survives. The record has
	 * to be looked up again in the list the page is showing now, which is what this does -
	 * and it drops the selection for free when the new list has no such place.
	 */
	let selectedId: string | null = null;

	onMount(async () => {
		// All three fail soft by design - a missing file means "nothing placed", not an
		// error - so there is nothing here to catch. The map simply draws what it got.
		const [coordinates, streets, researched] = await Promise.all([
			loadCoordinates(),
			loadStreetGeometry(),
			loadApproximations()
		]);

		placed = coordinates.places;
		geometry = streets;
		approximations = researched;
		ready = true;
	});

	/**
	 * The page's list, in the shape the map draws.
	 *
	 * `kind` and `district` are empty because nothing on a map reads them; they are on
	 * `ArchivePlace` for the browse lists, which build their places from the index itself.
	 */
	$: mapped = places.map(
		(place): ArchivePlace => ({
			id: place.id,
			name: place.name,
			count: place.count,
			isStreet: place.isStreet ?? false,
			kind: '',
			district: ''
		})
	);

	$: split = splitPlaces(mapped, placed, geometry, approximations);

	/** The open place as the page currently describes it. Null once it is gone from the list. */
	$: selected = mapped.find((place) => place.id === selectedId) ?? null;

	/** The photographs of the open place, once the index has arrived. */
	$: shownPhotos =
		selected && archive ? sortForDisplay(archive.photosByPlace.get(selected.id) ?? []) : [];

	async function choose(place: ArchivePlace): Promise<void> {
		selectedId = place.id;

		// The index is only ever needed for the default panel's thumbnails. A page that
		// writes its own panel builds it from what it already has, so fetching 1.1 MB it
		// will never read would be pure waste - `/verhalen` and the donor pages both do.
		if ($$slots.panel || archive || loadingPhotos) return;

		loadingPhotos = true;
		try {
			archive = await loadArchive();
		} catch {
			// The panel still names the place and links to it. Thumbnails are the part that
			// needs the index, and a map that breaks because a picture would not load is a
			// worse trade than a panel with no pictures in it.
			archive = null;
		} finally {
			loadingPhotos = false;
		}
	}
</script>

<section {id} class="scroll-mt-20">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
			{#if intro}
				<p class="mt-1 text-gray-600 dark:text-gray-400">{intro}</p>
			{/if}
		</div>

		{#if ready && mapped.length > 0}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{split.on.length === mapped.length
					? `Alle ${mapped.length} ${noun} staan op de kaart.`
					: `${split.on.length} van de ${mapped.length} ${noun} staan op de kaart.`}
			</p>
		{/if}
	</div>

	<div class="mt-4">
		{#if ready}
			<ArchiveMap
				{placed}
				{geometry}
				{approximations}
				places={mapped}
				selectedId={selected?.id ?? null}
				showAllStreets={showStreets}
				{height}
				{zoom}
				on:select={(event) => choose(event.detail)}
			/>
		{:else}
			<!--
				Same height as the map that replaces it, so the page does not jump under
				somebody who has already started reading the list below.
			-->
			<div
				class="flex items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
				style="height: {height}"
			>
				Bezig met laden &hellip;
			</div>
		{/if}
	</div>

	<div
		class="mt-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
	>
		{#if selected}
			<!--
				Bound to a const so the slot's `place` is an ArchivePlace rather than a
				possibly-null one. Without it every page that writes its own panel has to
				re-check a value the `{#if}` above has already established.
			-->
			{@const place = selected}
			<slot name="panel" {place}>
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{selected.name}</h3>
					<a
						class="text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
						href="/straat/{selected.id}"
					>
						Alle {selected.count}
						{selected.count === 1 ? 'foto' : "foto's"} &rarr;
					</a>
				</div>

				{#if shownPhotos.length > 0 && archive}
					<div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
						{#each shownPhotos.slice(0, 6) as photo (photo.id)}
							<a
								class="block overflow-hidden rounded border border-gray-200 hover:border-blue-600 dark:border-gray-700"
								href="/foto/{photo.id}"
							>
								<img
									src={thumbUrl(archive, photo)}
									alt={photo.t}
									loading="lazy"
									decoding="async"
									class="aspect-[4/3] w-full object-cover"
								/>
							</a>
						{/each}
					</div>
				{:else if loadingPhotos}
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Foto's worden geladen &hellip;</p>
				{/if}
			</slot>
		{:else}
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Klik een bol aan om te zien wat er is. Hoe groter de bol, hoe meer {counting}.
				<span class="text-red-700 dark:text-red-300"
					>Een rode stippellijn betekent dat we de plek maar bij benadering kennen</span
				> &mdash; weet u het beter, laat het weten.
			</p>
		{/if}
	</div>

	{#if ready && split.off.length > 0}
		<div class="mt-3">
			<h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Nog niet op de kaart</h3>
			<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
				Deze {split.off.length === 1 ? 'plek is' : 'plekken zijn'} nog niet teruggevonden, of
				{split.off.length === 1 ? 'ligt' : 'liggen'} net buiten Kapellen. Weet u waar? Laat het ons weten
				via
				<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/contact"
					>de contactpagina</a
				>.
			</p>
			<ul class="mt-2 flex flex-wrap gap-2">
				{#each split.off as place (place.id)}
					<li>
						<a
							class="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-800 hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-blue-950"
							href="/straat/{place.id}"
						>
							{place.name}
							<span class="text-gray-500 dark:text-gray-400">{place.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
