<script>
    import '../app.postcss';
    import Nav from "./components/Nav.svelte";
    import Footer from "./components/Footer.svelte";
    import favicon from '$lib/images/logo/png/logo-color-rounded.png';

</script>
<svelte:head>
    <link rel="icon" href="{favicon}"/>

</svelte:head>

<Nav/>

<slot/>

<Footer/>