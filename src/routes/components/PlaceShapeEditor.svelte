<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		GeoJSON,
		FillLayer,
		LineLayer,
		MapEvents,
		MapLibre,
		Marker,
		NavigationControl,
		RasterLayer,
		RasterTileSource
	} from 'svelte-maplibre';

	import { circlePolygon } from '$lib/approximations';
	import { KAPELLEN_CENTRE, roundCoordinate } from '$lib/coordinates';
	import type { Line } from '../../../sharedModels/place-overlay';
	import { lengthOfLines } from '../../../sharedModels/place-overlay';

	/**
	 * One map that shows a place's point, its circle of doubt and its drawn shape at once.
	 *
	 * Together on purpose. These three are one statement about one place, and the archive has
	 * already been bitten by editing them apart: "Kasteel Oude Gracht" was drawn 761 m from
	 * its own circle for months, because the marker came from one rule and the ring from
	 * another and nothing ever showed the two side by side. A curator who can see the circle
	 * move as they drag the radius cannot ship that.
	 *
	 * Two modes rather than two maps. In `punt` a click moves the point; in `tekenen` a click
	 * adds a vertex to the line being drawn. Modes are a cost - a click that does the wrong
	 * thing is the classic drawing-tool bug - so the current one is stated on the map itself
	 * and in the cursor, and switching is one visible button rather than a modifier key.
	 */

	export let placeName: string;
	export let point: { lat: number; lng: number } | null = null;
	/** Metres, or 0 for no circle. Only meaningful when the display is `benadering`. */
	export let radius = 0;
	export let lines: Line[] = [];
	/** The register's own line, drawn faintly underneath so a redraw can be compared to it. */
	export let reference: Line[] = [];

	/** Which half moved, so a caller can tell a deliberate placing from a line click. */
	const dispatch = createEventDispatcher<{ change: 'punt' | 'vorm' }>();

	let mode: 'punt' | 'tekenen' = 'punt';

	/**
	 * Where the map opens - captured once, for the reason the pin picker gives: MapLibre eases
	 * to its center prop whenever it changes, so a centre that followed the point would fight
	 * the curator's own panning at exactly the moment they are fine-tuning it.
	 */
	const initialCentre: [number, number] = point
		? [point.lng, point.lat]
		: lines[0]?.[0] ?? reference[0]?.[0] ?? KAPELLEN_CENTRE;
	const initialZoom = point || lines.length > 0 || reference.length > 0 ? 15 : 13;

	function onMapClick(event: CustomEvent<{ lngLat: { lng: number; lat: number } }>): void {
		const { lat, lng } = event.detail.lngLat;
		const at: [number, number] = [roundCoordinate(lng), roundCoordinate(lat)];

		if (mode === 'punt') {
			point = { lat: at[1], lng: at[0] };
			dispatch('change', 'punt');
			return;
		}

		// A fresh line when there is none, otherwise extend the last one. Reassigned rather
		// than pushed, because Svelte 3 does not see a mutation.
		const current = lines.length > 0 ? lines[lines.length - 1] : null;
		lines = current ? [...lines.slice(0, -1), [...current, at]] : [...lines, [at]];
		dispatch('change', 'vorm');
	}

	/** Undoes the last click, and removes a line left with nothing in it. */
	function undo(): void {
		const current = lines[lines.length - 1];
		if (!current) return;

		const shortened = current.slice(0, -1);
		lines = shortened.length > 0 ? [...lines.slice(0, -1), shortened] : lines.slice(0, -1);
		dispatch('change', 'vorm');
	}

	/** Starts a second line, for a place that is two stretches rather than one. */
	function breakLine(): void {
		if (lines.length > 0 && lines[lines.length - 1].length > 0) lines = [...lines, []];
	}

	function clearLines(): void {
		lines = [];
		dispatch('change', 'vorm');
	}

	/** Closes the shape by repeating the first point - how an estate boundary is drawn. */
	function closeRing(): void {
		const current = lines[lines.length - 1];
		if (!current || current.length < 3) return;

		const [first] = current;
		const last = current[current.length - 1];
		if (first[0] === last[0] && first[1] === last[1]) return;

		lines = [...lines.slice(0, -1), [...current, first]];
		dispatch('change', 'vorm');
	}

	/** Lines with at least two points - the rest are a click waiting for a second one. */
	$: drawable = lines.filter((line) => line.length >= 2);
	$: vertices = lines.flat();
	$: metres = lengthOfLines(drawable);

	$: shapeData = {
		type: 'FeatureCollection' as const,
		features: drawable.map((line) => ({
			type: 'Feature' as const,
			properties: {},
			geometry: { type: 'LineString' as const, coordinates: line }
		}))
	};

	$: referenceData = {
		type: 'FeatureCollection' as const,
		features: reference
			.filter((line) => line.length >= 2)
			.map((line) => ({
				type: 'Feature' as const,
				properties: {},
				geometry: { type: 'LineString' as const, coordinates: line }
			}))
	};

	$: circleData = {
		type: 'FeatureCollection' as const,
		features:
			point && radius > 0
				? [
						{
							type: 'Feature' as const,
							properties: {},
							geometry: {
								type: 'Polygon' as const,
								coordinates: [circlePolygon(point.lat, point.lng, radius)]
							}
						}
				  ]
				: []
	};
