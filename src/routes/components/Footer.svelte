<script>
	import { Footer, FooterCopyright, FooterLink, FooterLinkGroup } from 'flowbite-svelte';

	let currentYear = new Date().getFullYear();

	import smits_logo from '$lib/images/footer/Smits-Belgium-Logo.jpg';
	import dirk_logo from '$lib/images/footer/Logo-Dirk-Van-Laer.jpg';
</script>

<Footer footerType="logo" class="center  bottom-0 left-0 z-20 w-full">
	<hr class="my-6 border-gray-300 dark:border-gray-700 sm:mx-auto lg:my-8" />

	<!--
        Both sponsor logos are JPEGs, so they have no transparency and carry their own white
        background with them. On a dark footer they would be two bright rectangles. A white
        pill behind them is honest about that rather than pretending: the logos are meant to
        sit on white, so they are given white to sit on.
    -->
	<FooterLinkGroup
		ulClass="flex flex-wrap items-center mb-6 text-sm text-gray-500 dark:text-gray-400 sm:mb-0 justify-around"
	>
		<a href="https://www.smitsbelgium.be/" class="center rounded-lg bg-white px-3 py-2"
			><img class="center" src={smits_logo} height="80" width="100" alt="Smits-Belgium-Logo" /></a
		>
		<a href="https://www.dirkvanlaerbvba.be/" class="center rounded-lg bg-white px-3 py-2"
			><img class="center" src={dirk_logo} height="70" width="330" alt="Logo-Dirk-Van-Laer" /></a
		>
	</FooterLinkGroup>

	<FooterCopyright href="/" by="gzvKA" year={currentYear} />

	<FooterLinkGroup
		ulClass="flex flex-wrap items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0"
	>
		<FooterLink href="/over-ons">Over ons</FooterLink>
		<FooterLink href="/contact">Contact</FooterLink>
		<!--
			The way back to the cookie question. Without a route to it the banner asked once
			and the answer was final, which is not what consent means.
		-->
		<FooterLink href="/privacy">Privacy en cookies</FooterLink>
		<!-- A door for two people rather than a feature, so it sits here and not in the menu. -->
		<FooterLink href="/beheer">Beheer</FooterLink>
	</FooterLinkGroup>
</Footer>
