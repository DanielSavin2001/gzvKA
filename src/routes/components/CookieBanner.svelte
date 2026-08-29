<script lang="ts">
	import { onMount } from 'svelte';

	import { isCountable, setConsent, storedConsent } from '$lib/analytics';

	/**
	 * Asking before counting.
	 *
	 * Shown only where there is something to consent to: no measurement id, a preview
	 * channel, `localhost`, or Do Not Track and this never appears, because a banner that
	 * asks permission for something that is not happening is worse than no banner.
	 *
	 * Both buttons are the same size and neither is styled to be the easy one. A "reject"
	 * that is a grey link beside a large green "accept" is a dark pattern, and this archive
	 * does not need one - nobody is selling anything.
	 */

	let show = false;

	onMount(() => {
		show = isCountable() && storedConsent() === 'unknown';
	});

	function answer(consent: 'granted' | 'denied'): void {
		setConsent(consent);
		show = false;
	}
</script>

{#if show}
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t border-gray-300 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
		role="dialog"
		aria-live="polite"
		aria-label="Cookies"
	>
		<div class="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
			<p class="flex-1 text-sm text-gray-700 dark:text-gray-300">
				We tellen graag hoeveel mensen het archief bezoeken en welke foto's gezocht worden. Dat
				gebeurt met Google Analytics en zet een cookie. Zonder uw toestemming meten we niets, en de
				site werkt precies hetzelfde.
			</p>

			<div class="flex shrink-0 gap-2">
				<button
					type="button"
					class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
					on:click={() => answer('denied')}
				>
					Liever niet
				</button>
				<button
					type="button"
					class="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
					on:click={() => answer('granted')}
				>
					Dat mag
				</button>
			</div>
		</div>
	</div>
{/if}