</script>

<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
	<div
		class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex rounded-lg border border-gray-300 dark:border-gray-600" role="group">
			<button
				type="button"
				class="rounded-l-lg px-3 py-1.5 text-sm font-medium {mode === 'punt'
					? 'bg-blue-800 text-white'
					: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}"
				aria-pressed={mode === 'punt'}
				on:click={() => (mode = 'punt')}
			>
				Punt zetten
			</button>
			<button
				type="button"
				class="rounded-r-lg px-3 py-1.5 text-sm font-medium {mode === 'tekenen'
					? 'bg-blue-800 text-white'
					: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}"
				aria-pressed={mode === 'tekenen'}
				on:click={() => (mode = 'tekenen')}
			>
				Vorm tekenen
			</button>
		</div>

		{#if mode === 'tekenen'}
			<button
				type="button"
				class="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
				disabled={vertices.length === 0}
				on:click={undo}>Punt terug</button
			>
			<button
				type="button"
				class="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
				disabled={drawable.length === 0}
				on:click={breakLine}>Nieuwe lijn</button
			>
			<button
				type="button"
				class="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
				disabled={(lines[lines.length - 1]?.length ?? 0) < 3}
				on:click={closeRing}>Vorm sluiten</button
			>
			<button
				type="button"
				class="rounded border border-red-400 px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950"
				disabled={lines.length === 0}
				on:click={clearLines}>Wis de vorm</button
			>
		{/if}

		<span class="ml-auto text-sm text-gray-600 dark:text-gray-400">
			{#if mode === 'punt'}
				Klik waar {placeName} ligt.
			{:else if drawable.length > 0}
				{drawable.length}
				{drawable.length === 1 ? 'lijn' : 'lijnen'}, {metres} m
			{:else}
				Klik om de vorm te tekenen.
			{/if}
		</span>
	</div>

	<MapLibre
		center={initialCentre}
		zoom={initialZoom}
		class="h-[26rem] w-full {mode === 'tekenen' ? 'cursor-crosshair' : ''}"
		style={{ version: 8, sources: {}, layers: [] }}
	>
		<NavigationControl position="top-right" />
		<MapEvents on:click={onMapClick} />

		<RasterTileSource
			tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']}
			tileSize={256}
			attribution="&copy; OpenStreetMap-bijdragers"
		>
			<RasterLayer paint={{}} />
		</RasterTileSource>

		{#if referenceData.features.length > 0}
			<GeoJSON data={referenceData}>
				<LineLayer
					paint={{
						'line-color': '#6b7280',
						'line-width': 2,
						'line-opacity': 0.5,
						'line-dasharray': [2, 2]
					}}
				/>
			</GeoJSON>
		{/if}

		{#if circleData.features.length > 0}
			<GeoJSON data={circleData}>
				<FillLayer paint={{ 'fill-color': '#1d4ed8', 'fill-opacity': 0.12 }} />
				<LineLayer paint={{ 'line-color': '#1d4ed8', 'line-width': 1.5, 'line-opacity': 0.5 }} />
			</GeoJSON>
		{/if}

		{#if shapeData.features.length > 0}
			<GeoJSON data={shapeData}>
				<LineLayer paint={{ 'line-color': '#b45309', 'line-width': 3 }} />
			</GeoJSON>
		{/if}

		<!-- Every vertex is shown, not just the ends: a curator undoing a click needs to see
		     which click they are undoing. -->
		{#each vertices as vertex, index (index)}
			<Marker lngLat={vertex}>
				<div class="h-2.5 w-2.5 rounded-full border border-white bg-amber-600 shadow" />
			</Marker>
		{/each}

		{#if point}
			<Marker lngLat={[point.lng, point.lat]}>
				<div class="h-5 w-5 rounded-full border-2 border-white bg-blue-700 shadow-md" />
			</Marker>
		{/if}
	</MapLibre>
</div>
