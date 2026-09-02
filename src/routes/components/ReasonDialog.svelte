<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';

	/**
	 * Asking a curator why they are turning something down, without insisting.
	 *
	 * This replaces three `window.prompt` calls. The prompt was wrong twice over. It is the
	 * browser's own dialog, so it arrives unstyled, unreadable in dark mode, wherever the
	 * browser feels like putting it, with a single line to type into and no way to say what
	 * the text is for - and on a phone it covers the photograph the curator is deciding
	 * about. And it was load-bearing: cancelling it, or leaving it empty, silently abandoned
	 * the whole decision. A curator who did not want to write a paragraph could not decline
	 * at all.
	 *
	 * So the reason is optional here, and the button says so. What it is for is worth being
	 * plain about: a rejection reason is shown back to whoever sent the photograph or the
	 * report, so it is a message to a person rather than a note to the archive.
	 */

	/** Heading - what is being turned down. */
	export let title = 'Afwijzen';
	/** One line under it, in the caller's own words. */
	export let intro = '';
	/** The word on the confirming button. */
	export let confirmLabel = 'Afwijzen';
	export let busy = false;

	const dispatch = createEventDispatcher<{
		/** The reason, or undefined when none was written. Never blocked on. */
		confirm: { reason?: string };
		cancel: void;
	}>();

	let reason = '';
	let field: HTMLTextAreaElement | null = null;

	onMount(async () => {
		await tick();
		field?.focus();
	});

	function confirm(): void {
		if (busy) return;
		const written = reason.trim();
		dispatch('confirm', written === '' ? {} : { reason: written });
	}

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			dispatch('cancel');
			return;
		}
		// Enter alone would be a newline in a textarea, which is right - a reason can be two
		// sentences. Ctrl/Cmd-Enter sends, the way every message box does.
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			confirm();
		}
	}
</script>

<svelte:window on:keydown={onKey} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
	on:click|self={() => dispatch('cancel')}
>
	<div
		class="w-full max-w-lg rounded-xl border border-gray-300 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
				{#if intro}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{intro}</p>
				{/if}
			</div>
			<button
				type="button"
				class="rounded px-2 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
				aria-label="Sluiten"
				on:click={() => dispatch('cancel')}
			>
				&times;
			</button>
		</div>

		<label class="mt-4 block">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Reden <span class="font-normal text-gray-500 dark:text-gray-400">(mag leeg blijven)</span>
			</span>
			<textarea
				bind:this={field}
				bind:value={reason}
				rows="3"
				maxlength="500"
				placeholder="Bijvoorbeeld: dezelfde foto staat er al in."
				class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
			/>
		</label>

		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			Wat u hier schrijft, wordt bewaard bij de beslissing en teruggekoppeld aan wie het
			instuurde. Laat het leeg als er niets uit te leggen valt.
		</p>

		<div class="mt-4 flex flex-wrap justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
				on:click={() => dispatch('cancel')}
			>
				Annuleren
			</button>
			<button
				type="button"
				class="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:bg-gray-400"
				disabled={busy}
				on:click={confirm}
			>
				{busy ? 'Bezig ...' : confirmLabel}
			</button>
		</div>
	</div>
</div>
