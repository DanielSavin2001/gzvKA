<script lang="ts">
    import {CircleLayer, GeoJSON, MapLibre} from 'svelte-maplibre';
    import {onMount} from "svelte";
    import {GeoJSONFeatureCollection} from "./types";
    import {toasts} from "svelte-toasts";

    let geojsonData: GeoJSONFeatureCollection;

    const showToast = () => {
        const toast = toasts.add({
            title: 'Toast was loaded!',
            description: 'Here is the body!',
            duration: 5000,
            placement: 'bottom-right',
            theme: 'dark',
            type: 'success',
            showProgress: true,
            onClick: () => {},
            onRemove: () => {},
        })
    };
    onMount(async () => {
        const response = await fetch('http://127.0.0.1:5001/gzvka-12a9f/us-central1/http_retrieve_geojson');
        geojsonData = await response.json();
        showToast()
    });
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
        style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">
    <GeoJSON
            id="geojsonData"
            data={geojsonData}
            cluster={{ 
      radius: 500,
      maxZoom: 14,
    }}
            on:layeradd={() => console.log("GeoJSON layer added.")}
            on:error={(e) => console.error("GeoJSON error:", e)}
    >
        <CircleLayer
                on:click={()=>showToast()}
                id="clusters"
                applyToClusters
                paint={{
                'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
            }}
        />

        <CircleLayer
                id="points"
                applyToClusters={false}
                paint={{
                'circle-color': '#11b4da',
                'circle-radius': 4,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff',
            }}
        />
    </GeoJSON>
</MapLibre>
<style>
    :global(.map) {
        min-height: 500px;
    }
</style>