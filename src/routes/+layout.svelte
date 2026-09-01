<script>
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	import '../app.postcss';
	import Nav from './components/Nav.svelte';
	import Footer from './components/Footer.svelte';
	import CookieBanner from './components/CookieBanner.svelte';
	import favicon from '$lib/images/logo/png/logo-color-rounded.png';
	import { FlatToast, ToastContainer } from 'svelte-toasts';
	import { pageView, start } from '$lib/analytics';

	onMount(start);

	/**
	 * A page view per navigation.
	 *
	 * The browser loads this site once and every route after that is a client-side
	 * transition, which gtag cannot see - so without this the statistics would show only
	 * the page each visitor happened to land on and nothing they did next. Sends nothing
	 * until consent has been given; `pageView` checks.
	 */
	afterNavigate(({ to }) => {
		if (to?.url) pageView(to.url.pathname + to.url.search);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!--
	A column as tall as the window, with the page in the middle of it.
	
	Without this the footer simply follows the content, so any page shorter than the
	viewport - a photograph with little written about it, an empty queue, "niets te
	bekijken" - left it stranded halfway down the screen with the page's own background
	below it. It read as a half-loaded page even once loading had finished.
	
	`flex-1` on the page is what does the work: the footer keeps its own height and the
	page absorbs whatever is left over. On a long page nothing changes.
-->
<div class="flex min-h-screen flex-col">
	<!--
		The skip link. `main` existed but had no id, so the element that exists in order to be
		skipped to was not reachable - the header, with its three dropdowns of street names,
		had to be tabbed through on every page.

		`tabindex="-1"` is not decoration: an anchor pointing at a non-focusable element
		scrolls in Chrome and moves nothing at all in Safari, so without it the link silently
		does nothing for part of the audience. `scroll-mt-20` clears the sticky header, the
		same way MapExplorer and PlaceMap already do for their own anchors.
	-->
	<a
		href="#inhoud"
		class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-800 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
	>
		Direct naar de inhoud
	</a>

	<Nav />

	<main id="inhoud" tabindex="-1" class="flex-1 scroll-mt-20">
		<slot />
	</main>

	<Footer />
</div>

<ToastContainer placement="bottom-right" let:data>
	<FlatToast {data} />
	<!-- Provider template for your toasts -->
</ToastContainer>
<CookieBanner />
