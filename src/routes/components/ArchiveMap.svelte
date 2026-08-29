<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		GeoJSON,
		LineLayer,
		MapLibre,
		Marker,
		NavigationControl,
		RasterLayer,
		RasterTileSource,
		ScaleControl
	} from 'svelte-maplibre';

	import type { Archive, ArchivePlace } from '$lib/archive';
	import type { PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { KAPELLEN_CENTRE, locate } from '$lib/coordinates';

	export let archive: Archive | null = null;
	/** Coordinates a person placed by hand. These win over the register. */
	export let placed: Record<string, PlacedCoordinate> = {};
	/** Street centrelines derived from the official register. */
	export let geometry: Record<string, StreetGeometry> = {};
	/** Which places to show. Defaults to every place that has photographs. */
	export let places: ArchivePlace[] | null = null;
	/** Draw this street's centreline and open on it. */
	export let focusId: string | null = null;
	/** The place whose marker is drawn as selected. */
	export let selectedId: string | null = null;
	export let height = '420px';
	export let zoom = 12.6;
	/** Off for a decorative map that should not steal a scroll. */
	export let interactive = true;
	/** Show every street's centreline, not only the focused one. */
	export let showAllStreets = false;

	const dispatch = createEventDispatcher<{ select: ArchivePlace }>();

	/**
	 * MapLibre needs WebGL, which some older machines and locked-down browsers do not have,
	 * and this archive's readers are not all on new hardware. Without this the map area is
	 * simply blank with no explanation.
	 */
	let webglAvailable = true;

	onMount(() => {
		try {
			const probe = document.createElement('canvas');
			webglAvailable = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
		} catch {
			webglAvailable = false;
		}
	});

	$: shown = places ?? (archive ? archive.places.filter((place) => place.count > 0) : []);

	$: located = shown
		.map((place) => ({ place, at: locate(place.id, placed, geometry) }))
		.filter(
			(entry): entry is { place: ArchivePlace; at: NonNullable<typeof entry.at> } =>
				entry.at !== null
		);

	$: focus = focusId ? geometry[focusId] : undefined;

	$: centre = focus
		? ([focus.lng, focus.lat] as [number, number])
		: located.length === 1
		? ([located[0].at.lng, located[0].at.lat] as [number, number])
		: KAPELLEN_CENTRE;

	/**
	 * The lines to draw. One street when the map is about one street, all of them on the
	 * overview - the centrelines are what make it read as Kapellen rather than as a scatter
	 * of dots on a beige rectangle.
	 */
	$: drawn = focusId
		? [geometry[focusId]].filter(Boolean)
		: showAllStreets
		? Object.values(geometry)
		: [];

	$: lineData = {
		type: 'FeatureCollection' as const,
		features: drawn.map((street) => ({
			type: 'Feature' as const,
			properties: { name: street.name },
			geometry: { type: 'MultiLineString' as const, coordinates: street.lines }
		}))
	};

	function markerSize(count: number): number {
		// Area roughly proportional to the number of photographs, so a street with 150 reads
		// as bigger than one with 3 without swamping the map.
		return Math.max(24, Math.min(60, 18 + Math.sqrt(count) * 3.6));
	}
</script>

{#if !webglAvailable}
	<div
		class="flex items-center justify-center rounded-xl border border-gray-300 bg-gray-50 p-6 text-center text-gray-600"
		style="height: {height}"
	>
		<p>
			Deze browser kan geen kaarten tonen (WebGL ontbreekt).<br />
			Gebruik de lijst met straten om door het archief te bladeren.
		</p>
	</div>
{:else}
	<div class="overflow-hidden rounded-xl border border-gray-300" style="height: {height}">
		<MapLibre
			style={{ version: 8, sources: {}, layers: [] }}
			center={centre}
			{zoom}
			attributionControl={false}
			{interactive}
			class="h-full w-full"
		>
			<RasterTileSource
				id="osm"
				tiles={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
				tileSize={256}
				attribution="&copy; OpenStreetMap"
			>
				<RasterLayer id="osm-tiles" paint={{ 'raster-opacity': 0.85 }} />
			</RasterTileSource>

			{#if lineData.features.length > 0}
				<GeoJSON id="straten" data={lineData}>
					<LineLayer
						id="straten-lijn"
						paint={{
							'line-color': '#1d4ed8',
							'line-width': focusId ? 6 : 2,
							'line-opacity': focusId ? 0.85 : 0.4
						}}
						layout={{ 'line-cap': 'round', 'line-join': 'round' }}
					/>
				</GeoJSON>
			{/if}

			{#if interactive}
				<NavigationControl position="top-right" />
				<ScaleControl />
			{/if}

			{#each located as { place, at } (place.id)}
				<Marker lngLat={[at.lng, at.lat]}>
					<button
						type="button"
						title="{place.name} - {place.count} foto's{at.source === 'register'
							? ' (ligging uit het stratenregister)'
							: ''}"
						on:click={() => dispatch('select', place)}
						class="flex items-center justify-center rounded-full border-2 font-semibold text-white shadow transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
							{selectedId === place.id
							? 'border-white bg-amber-600 ring-2 ring-amber-400'
							: place.isStreet
							? 'border-white/80 bg-blue-700/90'
							: 'border-white/80 bg-emerald-700/90'}"
						style="width: {markerSize(place.count)}px; height: {markerSize(
							place.count
						)}px; font-size: {place.count > 99 ? 10 : 11}px"
					>
						{place.count}
					</button>
				</Marker>
			{/each}
		</MapLibre>
	</div>
{/if}
