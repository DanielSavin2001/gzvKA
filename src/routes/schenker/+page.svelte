<script lang="ts">
	import type { DonorLink } from '$lib/page-data';
	import Seo from '../components/Seo.svelte';

	export let data: { donors: DonorLink[] };

	$: photographs = data.donors.reduce((sum, donor) => sum + donor.count, 0);

	/**
	 * Grouped by first letter.
	 *
	 * 298 names is too many to take in as one column and too few to need a search box. The
	 * letters turn a scroll into a lookup: you know the name you are after, so you go to
	 * its letter. Deliberately not trimmed to ten with a "show more" button the way the
	 * street index is - that page is a list above other content, this page *is* the list,
	 * and 298 names at ten a time is twenty-nine taps.
	 */
	$: grouped = data.donors.reduce<{ letter: string; donors: DonorLink[] }[]>((groups, donor) => {
		// Fold the accent, so André and Andre land under the same A rather than in
		// different places thirty rows apart.
		const letter = donor.name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();

		const last = groups[groups.length - 1];
		if (last && last.letter === letter) last.donors.push(donor);
		else groups.push({ letter, donors: [donor] });

		return groups;
	}, []);
</script>

<Seo
	title="Schenkers van het fotoarchief"
	description="Iedereen die een foto aan het archief van Kapellen gaf: {data.donors
		.length} mensen en verenigingen, samen goed voor {photographs.toLocaleString('nl-BE')} foto's."
	path="/schenker"
/>

<div class="mx-auto max-w-5xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Schenkers</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			Schenkers
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Dit archief bestaat omdat mensen hun foto's afstonden. Hier staat wie, en wat ze gaven.
		</p>
		<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
			{data.donors.length} schenkers &middot; {photographs.toLocaleString('nl-BE')} foto's
		</p>
	</header>

	{#each grouped as group (group.letter)}
		<section class="mt-8">
			<h2
				class="border-b border-gray-300 pb-1 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100"
			>
				{group.letter}
			</h2>
			<ul class="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each group.donors as donor (donor.slug)}
					<li>
						<a
							class="flex items-baseline justify-between gap-3 rounded px-2 py-1.5 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-blue-950"
							href="/schenker/{donor.slug}"
						>
							<span class="font-medium text-gray-900 dark:text-gray-100">{donor.name}</span>
							<span class="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400"
								>{donor.count}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
