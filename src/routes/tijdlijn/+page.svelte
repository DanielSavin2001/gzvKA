<script lang="ts">
	import { onMount } from 'svelte';

	import type { Decade } from '$lib/page-data';
	import { SITE } from '$lib/seo';
	import Seo from '../components/Seo.svelte';

	export let data: { decades: Decade[]; dated: number; total: number; card: string | null };

	/**
	 * The tallest band sets the scale.
	 *
	 * Heights are linear from zero, because that is what a bar length means. A decade
	 * holding one photograph gets a sliver rather than a fair share - so every count is
	 * also written down, in the bar's label, its tooltip and its section heading.
	 */
	$: tallest = Math.max(...data.decades.map((decade) => decade.count), 1);

	/** Enough of a bar to be visible and clickable when a decade holds one photograph. */
	const FLOOR = 4;

	function height(count: number): number {
		return Math.max(FLOOR, Math.round((count / tallest) * 100));
	}

	/** Which band the reader is inside, so the strip says where they are. */
	let here = '';

	onMount(() => {
		// The same approach the long stories use: an observer rather than a scroll handler,
		// so a page of 608 photographs is not doing layout maths on every frame.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) here = entry.target.id.replace('jaren-', '');
				}
			},
			{ rootMargin: '-25% 0px -65% 0px' }
		);

		for (const section of document.querySelectorAll('section[id^="jaren-"]')) {
			observer.observe(section);
		}

		return () => observer.disconnect();
	});
</script>

<Seo
	title="Tijdlijn van het fotoarchief"
	description="Blader door het fotoarchief van Kapellen per decennium, van de eerste kaarten uit 1841 tot vandaag."
	path="/tijdlijn"
	image={data.card}
	structured={{
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: 'Tijdlijn van het fotoarchief van Kapellen',
		description: `${data.dated} gedateerde foto's, gerangschikt per decennium.`,
		inLanguage: 'nl-BE',
		url: `${SITE}/tijdlijn`
	}}
/>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Tijdlijn</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			De tijdlijn van Kapellen
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Van de topografische kaart van 1841 tot vorig jaar. Klik een balk om naar dat decennium te
			springen.
		</p>
		<!--
			The denominator, said plainly. 608 of 4,504 photographs carry a year, and a
			timeline that showed an eighth of the archive as though it were the whole of it
			would be a prettier page and a worse one.
		-->
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{data.dated.toLocaleString('nl-BE')} van de {data.total.toLocaleString('nl-BE')} foto's dragen
			een jaartal.
		</p>
	</header>

	<!--
		The shape of the archive, and the way through it.

		One bar per decade, height straight from the count. It doubles as navigation because
		the two questions a reader has here are the same question: where is there something
		to look at, and take me there.
	-->
	<div
		class="sticky top-16 z-30 -mx-4 mt-8 border-y border-gray-200 bg-paper/95 px-4 py-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
	>
		<ul class="flex items-end gap-1 sm:gap-2">
			{#each data.decades as decade (decade.key)}
				<li class="flex min-w-0 flex-1 flex-col items-center gap-1">
					<span
						class="text-xs tabular-nums text-gray-600 transition-opacity dark:text-gray-400"
						class:opacity-100={here === decade.key}
						class:opacity-0={here !== decade.key}
					>
						{decade.count}
					</span>

					<!--
						The bar needs a track of its own.

						Its height is a percentage, and a percentage resolves against a definite
						parent height. Sitting straight in the flex row it had none, so every bar
						computed to zero and the strip rendered as a row of labels under an empty
						band. This div is that definite height.
					-->
					<div class="flex h-20 w-full items-end sm:h-24">
						<a
							href="#jaren-{decade.key}"
							class="timeline-bar w-full rounded-t focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							class:is-here={here === decade.key}
							style="height: {height(decade.count)}%"
							title="{decade.span} &middot; {decade.count} foto's"
							aria-label="{decade.label}, {decade.count} foto's"
							aria-current={here === decade.key ? 'true' : undefined}
						/>
					</div>

					<span
						class="w-full truncate text-center text-xs tabular-nums text-gray-600 dark:text-gray-400"
						class:font-bold={here === decade.key}
					>
						{decade.key === 'voor-1900' ? '<1900' : decade.key}
					</span>
				</li>
			{/each}
		</ul>
	</div>

	{#each data.decades as decade (decade.key)}
		<section id="jaren-{decade.key}" class="scroll-mt-52 py-10">
			<header
				class="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-gray-200 pb-3 dark:border-gray-700"
			>
				<h2
					class="text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums sm:text-5xl dark:text-gray-100"
				>
					{decade.label}
				</h2>
				<p class="text-gray-600 dark:text-gray-400">
					{decade.span} &middot; {decade.count}
					{decade.count === 1 ? 'foto' : "foto's"}
				</p>
			</header>

			<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each decade.photos as photo (photo.id)}
					<a
						class="group block overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gray-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-500"
						href="/foto/{photo.id}?lijst=jaren:{decade.key}"
					>
						<div class="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
							<img
								src={photo.image}
								alt={photo.alt}
								loading="lazy"
								decoding="async"
								class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
							/>
						</div>
						<div class="p-3">
							<h3 class="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
								{photo.title}
							</h3>
							{#if photo.year}
								<p class="mt-1 text-sm tabular-nums text-gray-600 dark:text-gray-400">
									{photo.year}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	/*
		The bar colour is chosen, not inherited, and both modes were validated against the
		surface they actually sit on rather than one being a flip of the other.
	*/
	.timeline-bar {
		background-color: #2a78d6;
		opacity: 0.55;
		transition: opacity 150ms ease, transform 150ms ease;
		transform-origin: bottom;
	}

	.timeline-bar:hover,
	.timeline-bar:focus-visible {
		opacity: 1;
	}

	.timeline-bar.is-here {
		opacity: 1;
		transform: scaleX(1.06);
	}

	:global(.dark) .timeline-bar {
		background-color: #3987e5;
	}

	@media (prefers-reduced-motion: reduce) {
		.timeline-bar {
			transition: none;
		}
		.timeline-bar.is-here {
			transform: none;
		}
	}
</style>
