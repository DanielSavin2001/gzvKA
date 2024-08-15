<script lang="ts">
    import { MapLibre, GeoJSON } from 'svelte-maplibre';
    import * as turf from 'turf';
    import {onMount} from "svelte";
    import {GeoJSONFeatureCollection} from "./types";

    let geojsonData:GeoJSONFeatureCollection;

    onMount(async () => {
        // Fetch GeoJSON data or load it from a local file
        const response = await fetch('https://firebasestorage.googleapis.com/v0/b/gzvka-12a9f.appspot.com/o/TEST-MAP.geojson?alt=media&token=03a133ab-f6a5-459e-a30e-39e868b87d20');
        console.log(response)
        
        
        geojsonData = await response.json();
        
        console.log(geojsonData)
        
        // Example of using Turf.js to manipulate data
        const bufferedFeatures = turf.buffer(geojsonData, 100, { units: 'meters' });
        // Update geojsonData with buffered features
        geojsonData = bufferedFeatures;
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
    id="my-data" 
    data={geojsonData}
    cluster={{ // Cluster configuration (optional)
    radius: 50, // Adjust cluster radius as needed
    maxZoom: 14, // Maximum zoom level for clusters
    // Add other cluster options as needed
    }}/>
</MapLibre>

<style>
    :global(.map) {
        min-height: 500px;
    }
</style>