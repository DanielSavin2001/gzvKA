<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FillLayer,
		GeoJSON,
		LineLayer,
		MapLibre,
		MapEvents,
		Marker,
		NavigationControl,
		RasterLayer,
		RasterTileSource,
		ScaleControl
	} from 'svelte-maplibre';

	import type { Archive, ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { loadArchive, thumbUrl } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import {
		isWithinKapellen,
		KAPELLEN_CENTRE,
		loadCoordinates,
		loadStreetGeometry,
		locate,
		roundCoordinate
	} from '$lib/coordinates';
	import type { Approximation, Candidate } from '$lib/approximations';
	import { circleCollection, isDrawable, loadApproximations } from '$lib/approximations';
	import type { CorrectionKind } from '../../../sharedModels/correction';
	import type { Bubble } from '../../../sharedModels/declutter';
	import { declutter } from '../../../sharedModels/declutter';
	import PlaceUncertainty from './PlaceUncertainty.svelte';

	let archive: Archive | null = null;
	let placed: Record<string, PlacedCoordinate> = {};
	/** Street centrelines from the official register, used where nobody has placed a pin. */
	let geometry: Record<string, StreetGeometry> = {};
	/** Places researched by hand, each carrying how sure that research was. */
	let approximations: Record<string, Approximation> = {};
	let error: string | null = null;

	/** A visitor correcting a place: what they picked, and how the send is going. */
	let picking = false;
	let picked: { lat: number; lng: number } | null = null;
	let sendingCorrection = false;
	let correctionSent = false;
	let correctionError: string | null = null;

	const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

	/**
	 * The map itself, so marker positions can be measured in screen pixels.
	 *
	 * Overlap is a screen-space problem - two places 40 m apart collide at zoom 12 and not at
	 * zoom 16 - so it cannot be solved from coordinates alone.
	 */
	let map: import('maplibre-gl').Map | null = null;

	/** How far each marker steps aside, in pixels, keyed by place id. */
	let shifts: Map<string, { dx: number; dy: number }> = new Map();

	/**
	 * Bumped on every zoom, purely so the layout below re-runs.
	 *
	 * The map component does not write the zoom back to its prop, and waiting on the
	 * `zoomend` event alone was not enough either: the map is ready long before the archive
	 * has finished loading, so the one pass that did run found no markers to arrange and the
	 * whole thing silently did nothing.
	 */
	let zoomTick = 0;
	let watchingZoom = false;
	let lastZoom = -1;

	/**
	 * Listen on the map object itself rather than through the component's events.
	 *
	 * `on:zoomend` on the component looked right and never fired the layout again: the
	 * markers kept the arrangement worked out at the zoom the map opened at, so zooming in
	 * left them sitting beside their real positions instead of settling back onto them.
	 * Binding to the instance removes the question of what the wrapper forwards.
	 *
	 * Only a change of zoom matters. Screen distance between two fixed coordinates depends
	 * on the zoom alone, so panning can neither create an overlap nor resolve one, and
	 * recomputing on every `moveend` would be work for nothing.
	 */
	$: if (map && !watchingZoom) {
		watchingZoom = true;
		map.on('zoomend', () => {
			const now = map?.getZoom() ?? 0;
			if (Math.abs(now - lastZoom) < 0.01) return;
			lastZoom = now;
			zoomTick += 1;
		});
	}

	/** The place whose photographs are shown in the panel. */
	let selected: ArchivePlace | null = null;

	/** Placing mode: click the map to give the highlighted street a location. */
	let placing = false;
	let placingBy = '';

	/**
	 * The placing tool is for whoever curates the archive, not for a visitor looking at
	 * photographs of their street. It stays a click away at `/?beheer`, and is invisible
	 * otherwise - the register already positions every street, so the tool is now only needed
	 * for the castles, woods and districts it does not cover.
	 *
	 * Read from `window` rather than the page store because the home page is prerendered,
	 * and SvelteKit rightly refuses to let a prerendered page depend on a query string.
	 */
	let curating = false;

	/**
	 * MapLibre needs WebGL, which some older machines and locked-down browsers do not have -
	 * and this archive's readers are not all on new hardware. Without this check the map area
	 * is simply blank with no explanation, so check once and offer the list instead.
	 */
	let webglAvailable = true;

	onMount(async () => {
		curating = new URLSearchParams(window.location.search).has('beheer');

		try {
			const probe = document.createElement('canvas');
			webglAvailable = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
		} catch {
			webglAvailable = false;
		}

		try {
			const [loadedArchive, coordinates, streets, researched] = await Promise.all([
				loadArchive(),
				loadCoordinates(),
				loadStreetGeometry(),
				loadApproximations()
			]);
			archive = loadedArchive;
			placed = coordinates.places;
			geometry = streets;
			approximations = researched;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	/** Every place with photographs, whether or not it has been located yet. */
	$: allPlaces = archive
		? archive.places.filter((place) => place.count > 0).sort((a, b) => b.count - a.count)
		: [];

	/**
	 * A place counts as located when anyone knows where it is: a curator's pin, the official
	 * street register, or the research. The research is the newest of the three and the only
	 * one that can be wrong by hundreds of metres, so it is kept distinguishable rather than
	 * merged in - `research` below is what decides how each marker is drawn.
	 *
	 * A curator's pin outranks the research, and when there is one the approximation is
	 * dropped along with its circle and its warning. That is the point of a correction: it
	 * replaces the guess rather than sitting beside it.
	 */
	function research(placeId: string): Approximation | undefined {
		if (placed[placeId]) return undefined;
		return approximations[placeId];
	}

	/** Off the map on purpose: outside Kapellen, or never found. */
	function belongsOnMap(place: ArchivePlace): boolean {
		const found = approximations[place.id];
		if (!found || placed[place.id]) return true;
		return isDrawable(found);
	}

	$: locatedPlaces = allPlaces.filter(
		(place) =>
			belongsOnMap(place) &&
			research(place.id)?.display !== 'kandidaten' &&
			locate(place.id, placed, geometry, approximations)
	);

	$: unlocatedPlaces = allPlaces.filter(
		(place) => !locate(place.id, placed, geometry, approximations)
	);

	/**
	 * Places with two genuinely different possible locations, drawn as two hollow pins.
	 *
	 * Domein Middelbeek's candidates are 2.3 km apart. A circle holding both would cover
	 * half the municipality and imply the answer is in the middle, which is the one place it
	 * is not.
	 */
	$: candidatePins = allPlaces
		.filter((place) => belongsOnMap(place) && research(place.id)?.display === 'kandidaten')
		.flatMap((place) =>
			(research(place.id)?.candidates ?? []).map((candidate: Candidate, index: number) => ({
				place,
				candidate,
				index
			}))
		);

	/** The circles of doubt, as real geometry so they keep their size on the ground. */
	$: circles = circleCollection(
		locatedPlaces
			.map((place) => research(place.id))
			.filter((entry): entry is Approximation => entry !== undefined)
	);

	/**
	 * How many places a visitor can actually find. The candidate places are on the map as a
	 * pair of hollow pins each, so counting only `locatedPlaces` would report the map as
	 * emptier than it is.
	 */
	$: onTheMap = locatedPlaces.length + new Set(candidatePins.map((pin) => pin.place.id)).size;

	/**
	 * Re-arrange whenever the markers change or the zoom does.
	 *
	 * Every identifier it depends on is named in the statement itself: Svelte 3 works out a
	 * reactive statement's dependencies from what is written in it, so reading them only
	 * inside `relayout` would mean this never ran again after the first time.
	 */
	$: if (map && locatedPlaces.length + candidatePins.length > 0 && zoomTick >= 0) {
		relayout();
	}

	/** The research behind the open place, if it was researched rather than looked up. */
	$: selectedResearch = selected ? research(selected.id) : undefined;

	/** The street the next map click will locate. */
	$: nextToPlace = placing ? unlocatedPlaces[0] ?? null : null;

	$: selectedPhotos = selected && archive ? archive.photosByPlace.get(selected.id) ?? [] : [];

	/** Where a marker goes: a curator's pin if there is one, else the register, else research. */
	function markerAt(placeId: string): [number, number] {
		const at = locate(placeId, placed, geometry, approximations);
		return at ? [at.lng, at.lat] : KAPELLEN_CENTRE;
	}

	/**
	 * The street centrelines, drawn under the markers. Without them the map is a scatter of
	 * numbered bubbles on a beige rectangle; with them it reads as Kapellen.
	 */
	$: streetLines = {
		type: 'FeatureCollection' as const,
		features: Object.values(geometry).map((street) => ({
			type: 'Feature' as const,
			properties: { name: street.name },
			geometry: { type: 'MultiLineString' as const, coordinates: street.lines }
		}))
	};

	/**
	 * The hover text. It names where the pin came from, because "how do you know" is the
	 * first thing a reader who thinks it is wrong will want answered.
	 */
	function markerTitle(place: ArchivePlace, found: Approximation | undefined): string {
		const photos = `${place.name} - ${place.count} foto's`;

		if (found?.display === 'benadering') {
			return `${photos} (bij benadering, \u00b1 ${found.radius} m - klik om te corrigeren)`;
		}
		if (found?.display === 'punt_met_twijfel') return `${photos} (ligging niet zeker)`;
		if (found) return `${photos} (ligging opgezocht)`;

		return photos;
	}

	/**
	 * Works out how far each bubble has to step aside so none cover another.
	 *
	 * Screen distance between two fixed coordinates depends on the zoom alone, not on where
	 * the map is centred, so this only has to run when the zoom changes - panning cannot
	 * create or resolve an overlap. That is what makes it cheap enough to do properly.
	 */
	function relayout(): void {
		if (!map) return;

		const bubbles: Bubble[] = [];

		for (const place of locatedPlaces) {
			const point = map.project(markerAt(place.id));
			bubbles.push({ id: place.id, x: point.x, y: point.y, r: markerSize(place.count) / 2 });
		}

		for (const pin of candidatePins) {
			const point = map.project([pin.candidate.lng, pin.candidate.lat]);
			bubbles.push({
				id: `${pin.place.id}#${pin.index}`,
				x: point.x,
				y: point.y,
				r: markerSize(pin.place.count) / 2
			});
		}

		shifts = declutter(bubbles);
	}

	const STILL = { dx: 0, dy: 0 };

	/**
	 * The offset for one marker, or a standing still.
	 *
	 * `layout` is passed in rather than read from the closure, and that is load-bearing.
	 * Svelte 3 decides whether to re-render a template expression from the identifiers
	 * written in it, so `shiftOf(place.id)` - with `shifts` read only inside the body - kept
	 * rendering the arrangement from the zoom the map opened at, however often the layout
	 * was recomputed. Naming it here is what makes the markers actually move.
	 */
	function shiftOf(
		layout: Map<string, { dx: number; dy: number }>,
		id: string
	): { dx: number; dy: number } {
		return layout.get(id) ?? STILL;
	}

	/**
	 * A displaced bubble is drawn with a thin line back to where the place really is.
	 *
	 * Without it the map would be quietly lying: the marker would sit somewhere the place is
	 * not, and nothing would say so. Below a few pixels the line is not drawn, because a
	 * marker that has barely moved is still on its own spot.
	 */
	function leader(shift: { dx: number; dy: number }): string | null {
		const length = Math.hypot(shift.dx, shift.dy);
		if (length < 6) return null;

		const angle = (Math.atan2(shift.dy, shift.dx) * 180) / Math.PI;
		return `width:${length.toFixed(1)}px;transform:rotate(${angle.toFixed(1)}deg)`;
	}

	function markerSize(count: number): number {
		// Area roughly proportional to the number of photographs, so a street with 150 reads
		// as bigger than one with 3 without swamping the map.
		return Math.max(28, Math.min(64, 20 + Math.sqrt(count) * 4));
	}

	function onMapClick(event: CustomEvent<{ lngLat: { lng: number; lat: number } }>): void {
		const clicked = event.detail.lngLat;

		// A visitor pointing at the right spot for a place they know. This runs before the
		// curator's tool because a visitor never has the curator's tool switched on.
		if (picking) {
			if (!isWithinKapellen(clicked.lat, clicked.lng)) {
				correctionError = 'Dat punt ligt buiten Kapellen.';
				return;
			}

			picked = { lat: roundCoordinate(clicked.lat), lng: roundCoordinate(clicked.lng) };
			picking = false;
			correctionError = null;
			return;
		}

		if (!curating || !placing || !nextToPlace) return;

		const { lng, lat } = event.detail.lngLat;

		if (!isWithinKapellen(lat, lng)) {
			error = `Dat punt ligt buiten Kapellen (${lat.toFixed(4)}, ${lng.toFixed(
				4
			)}). Niet opgeslagen.`;
			return;
		}

		error = null;
		placed = {
			...placed,
			[nextToPlace.id]: {
				lat: roundCoordinate(lat),
				lng: roundCoordinate(lng),
				by: placingBy.trim() || undefined,
				on: new Date().toISOString().slice(0, 10)
			}
		};
	}

	/** Clears the correction form when the visitor moves to another place. */
	function resetCorrection(): void {
		picking = false;
		picked = null;
		sendingCorrection = false;
		correctionSent = false;
		correctionError = null;
	}

	function choose(place: ArchivePlace): void {
		selected = place;
		resetCorrection();
	}

	async function sendCorrection(
		event: CustomEvent<{
			kind: CorrectionKind;
			lat?: number;
			lng?: number;
			candidateLabel?: string;
			message: string;
			name: string;
			email: string;
		}>
	): Promise<void> {
		if (!selected || sendingCorrection) return;

		sendingCorrection = true;
		correctionError = null;

		try {
			const response = await fetch(`${FUNCTIONS_BASE}submitCorrection`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...event.detail, placeId: selected.id })
			});

			if (!response.ok) {
				throw new Error((await response.text()) || 'Versturen is niet gelukt.');
			}

			correctionSent = true;
			picked = null;
		} catch (e) {
			correctionError = e instanceof Error ? e.message : String(e);
		} finally {
			sendingCorrection = false;
		}
	}

	function undoLast(): void {
		const ids = Object.keys(placed);
		if (ids.length === 0) return;

		const { [ids[ids.length - 1]]: _removed, ...rest } = placed;
		placed = rest;
	}

	/** Hands back a replacement for static/data/place-coordinates.json. */
	function download(): void {
		const file = {
			_comment:
				'Coordinates for places in the Kapellen gazetteer, WGS84. Every entry was placed by a person clicking the map at /kaart.',
			_format:
				'{ "<gazetteer-id>": { "lat": 51.3, "lng": 4.4, "by": "who placed it", "on": "YYYY-MM-DD" } }',
			places: placed
		};

		const blob = new Blob([`${JSON.stringify(file, null, '\t')}\n`], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'place-coordinates.json';
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<section id="kaart" class="scroll-mt-20">
	<header class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">Kaart van Kapellen</h2>
			<p class="mt-1 text-gray-600">
				{#if archive}
					{onTheMap} van {allPlaces.length} plaatsen staan op de kaart. Klik een plaats om de foto's
					te zien.
				{:else}
					Bezig met laden ...
				{/if}
			</p>
		</div>

		{#if curating}
			<button
				type="button"
				class="rounded-lg border-2 px-4 py-2 font-semibold transition {placing
					? 'border-orange-600 bg-orange-600 text-white'
					: 'border-blue-800 text-blue-800 hover:bg-blue-50'}"
				on:click={() => {
					placing = !placing;
					selected = null;
				}}
			>
				{placing ? 'Stoppen met plaatsen' : 'Plaatsen aanduiden'}
			</button>
		{/if}
	</header>

	{#if error}
		<div class="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{error}</div>
	{/if}

	{#if placing && curating}
		<div class="mb-4 rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
			<h2 class="font-bold text-orange-950">
				{#if nextToPlace}
					Klik op de kaart waar <span class="underline">{nextToPlace.name}</span> ligt
					<span class="font-normal">({nextToPlace.count} foto's)</span>
				{:else}
					Alle plaatsen staan op de kaart.
				{/if}
			</h2>
			<p class="mt-1 text-sm text-orange-900">
				Nog {unlocatedPlaces.length} te gaan. Niets wordt automatisch bewaard: als u klaar bent, download
				het bestand en vervang er
				<code class="rounded bg-white px-1">static/data/place-coordinates.json</code>
				mee.
			</p>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<label class="text-sm text-orange-900" for="wie">Uw naam</label>
				<input
					id="wie"
					bind:value={placingBy}
					placeholder="bv. Daniel"
					class="rounded border border-orange-300 px-2 py-1 text-sm"
				/>
				<button
					type="button"
					class="rounded border border-orange-400 px-3 py-1 text-sm hover:bg-orange-100"
					on:click={undoLast}
				>
					Laatste ongedaan maken
				</button>
				<button
					type="button"
					class="rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-700"
					on:click={download}
				>
					Download ({Object.keys(placed).length})
				</button>
			</div>
		</div>
	{/if}

	<div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
		<div class="overflow-hidden rounded-xl border border-gray-300">
			{#if !webglAvailable}
				<div
					class="flex h-[32rem] items-center justify-center bg-gray-50 p-8 text-center lg:h-[38rem]"
				>
					<p class="max-w-md text-gray-600">
						Deze browser kan geen kaarten tonen (WebGL ontbreekt). Alle foto's blijven bereikbaar
						via <a class="text-blue-800 underline" href="/">de lijst met straten</a> en
						<a class="text-blue-800 underline" href="/zoeken">de zoekpagina</a>.
					</p>
				</div>
			{:else}
				<MapLibre
					bind:map
					center={KAPELLEN_CENTRE}
					zoom={13}
					class="h-[32rem] w-full lg:h-[38rem]"
					style={{ version: 8, sources: {}, layers: [] }}
				>
					<NavigationControl position="top-right" />
					<ScaleControl />
					<MapEvents on:click={onMapClick} />

					<RasterTileSource
						tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']}
						tileSize={256}
						attribution="&copy; OpenStreetMap-bijdragers"
					>
						<RasterLayer paint={{}} />
					</RasterTileSource>

					{#if streetLines.features.length > 0}
						<GeoJSON id="straten" data={streetLines}>
							<LineLayer
								id="straten-lijn"
								paint={{ 'line-color': '#1d4ed8', 'line-width': 3, 'line-opacity': 0.45 }}
								layout={{ 'line-cap': 'round', 'line-join': 'round' }}
							/>
						</GeoJSON>
					{/if}

					{#if circles.features.length > 0}
						<!-- Drawn before the markers so a pin is never buried under a fill. The
						     circle is real geometry in metres, so it keeps meaning the same
						     distance however far the reader zooms out. -->
						<GeoJSON id="benaderingen" data={circles}>
							<FillLayer
								id="benadering-vlak"
								paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.09 }}
							/>
							<LineLayer
								id="benadering-rand"
								paint={{
									'line-color': '#dc2626',
									'line-width': 2,
									'line-opacity': 0.75,
									'line-dasharray': [3, 2]
								}}
							/>
						</GeoJSON>
					{/if}

					{#each locatedPlaces as place (place.id)}
						{@const found = research(place.id)}
						{@const shift = shiftOf(shifts, place.id)}
						{@const line = leader(shift)}
						<Marker lngLat={markerAt(place.id)} asButton>
							<div class="relative">
								{#if line}
									<!-- A thread back to where the place really is, so a bubble that
									     stepped aside is not quietly claiming the wrong spot. -->
									<span
										class="pointer-events-none absolute left-1/2 top-1/2 h-px origin-left bg-gray-500/60"
										style={line}
										aria-hidden="true"
									/>
									<span
										class="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-600/70"
										aria-hidden="true"
									/>
								{/if}

								<div
									class="transition-transform duration-500 ease-out"
									style="transform: translate({shift.dx}px, {shift.dy}px)"
								>
									<button
										type="button"
										class="flex items-center justify-center rounded-full border-2 font-bold text-white shadow-md transition hover:z-10 {found?.display ===
										'benadering'
											? 'border-dashed border-red-200 bg-red-700'
											: place.isStreet
											? 'border-white bg-blue-700'
											: 'border-white bg-emerald-700'} {selected?.id === place.id
											? 'ring-4 ring-yellow-400'
											: ''}"
										style="width:{markerSize(place.count)}px;height:{markerSize(
											place.count
										)}px;font-size:{place.count > 99 ? 11 : 13}px"
										title={markerTitle(place, found)}
										on:click|stopPropagation={() => choose(place)}
									>
										{place.count}
									</button>

									{#if found?.display === 'benadering'}
										<!-- The circle alone is not enough: zoomed out, a wide one reads as
									     a shaded area rather than as doubt about this pin. -->
										<span
											class="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-red-600 text-[10px] font-bold leading-none text-white"
											aria-hidden="true">!</span
										>
									{/if}
								</div>
							</div>
						</Marker>
					{/each}

					{#each candidatePins as { place, candidate, index } (place.id + index)}
						{@const shift = shiftOf(shifts, `${place.id}#${index}`)}
						{@const line = leader(shift)}
						<Marker lngLat={[candidate.lng, candidate.lat]} asButton>
							<div class="relative">
								{#if line}
									<span
										class="pointer-events-none absolute left-1/2 top-1/2 h-px origin-left bg-gray-500/60"
										style={line}
										aria-hidden="true"
									/>
								{/if}
								<div
									class="transition-transform duration-500 ease-out"
									style="transform: translate({shift.dx}px, {shift.dy}px)"
								>
									<button
										type="button"
										class="flex items-center justify-center rounded-full border-2 border-dashed border-red-600 bg-white/90 font-bold text-red-700 shadow-md transition hover:z-10 {selected?.id ===
										place.id
											? 'ring-4 ring-yellow-400'
											: ''}"
										style="width:{markerSize(place.count)}px;height:{markerSize(place.count)}px"
										title="{place.name}: mogelijk hier - {candidate.label}"
										on:click|stopPropagation={() => choose(place)}
									>
										?
									</button>
								</div>
							</div>
						</Marker>
					{/each}
				</MapLibre>
			{/if}
		</div>

		<aside class="rounded-xl border border-gray-300 bg-white p-4">
			{#if selected && archive}
				<div class="flex items-start justify-between gap-2">
					<div>
						<h2 class="text-xl font-bold text-gray-900">{selected.name}</h2>
						<p class="text-sm text-gray-600">{selectedPhotos.length} foto's</p>
					</div>
					<button
						type="button"
						class="text-gray-500 hover:text-gray-900"
						on:click={() => (selected = null)}
						aria-label="Sluiten"
					>
						&times;
					</button>
				</div>

				<div class="mt-3 grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">
					{#each selectedPhotos.slice(0, 40) as photo (photo.id)}
						<a
							href="/foto/{photo.id}"
							class="block overflow-hidden rounded border border-gray-200 hover:border-blue-600"
						>
							<img
								src={thumbUrl(archive, photo)}
								alt={photo.t}
								loading="lazy"
								class="aspect-[4/3] w-full object-cover"
							/>
						</a>
					{/each}
				</div>

				{#if selectedResearch?.correctable}
					<PlaceUncertainty
						approximation={selectedResearch}
						bind:picked
						{picking}
						sending={sendingCorrection}
						sent={correctionSent}
						error={correctionError}
						on:pick={() => {
							picking = true;
							correctionError = null;
						}}
						on:cancel={resetCorrection}
						on:submit={sendCorrection}
					/>
				{/if}

				<a
					class="mt-3 inline-block font-medium text-blue-800 underline hover:no-underline"
					href="/straat/{selected.id}"
				>
					Alle {selectedPhotos.length} foto's van {selected.name} &rarr;
				</a>
			{:else if locatedPlaces.length === 0}
				<h2 class="text-lg font-bold text-gray-900">De kaart is nog leeg</h2>
				<p class="mt-2 text-sm text-gray-600">
					Geen enkele foto in het archief heeft een co&ouml;rdinaat. Die kunnen niet uit de
					bestandsnamen worden afgeleid en worden hier bewust niet geraden: een foute speld zet een
					foto voorgoed in de verkeerde straat.
				</p>
				<p class="mt-2 text-sm text-gray-600">
					Klik hierboven op <strong>Straten plaatsen</strong> en wijs de {allPlaces.length} plaatsen
					&eacute;&eacute;n keer aan. Daarna staat het hele archief op de kaart.
				</p>
			{:else}
				<h2 class="text-lg font-bold text-gray-900">Klik een plaats aan</h2>
				<p class="mt-2 text-sm text-gray-600">
					De grootte van een bol toont hoeveel foto's er van die plaats zijn. Blauw is een straat of
					plein, groen een wijk, kasteel of gebouw.
				</p>
				<ul class="mt-3 max-h-96 space-y-1 overflow-y-auto text-sm">
					{#each locatedPlaces as place (place.id)}
						<li>
							<button
								type="button"
								class="flex w-full justify-between rounded px-2 py-1 text-left hover:bg-blue-50"
								on:click={() => choose(place)}
							>
								<span>{place.name}</span><span class="text-gray-500">{place.count}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</section>
