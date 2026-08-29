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

<Nav />
<slot />
<ToastContainer placement="bottom-right" let:data>
	<FlatToast {data} />
	<!-- Provider template for your toasts -->
</ToastContainer>
<Footer />
<CookieBanner />
