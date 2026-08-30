<script lang="ts">
	import { askAgain } from '$lib/analytics';
	import Seo from '../components/Seo.svelte';

	/**
	 * What the archive knows about the people who visit it.
	 *
	 * Written from what the code does, not from a template. Every claim here is checkable
	 * against a file: the consent gate in `src/lib/analytics.ts`, and `toPublished` in
	 * `sharedModels/submission.ts`, which is a projection rather than a filter - an email
	 * address cannot reach the public site through it because it is never copied across.
	 *
	 * There is deliberately no postal address or company detail invented here. The Contact
	 * page is the way to reach the archive, and it is linked below.
	 */
</script>

<Seo
	title="Privacy en cookies"
	description="Wat het fotoarchief van Kapellen bijhoudt: bezoekcijfers alleen met toestemming, en wat er met ingestuurde foto's gebeurt."
	path="/privacy"
/>

<div class="mx-auto max-w-3xl px-4 py-8">
	<nav class="text-sm text-gray-600 dark:text-gray-400">
		<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/">Startpagina</a
		>
		<span class="mx-2">/</span>
		<span>Privacy en cookies</span>
	</nav>

	<h1
		class="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100"
	>
		Privacy en cookies
	</h1>

	<div class="mt-6 space-y-8 text-gray-700 dark:text-gray-300">
		<section>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Bezoekcijfers</h2>
			<p class="mt-2 leading-relaxed">
				We tellen graag hoeveel mensen het archief bezoeken en welke foto's gezocht worden, zodat we
				weten waar we aan verder moeten werken. Dat gebeurt met Google Analytics.
			</p>
			<p class="mt-3 leading-relaxed">
				<strong>Alleen als u ja zegt.</strong> Zegt u nee, dan wordt Google Analytics niet geladen &mdash;
				er vertrekt geen enkele aanvraag naar Google, en er wordt geen cookie gezet. De site werkt precies
				hetzelfde.
			</p>
			<p class="mt-3 leading-relaxed">
				Wat er gemeten wordt als u ja zegt: welke pagina's bezocht worden, uit welk land of welke
				streek ongeveer, en op wat voor toestel. Geen naam, geen account, en niets dat we aan een
				persoon kunnen koppelen.
			</p>
			<p class="mt-3 leading-relaxed">
				Heeft uw browser <em>Do Not Track</em> aan staan, dan tellen we niets en vragen we het ook niet.
				Dat is ook een antwoord.
			</p>

			<button
				type="button"
				class="mt-4 rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
				on:click={askAgain}
			>
				Mijn keuze wijzigen
			</button>
		</section>

		<section>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Foto's die u instuurt</h2>
			<p class="mt-2 leading-relaxed">
				Stuurt u een foto in, dan vragen we er twee dingen bij: uw naam en uw e-mailadres. Ze worden
				verschillend behandeld.
			</p>
			<ul class="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
				<li>
					<strong>Uw naam</strong> komt bij de foto te staan, zoals bij alle andere foto's in het archief.
					Dat is de bedoeling: wie een foto bewaard heeft, hoort erbij vermeld te worden. Laat u het
					veld leeg, dan staat er niets.
				</li>
				<li>
					<strong>Uw e-mailadres</strong> gebruiken we alleen om u iets te kunnen vragen over de foto
					die u instuurde &mdash; welk jaar het ongeveer was, wie erop staat. Het komt nooit op de website
					terecht.
				</li>
			</ul>
			<p class="mt-3 leading-relaxed">
				Wilt u een ingestuurde foto weer weg, of uw naam er niet meer bij? Laat het weten via de
				<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/contact"
					>contactpagina</a
				>, dan halen we het eruit.
			</p>
		</section>

		<section>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">De kaart</h2>
			<p class="mt-2 leading-relaxed">
				De kaart haalt haar tegels bij OpenStreetMap. Uw browser doet die aanvraag rechtstreeks, dus
				OpenStreetMap ziet dat er een kaart geladen wordt. Wij geven daar niets bij door.
			</p>
		</section>

		<section>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
				Wat er in uw browser blijft
			</h2>
			<p class="mt-2 leading-relaxed">
				Uw antwoord op de cookievraag en uw keuze voor licht of donker worden in uw eigen browser
				bewaard. Die blijven daar staan &mdash; ze worden niet verstuurd.
			</p>
		</section>

		<section>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Iets vragen</h2>
			<p class="mt-2 leading-relaxed">
				Vragen over wat hier staat, of over uw eigen gegevens? Dat kan via de
				<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/contact"
					>contactpagina</a
				>.
			</p>
		</section>
	</div>
</div>
