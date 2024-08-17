<script>
    import '../app.postcss';
    import Nav from "./components/Nav.svelte";
    import Footer from "./components/Footer.svelte";
    import favicon from '$lib/images/logo/png/logo-color-rounded.png';
    import {FlatToast, ToastContainer} from "svelte-toasts";
</script>
<svelte:head>
    <link rel="icon" href="{favicon}"/>
</svelte:head>

<Nav/>
<slot/>
<ToastContainer placement="bottom-right" let:data={data}>
    <FlatToast {data} /> <!-- Provider template for your toasts -->
</ToastContainer>
<Footer/>