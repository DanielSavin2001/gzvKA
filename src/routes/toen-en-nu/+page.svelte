<script lang="ts">
	import type { ThenAndNowView } from '$lib/page-data';
	import Seo from '../components/Seo.svelte';
	import ToenEnNu from '../components/ToenEnNu.svelte';

	export let data: { pairs: ThenAndNowView[]; card: string | null };
</script>

<Seo
	title="Toen &amp; nu"
	description="Dezelfde plek in Kapellen, decennia uit elkaar. Schuif tussen de oude foto en dezelfde plek vandaag."
	path="/toen-en-nu"
	image={data.card}
/>

<div class="mx-auto max-w-3xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Toen &amp; nu</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
			Toen &amp; nu
		</h1>
		<p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
			Dezelfde plek, decennia uit elkaar. Schuif de foto open en kijk wat er veranderde.
		</p>
	</header>

	{#if data.pairs.length === 0}
		<!--
			Deliberately empty, and deliberately saying why.
			
			The effect only works when the two photographs are the same view - somebody standing
			where the eerste fotograaf stood. The archive has no such pair: it holds Kasteel
			Irishof in 1909 from the garden and in 2013 from the street, which is the same
			building and not the same picture. Pairing those anyway would fake exactly the
			correspondence this page is built on, so instead the page asks for what it needs.
		-->
		<section
			class="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40"
		>
			<h2 class="text-xl font-bold text-amber-900 dark:text-amber-200">
				Hier kan jij aan meehelpen
			</h2>
			<p class="mt-2 text-amber-900/90 dark:text-amber-200/90">
				Een goede &ldquo;toen &amp; nu&rdquo; vraagt één ding: iemand die gaat staan waar de
				fotograaf van toen stond, en dezelfde foto opnieuw neemt. Dezelfde hoek, dezelfde hoogte,
				dezelfde kant van de straat.
			</p>
			<p class="mt-3 text-amber-900/90 dark:text-amber-200/90">
				We zetten er met opzet nog geen in. Twee foto's van hetzelfde gebouw vanuit een andere hoek
				over elkaar schuiven ziet er niet uit als de tijd die voorbijgaat &mdash; het ziet er uit
				als twee foto's die ruzie maken.
			</p>
			<div class="mt-5 flex flex-wrap gap-3">
				<a
					class="rounded-lg bg-amber-700 px-5 py-2.5 font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
					href="/upload"
				>
					Stuur een foto van vandaag in
				</a>
				<a
					class="rounded-lg border border-amber-400 px-5 py-2.5 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
					href="/straten"
				>
					Zoek een straat om na te doen
				</a>
			</div>
		</section>
	{:else}
		<div class="mt-8 space-y-12">
			{#each data.pairs as pair (pair.then.id + pair.now.id)}
				<section>
					<ToenEnNu
						thenSrc={pair.then.image}
						thenAlt={pair.then.alt}
						thenLabel={pair.then.label}
						nowSrc={pair.now.image}
						nowAlt={pair.now.alt}
						nowLabel={pair.now.label}
					/>
					<h2 class="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100">
						{pair.then.title}
					</h2>
					{#if pair.note}
						<p class="mt-1 text-gray-700 dark:text-gray-300">{pair.note}</p>
					{/if}
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						<a
							class="text-blue-800 underline hover:no-underline dark:text-blue-300"
							href="/foto/{pair.then.id}">{pair.then.label}</a
						>
						&middot;
						<a
							class="text-blue-800 underline hover:no-underline dark:text-blue-300"
							href="/foto/{pair.now.id}">{pair.now.label}</a
						>
					</p>
				</section>
			{/each}
		</div>
	{/if}
</div>
