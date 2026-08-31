<script>
	let currentYear = new Date().getFullYear();

	import smits_logo from '$lib/images/footer/Smits-Belgium-Logo.jpg';
	import dirk_logo from '$lib/images/footer/Logo-Dirk-Van-Laer.jpg';
</script>

<!--
	Hand-written rather than flowbite-svelte, which was used nowhere else: the preset footer
	stacked logos, copyright and links into one dense block on a ground one shade lighter
	than the page, which read as clutter. Three quiet rows on the page's own ground instead:
	the site's pages, the sponsors under a label saying what they are, the copyright line.
-->
<footer class="mt-12 border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
	<div class="mx-auto w-full max-w-5xl px-4 py-10">
		<nav aria-label="Over deze site">
			<ul
				class="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-gray-600 dark:text-gray-300"
			>
				<li><a class="hover:underline" href="/over-ons">Over ons</a></li>
				<!--
					The people the archive is made of. Here rather than in the header menu because it
					is not a way of browsing photographs - it is who to thank for them.
				-->
				<li><a class="hover:underline" href="/schenker">Schenkers</a></li>
				<!--
					Here rather than in the header until there are pairings to show. The header is
					already six items wide and this page is currently an invitation rather than a
					feature; promote it once `static/data/toen-en-nu.json` has something in it.
				-->
				<li><a class="hover:underline" href="/toen-en-nu">Toen &amp; nu</a></li>
				<li><a class="hover:underline" href="/upload">Stuur een foto in</a></li>
				<li><a class="hover:underline" href="/contact">Contact</a></li>
				<!--
					The way back to the cookie question. Without a route to it the banner asked once
					and the answer was final, which is not what consent means.
				-->
				<li><a class="hover:underline" href="/privacy">Privacy en cookies</a></li>
				<!-- A door for two people rather than a feature, so it sits here and not in the menu. -->
				<li><a class="hover:underline" href="/beheer">Beheer</a></li>
			</ul>
		</nav>

		<div class="mt-10">
			<p
				class="text-center text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500"
			>
				Met dank aan
			</p>
			<!--
				Both sponsor logos are JPEGs, so they have no transparency and carry their own white
				background with them. On a dark footer they would be two bright rectangles. A white
				pill behind them is honest about that rather than pretending: the logos are meant to
				sit on white, so they are given white to sit on - at one shared height, so they read
				as a row of sponsors rather than two unrelated blocks.
			-->
			<div class="mt-4 flex flex-wrap items-center justify-center gap-4">
				<a
					href="https://www.smitsbelgium.be/"
					rel="noopener"
					target="_blank"
					class="flex h-16 items-center rounded-lg bg-white px-5 py-2 ring-1 ring-gray-200 dark:ring-0"
				>
					<img class="max-h-12 w-auto" src={smits_logo} alt="Smits Belgium" />
				</a>
				<a
					href="https://www.dirkvanlaerbvba.be/"
					rel="noopener"
					target="_blank"
					class="flex h-16 items-center rounded-lg bg-white px-5 py-2 ring-1 ring-gray-200 dark:ring-0"
				>
					<img class="max-h-10 w-auto" src={dirk_logo} alt="Dirk Van Laer & Co bvba, sanitair & cv" />
				</a>
			</div>
		</div>

		<p class="mt-10 text-center text-xs text-gray-400 dark:text-gray-500">
			© {currentYear} <a class="hover:underline" href="/">gzvKA</a> · Alle rechten voorbehouden
		</p>
	</div>
</footer>
