<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		FillLayer,
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
	import type { CoordinateSource, PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import { KAPELLEN_CENTRE, locate } from '$lib/coordinates';
	import type { Approximation, Candidate } from '$lib/approximations';
	import { circleCollection, isDrawable } from '$lib/approximations';

	export let archive: Archive | null = null;
	/** Coordinates a person placed by hand. These win over the register. */
	export let placed: Record<string, PlacedCoordinate> = {};
	/** Street centrelines derived from the official register. */
	export let geometry: Record<string, StreetGeometry> = {};
	/**
	 * Places that were researched rather than looked up, each carrying the confidence it was
	 * researched at. This is what stops an inferred point being drawn like a geocoded one.
	 */
	export let approximations: Record<string, Approximation> = {};
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

	const dispatch = createEventDispatcher<{
		select: ArchivePlace;
		correct: { place: ArchivePlace; approximation: Approximation };
	}>();

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

	/**
	 * What each place knows about itself: where it is, and - when it was researched rather
	 * than looked up - how sure that is.
	 *
	 * A coordinate a curator clicked outranks the research, so `placed` wins and the
	 * approximation is dropped along with its circle and its badge. That is not a special
	 * case but the whole point: a human answer replaces a machine's guess rather than
	 * sitting next to it.
	 */
	$: resolved = shown.map((place) => {
		const at = locate(place.id, placed, geometry, approximations);
		const researched = approximations[place.id];
		const corrected = at?.source === 'placed';

		return {
			place,
			at,
			approximation: researched && !corrected ? researched : undefined
		};
	});

	/**
	 * A place is off the map when it has no coordinate at all, or when the research says it
	 * does not belong on one: Kasteel Ravenhof is in Stabroek on purpose, and Blokjesweg was
	 * never found. Showing either would be worse than the gap.
	 */
	$: drawable = resolved.filter((entry) => !entry.approximation || isDrawable(entry.approximation));

	/** A place that has exactly one point on the map. */
	type Located = {
		place: ArchivePlace;
		at: { lat: number; lng: number; source: CoordinateSource };
		// Required-but-undefined rather than optional, so it matches the shape `resolved`
		// produces and the type predicate below can actually narrow.
		approximation: Approximation | undefined;
	};

	/** Places with one point to draw. Candidates are two points and handled separately. */
	$: located = drawable.filter(
		(entry): entry is Located => entry.at !== null && entry.approximation?.display !== 'kandidaten'
	);

	/**
	 * Places with two genuinely different possible locations.
	 *
	 * Domein Middelbeek's candidates sit 2.3 km apart. A circle big enough to hold both
	 * would cover half the municipality and imply the truth is somewhere in the middle,
	 * which is the one place it certainly is not. Both are drawn, and the reader picks.
	 */
	$: candidates = drawable
		.filter((entry) => entry.approximation?.display === 'kandidaten')
		.flatMap((entry) =>
			(entry.approximation!.candidates ?? []).map((candidate: Candidate, index: number) => ({
				place: entry.place,
				approximation: entry.approximation!,
				candidate,
				index
			}))
		);

	/** The circles of doubt, as real geometry so they stay the right size on the ground. */
	$: circles = circleCollection(
		located
			.map((entry) => entry.approximation)
			.filter((entry): entry is Approximation => entry !== undefined)
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

	/**
	 * The hover text. It names the source, because "where did this pin come from" is the
	 * question a reader who thinks it is wrong will ask first.
	 */
	function markerTitle(
		place: ArchivePlace,
		source: string,
		approximation: Approximation | undefined
	): string {
		const photos = `${place.name} - ${place.count} foto's`;

		if (approximation?.display === 'benadering') {
			return `${photos} (bij benadering, ± ${approximation.radius} m)`;
		}
		if (approximation?.display === 'punt_met_twijfel') {
			return `${photos} (ligging niet zeker)`;
		}
		if (source === 'register') return `${photos} (ligging uit het stratenregister)`;
		if (source === 'onderzoek') return `${photos} (ligging opgezocht)`;

		return photos;
	}

	function markerSize(count: number): number {
		// Area roughly proportional to the number of photographs, so a street with 150 reads
		// as bigger than one with 3 without swamping the map.
		return Math.max(24, Math.min(60, 18 + Math.sqrt(count) * 3.6));
	}
</script>

{#if !webglAvailable}
	<div
		class="flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 text-center text-gray-600 dark:text-gray-400"
		style="height: {height}"
	>
		<p>
			Deze browser kan geen kaarten tonen (WebGL ontbreekt).<br />
			Gebruik de lijst met straten om door het archief te bladeren.
		</p>
	</div>
{:else}
	<div
		class="overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700"
		style="height: {height}"
	>
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

			{#if circles.features.length > 0}
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

			{#if interactive}
				<NavigationControl position="top-right" />
				<ScaleControl />
			{/if}

			{#each located as { place, at, approximation } (place.id)}
				<Marker lngLat={[at.lng, at.lat]}>
					<div class="relative">
						<button
							type="button"
							title={markerTitle(place, at.source, approximation)}
							on:click={() => dispatch('select', place)}
							class="flex items-center justify-center rounded-full border-2 font-semibold text-white shadow transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
								{selectedId === place.id
								? 'border-white bg-amber-600 ring-2 ring-amber-400'
								: approximation?.display === 'benadering'
								? 'border-dashed border-red-200 bg-red-700/90'
								: place.isStreet
								? 'border-white/80 bg-blue-700/90'
								: 'border-white/80 bg-emerald-700/90'}"
							style="width: {markerSize(place.count)}px; height: {markerSize(
								place.count
							)}px; font-size: {place.count > 99 ? 10 : 11}px"
						>
							{place.count}
						</button>

						{#if approximation?.display === 'benadering'}
							<!-- The badge says the pin itself is uncertain, which the circle alone
							     does not: at low zoom a wide circle reads as a shaded area. -->
							<span
								class="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-red-600 text-[10px] font-bold leading-none text-white"
								aria-hidden="true">!</span
							>
						{/if}
					</div>
				</Marker>
			{/each}

			{#each candidates as { place, approximation, candidate, index } (place.id + index)}
				<Marker lngLat={[candidate.lng, candidate.lat]}>
					<button
						type="button"
						title="{place.name}: mogelijk hier - {candidate.label}"
						on:click={() => dispatch('select', place)}
						class="flex items-center justify-center rounded-full border-2 border-dashed border-red-600 bg-white dark:bg-gray-900/85 text-[11px] font-semibold text-red-700 dark:text-red-300 shadow transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
						style="width: {markerSize(place.count)}px; height: {markerSize(place.count)}px"
					>
						?
					</button>
				</Marker>
			{/each}
		</MapLibre>
	</div>
{/if}
