<script>
    import { MapLibre } from 'svelte-maplibre';
</script>

<div class="text-center">
    <h1 class="m-4 mt-16 text-3xl font-extrabold leading-none tracking-tight text-gray-900 md:text-4xl lg:text-5xl dark:text-white max-w-5xl mx-auto">Welkom tot <b>Ge zijt van Kapellen als ge ...</b> fotoarchief!</h1>
    <p class="mb-6 text-lg font-normal text-gray-500 lg:text-xl sm:px-16 xl:px-48 dark:text-gray-400">
        Duik in de rijke geschiedenis van Kapellen met onze unieke verzameling foto's van bijzondere plekken, mensen en momenten.
    </p>
</div>

<br>
<br>
<MapLibre
        center={[4.369681, 51.307764]}
        zoom={10}
        class="map"
        standardControls
        style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />

<style>
    :global(.map) {
        min-height: 500px;
    }
</style>