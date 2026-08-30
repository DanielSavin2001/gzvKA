<script>
	import Seo from '../components/Seo.svelte';
    import {
        ImagePlaceholder,
        Skeleton,
        TextPlaceholder,
    } from 'flowbite-svelte';

</script>

<!--
	A leftover from the old Firestore-backed site: nothing on this site links here.
	Out of the index rather than deleted - that is Daniel's call, not mine - but there is
	no reason for a search result to lead anybody to a page the site itself abandoned.
-->
<Seo
	title="Kapellen"
	description="Een oudere pagina van het fotoarchief van Kapellen."
	path="/kapellen"
	noindex
/>

<div class="relative px-8">
    <div style="height:1000px;" class="overflow-scroll pb-16">
        <Skeleton class="mt-16 mb-8"/>
        <ImagePlaceholder class="my-8"/>
        <TextPlaceholder class="my-8"/>
    </div>
</div>