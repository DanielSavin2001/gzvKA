<script lang="ts">
	/**
	 * Two photographs of the same place, one dragged over the other.
	 *
	 * The whole effect rests on the two pictures being *the same view* - the photographer
	 * standing where the first photographer stood. When they are not, a slider does not read
	 * as time passing; it reads as two unrelated pictures fighting, and it quietly asserts a
	 * correspondence that is not there. That is why the pairs are curated by hand and why
	 * this component does nothing clever to force two mismatched images into agreement.
	 *
	 * Works by pointer, by touch and by keyboard: the handle is a real range input, so arrow
	 * keys move it and a screen reader announces it. The visual handle is drawn on top and
	 * the input itself is invisible but present - a div listening for mousemove is the usual
	 * way this is built and it is unreachable without a mouse.
	 */

	export let thenSrc: string;
	export let thenAlt: string;
	export let thenLabel: string;
	export let nowSrc: string;
	export let nowAlt: string;
	export let nowLabel: string;

	/** How far across the divider sits, 0-100. */
	let at = 50;
</script>

<div class="relative select-none overflow-hidden rounded-xl bg-gray-900">
	<!--
		The "now" image sets the box's height and the "then" image is clipped over it, so the
		two are always the same size on screen whatever their own proportions are. Clipping
		rather than resizing: scaling one to match the other would distort a photograph.
	-->
	<img src={nowSrc} alt={nowAlt} class="block w-full" draggable="false" />

	<div class="absolute inset-0 overflow-hidden" style="clip-path: inset(0 {100 - at}% 0 0)">
		<img src={thenSrc} alt={thenAlt} class="block h-full w-full object-cover" draggable="false" />
	</div>

	<!-- The seam. Drawn, not interactive - the range input below owns the interaction. -->
	<div
		class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
		style="left: {at}%"
	/>
	<div
		class="pointer-events-none absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg"
		style="left: {at}%"
		aria-hidden="true"
	>
		&#8596;
	</div>

	<label class="absolute inset-0 cursor-ew-resize">
		<span class="sr-only">Schuif tussen toen en nu</span>
		<input
			type="range"
			min="0"
			max="100"
			bind:value={at}
			class="h-full w-full cursor-ew-resize opacity-0"
			aria-label="Schuif tussen {thenLabel} en {nowLabel}"
		/>
	</label>

	<span
		class="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white"
	>
		{thenLabel}
	</span>
	<span
		class="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white"
	>
		{nowLabel}
	</span>
</div>
