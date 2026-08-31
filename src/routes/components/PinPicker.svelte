<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		MapLibre,
		MapEvents,
		Marker,
		NavigationControl,
		RasterLayer,
		RasterTileSource
	} from 'svelte-maplibre';

	import { isWithinKapellen, KAPELLEN_CENTRE, roundCoordinate } from '$lib/coordinates';

	/**
	 * A small map for placing one place.
	 *
	 * Opens on the place's current position when it has one, on the village centre when it
	 * does not. A click moves the pin; nothing is saved until the button says so. The parent
	 * does the saving - this component only picks.
	 */

	export let placeName: string;
	/** Where the place currently is, whatever the source. Null for a place with nothing. */
	export let start: { lat: number; lng: number } | null = null;
	/** True when a curator pin exists, so removing it is offered. */
	export let hasPin = false;
	export let busy = false;

	const dispatch = createEventDispatcher<{
		save: { lat: number; lng: number };
		remove: void;
		close: void;
	}>();

	let picked: { lat: number; lng: number } | null = start ? { ...start } : null;

	$: outside = picked !== null && !isWithinKapellen(picked.lat, picked.lng);
	$: moved = picked !== null && (start === null || picked.lat !== start.lat || picked.lng !== start.lng);

	function onMapClick(event: CustomEvent<{ lngLat: { lng: number; lat: number } }>): void {
		const clicked = event.detail.lngLat;
		picked = { lat: roundCoordinate(clicked.lat), lng: roundCoordinate(clicked.lng) };
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
	on:click|self={() => dispatch('close')}
>
	<div
		class="w-full max-w-3xl rounded-xl border border-gray-300 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
		role="dialog"
		aria-label="Plaats {placeName} op de kaart"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{placeName}</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Klik op de kaart waar dit hoort. De pin wint van het register en van het onderzoek.
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

		<div class="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<MapLibre
				center={picked ? [picked.lng, picked.lat] : KAPELLEN_CENTRE}
				zoom={picked ? 15 : 13}
				class="h-[24rem] w-full"
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

				{#if picked}
					<Marker lngLat={[picked.lng, picked.lat]}>
						<div
							class="h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-blue-700 shadow-md"
						/>
					</Marker>
				{/if}
			</MapLibre>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-3">
			<button
				type="button"
				class="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-400"
				disabled={busy || picked === null || !moved}
				on:click={() => picked && dispatch('save', picked)}
			>
				{busy ? 'Bezig ...' : 'Bewaar deze plek'}
			</button>
			{#if hasPin}
				<button
					type="button"
					class="rounded-lg border-2 border-red-600 px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
					disabled={busy}
					on:click={() => dispatch('remove')}
				>
					Pin weghalen
				</button>
			{/if}
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{#if picked}
					{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
					{#if outside}
						&middot; <span class="font-medium text-orange-700 dark:text-orange-300"
							>buiten Kapellen &mdash; kan, maar kijk het na</span
						>
					{/if}
				{:else}
					Nog geen plek gekozen.
				{/if}
			</span>
		</div>
	</div>
</div>
