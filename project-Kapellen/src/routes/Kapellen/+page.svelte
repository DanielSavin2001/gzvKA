<script>
    import {
        ImagePlaceholder,
        Skeleton,
        TextPlaceholder,
    } from 'flowbite-svelte';

</script>

<div class="relative px-8">
    <div style="height:1000px;" class="overflow-scroll pb-16">
        <Skeleton class="mt-16 mb-8"/>
        <ImagePlaceholder class="my-8"/>
        <TextPlaceholder class="my-8"/>
    </div>
</div>