<script lang="ts">
	/**
	 * How to reach the archive.
	 *
	 * Deliberately built around the two things that already work end to end - sending a
	 * photograph, and correcting a place on the map - rather than around an email address.
	 * Most of what people want to say is one of those two, and both land somewhere a curator
	 * actually looks.
	 *
	 * There is no email address on this page yet because the archive has not been given one.
	 * Inventing a plausible one, or putting a private address on a public page, would both
	 * be worse than the gap. See the block marked below.
	 */
</script>

<svelte:head>
	<title>Contact | gzvKA fotoarchief</title>
	<meta
		name="description"
		content="Foto's insturen, een plek op de kaart rechtzetten, of iets melden dat niet klopt."
	/>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
		Contact
	</h1>

	<p class="mt-4 text-lg text-gray-700 dark:text-gray-300">
		Het meeste wat mensen ons willen zeggen, gaat over één van deze twee dingen. Voor allebei hoeft
		u niets aan te maken en niemand te mailen.
	</p>

	<div class="mt-8 grid gap-4 sm:grid-cols-2">
		<section class="rounded-xl border border-gray-300 p-5 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Ik heb een foto</h2>
			<p class="mt-2 text-gray-700 dark:text-gray-300">
				Van uw straat, uw school, het café op de hoek. U hoeft geen account te maken en niets in te
				vullen behalve de foto zelf. Iemand van het archief bekijkt ze voor ze online komt.
			</p>
			<a
				class="mt-4 inline-block rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900"
				href="/upload">Foto insturen</a
			>
		</section>

		<section class="rounded-xl border border-gray-300 p-5 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Er staat iets fout</h2>
			<p class="mt-2 text-gray-700 dark:text-gray-300">
				Een plek op de verkeerde spot, een naam die niet klopt. Waar we het zelf niet zeker weten
				staat op de kaart een rode cirkel met de reden erbij, en een knop om het recht te zetten.
			</p>
			<a
				class="mt-4 inline-block rounded-lg border-2 border-blue-800 px-5 py-2.5 font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950"
				href="/#kaart">Naar de kaart</a
			>
		</section>
	</div>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">Iets anders</h2>

	<!--
		No address here on purpose.

		The archive has no contact address of its own yet, and the alternatives were both
		worse than saying so: making one up, or publishing a private one on a page anybody
		can read. Put the real address in the paragraph below when there is one.
	-->
	<p class="mt-3 text-gray-700 dark:text-gray-300">
		Wilt u iets vragen dat hier niet onder valt &mdash; over het gebruik van een foto, bijvoorbeeld,
		of over een hele reeks tegelijk &mdash; laat het dan weten via het opmerkingenveld bij <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/upload">Foto insturen</a
		>. Dat komt op dezelfde plek terecht en wordt gelezen.
	</p>

	<h2 class="mt-10 text-2xl font-bold text-gray-900 dark:text-gray-100">Over de foto's zelf</h2>

	<p class="mt-3 text-gray-700 dark:text-gray-300">
		De foto's zijn door de jaren heen door inwoners van Kapellen bijeengebracht. Staat u ergens op
		en wilt u dat een foto weggaat, zeg het dan &mdash; dat is geen discussie.
	</p>

	<p class="mt-6 text-sm text-gray-600 dark:text-gray-400">
		Meer over waar dit archief vandaan komt, staat op <a
			class="text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/over-ons">Over ons</a
		>.
	</p>
</div>
