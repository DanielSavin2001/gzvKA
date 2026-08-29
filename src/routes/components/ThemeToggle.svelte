<script lang="ts">
	import { onMount } from 'svelte';

	import type { Theme } from '$lib/theme';
	import { apply, stored, watchSystem } from '$lib/theme';

	/**
	 * Light, dark, or whatever the machine says.
	 *
	 * Three buttons rather than a switch, because a switch cannot express "follow my
	 * system" - and that is the state most people should be in, since they have already
	 * answered the question once in their operating system.
	 */

	let theme: Theme = 'system';
	let ready = false;

	onMount(() => {
		theme = stored();
		ready = true;

		// Someone whose machine turns dark at sunset should see this follow, unless they
		// have overruled it here.
		return watchSystem(() => {
			if (theme === 'system') apply('system');
		});
	});

	function choose(next: Theme): void {
		theme = next;
		apply(next);
	}

	const options: [Theme, string, string][] = [
		['light', 'Licht', '☀'],
		['system', 'Systeem', '◐'],
		['dark', 'Donker', '☾']
	];
</script>

<div
	class="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600"
	role="group"
	aria-label="Weergave"
>
	{#each options as [value, label, glyph] (value)}
		<button
			type="button"
			class="rounded px-2 py-1 text-sm transition {ready && theme === value
				? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}"
			aria-pressed={ready && theme === value}
			title={label}
			on:click={() => choose(value)}
		>
			<span aria-hidden="true">{glyph}</span>
			<span class="sr-only">{label}</span>
		</button>
	{/each}
</div>
