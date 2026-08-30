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
	<Nav />

	<!--
		The archive had no `main` element at all, so a screen reader offered no way to skip
		the header and every page was one undifferentiated region.
	-->
	<main class="flex-1">
		<slot />
	</main>

	<Footer />
</div>

<ToastContainer placement="bottom-right" let:data>
	<FlatToast {data} />
	<!-- Provider template for your toasts -->
</ToastContainer>
<CookieBanner />
