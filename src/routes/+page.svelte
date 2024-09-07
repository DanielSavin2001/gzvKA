<script lang="ts">
    import {onMount} from "svelte";
    import {throwError} from "svelte-preprocess/dist/modules/errors";

    import {showErrorToast, showSuccessToast} from "../services/toaster-service";
    import {getGeoJson} from "../services/google-functions-service";
    import {GeoJSONFeatureCollection} from "../../sharedModels/interfaces";
    import Map from "./components/Map.svelte";

    let geoJsonData: GeoJSONFeatureCollection;
    let mapLoaded = false;

    onMount(async () => {
        try {
            const response = await getGeoJson("mapData");
            if (response.ok) {
                geoJsonData = await response.json();
                mapLoaded = true;
                showSuccessToast("Map successfully loaded", "Now you can explore the image archive of Kapellen and it's surroundings.")
            } else {
                throwError(response.statusText)
            }
        } catch (error) {
            showErrorToast("Map load failed", `It looks like something went wrong! Please contact the admins. ${error}`)
        }
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

<Map geoJsonData="{geoJsonData}" mapLoaded="{mapLoaded}"/>


<style>
    :global(.map) {
        min-height: 600px;
    }
</style>