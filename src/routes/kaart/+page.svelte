<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
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

	let archive: Archive | null = null;
	let placed: Record<string, PlacedCoordinate> = {};
	/** Street centrelines from the official register, used where nobody has placed a pin. */
	let geometry: Record<string, StreetGeometry> = {};
	let error: string | null = null;

	/** The place whose photographs are shown in the panel. */
	let selected: ArchivePlace | null = null;

	/** Placing mode: click the map to give the highlighted street a location. */
	let placing = false;
	let placingBy = '';

	/**
	 * The placing tool is for whoever curates the archive, not for a visitor looking at
	 * photographs of their street. It stays a click away at `/kaart?beheer`, and is invisible
	 * otherwise - the register already positions every street, so the tool is now only needed
	 * for the castles, woods and districts it does not cover.
	 */
	$: curating = $page.url.searchParams.has('beheer');

	/**
	 * MapLibre needs WebGL, which some older machines and locked-down browsers do not have -
	 * and this archive's readers are not all on new hardware. Without this check the map area
	 * is simply blank with no explanation, so check once and offer the list instead.
	 */
	let webglAvailable = true;

	onMount(async () => {
		try {
			const probe = document.createElement('canvas');
			webglAvailable = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
		} catch {
			webglAvailable = false;
		}

		try {
			const [loadedArchive, coordinates, streets] = await Promise.all([
				loadArchive(),
				loadCoordinates(),
				loadStreetGeometry()
			]);
			archive = loadedArchive;
			placed = coordinates.places;
			geometry = streets;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	/** Every place with photographs, whether or not it has been located yet. */
	$: allPlaces = archive
		? archive.places.filter((place) => place.count > 0).sort((a, b) => b.count - a.count)
		: [];

	// A place counts as located when anyone knows where it is - a curator's pin, or the
	// official street register. Before the register existed this was hand-placement only,
	// and the map opened empty because nobody had done a full sitting yet.
	$: locatedPlaces = allPlaces.filter((place) => locate(place.id, placed, geometry));
	$: unlocatedPlaces = allPlaces.filter((place) => !locate(place.id, placed, geometry));

	/** The street the next map click will locate. */
	$: nextToPlace = placing ? unlocatedPlaces[0] ?? null : null;

	$: selectedPhotos = selected && archive ? archive.photosByPlace.get(selected.id) ?? [] : [];

	/** Where a marker goes: a curator's pin if there is one, else the register midpoint. */
	function markerAt(placeId: string): [number, number] {
		const at = locate(placeId, placed, geometry);
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

	function markerSize(count: number): number {
		// Area roughly proportional to the number of photographs, so a street with 150 reads
		// as bigger than one with 3 without swamping the map.
		return Math.max(28, Math.min(64, 20 + Math.sqrt(count) * 4));
	}

	function onMapClick(event: CustomEvent<{ lngLat: { lng: number; lat: number } }>): void {
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

<svelte:head>
	<title>Kaart van Kapellen | gzvKA fotoarchief</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-6">
	<header class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-gray-900">Kaart van Kapellen</h1>
			<p class="mt-1 text-gray-600">
				{#if archive}
					{locatedPlaces.length} van {allPlaces.length} plaatsen staan op de kaart. Klik een plaats om
					de foto's te zien.
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

					{#each locatedPlaces as place (place.id)}
						<Marker lngLat={markerAt(place.id)} asButton>
							<button
								type="button"
								class="flex items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-md transition hover:z-10 {place.isStreet
									? 'bg-blue-700'
									: 'bg-emerald-700'} {selected?.id === place.id ? 'ring-4 ring-yellow-400' : ''}"
								style="width:{markerSize(place.count)}px;height:{markerSize(
									place.count
								)}px;font-size:{place.count > 99 ? 11 : 13}px"
								title="{place.name} - {place.count} foto's"
								on:click|stopPropagation={() => (selected = place)}
							>
								{place.count}
							</button>
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
								on:click={() => (selected = place)}
							>
								<span>{place.name}</span><span class="text-gray-500">{place.count}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</div>
