<script lang="ts">
	import type { SubjectRow } from '$lib/page-data';
	import Seo from '../components/Seo.svelte';

	/**
	 * Bladeren op onderwerp.
	 *
	 * The archive has three ways in and all three are geographic: straten, kastelen, wijken.
	 * That works for a photograph the matcher could place, and 793 of them it could not - no
	 * street page, no map pin, and for 557 of those no year either, so no timeline. Those
	 * photographs were reachable only by guessing the right word into the search box.
	 *
	 * The subject is what they do have. It is the folder the photograph sits in, and it is
	 * often the most human thing the archive knows about it: "Klasfoto's", "Kerken en
	 * kapellen", "Sport in Kapellen". Which folders get a page is decided in
	 * `sharedModels/subject-pages.ts`, with the reasons.
	 */

	export let data: { subjects: SubjectRow[] };

	$: photographs = data.subjects.reduce((sum, subject) => sum + subject.count, 0);
	$: placeless = data.subjects.reduce((sum, subject) => sum + subject.placeless, 0);
</script>

<Seo
	title="Onderwerpen"
	description="Blader door het fotoarchief van Kapellen op onderwerp: klasfoto's, kerken en kapellen, sport, feesten, het station en meer."
	path="/onderwerpen"
/>

<div class="mx-auto max-w-5xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Onderwerpen</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			Onderwerpen
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Niet elke foto hoort bij een straat. Een klasfoto hoort bij een school, een processie bij een
			feest. Dit is de ingang voor alles wat op de kaart niet te vinden is.
		</p>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{data.subjects.length} onderwerpen &middot; {photographs.toLocaleString('nl-BE')} foto's
			{#if placeless > 0}
				&middot; waarvan {placeless.toLocaleString('nl-BE')} op geen enkele kaart staan
			{/if}
		</p>
	</header>

	<ul class="mt-8 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.subjects as subject (subject.slug)}
			<li>
				<a
					class="flex items-baseline justify-between gap-3 rounded px-2 py-2.5 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-blue-950"
					href="/onderwerp/{subject.slug}"
				>
					<span class="font-medium text-gray-900 dark:text-gray-100">{subject.name}</span>
					<span class="shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-400">
						{subject.count}
					</span>
				</a>
			</li>
		{/each}
	</ul>

	<!--
		Said plainly rather than hidden. A reader who wonders why the Hoevensebaan is not in
		this list deserves the answer, and the answer is that its own page is better.
	-->
	<p
		class="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400"
	>
		Mappen die dezelfde naam dragen als een straat, kasteel of wijk staan hier niet: die hebben een
		eigen pagina met een kaart, huisnummers en de verhalen erbij. Zoek ze via
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/straten"
			>straten</a
		>,
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/kastelen"
			>kastelen</a
		>
		of
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/wijken"
			>wijken</a
		>.
	</p>
</div>
