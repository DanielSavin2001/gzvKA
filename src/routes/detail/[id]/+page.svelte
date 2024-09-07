<script lang="ts">
    import {onMount} from "svelte";
    import {throwError} from "svelte-preprocess/dist/modules/errors";
    import {TextPlaceholder} from "flowbite-svelte";

    import {showErrorToast, showSuccessToast} from "../../../services/toaster-service";
    import {getGeoJson, getSubject} from "../../../services/google-functions-service";
    import {GeoJSONFeatureCollection, Subject} from "../../../../sharedModels/interfaces";
    import Map from "../../components/Map.svelte";
    
    export let data;

    let geoJsonData: GeoJSONFeatureCollection;
    let mapLoaded = false;
    let currentSubject: Subject;

    onMount(async () => {
        try {
            const responseSubject = await getSubject(data.id);
            currentSubject = await responseSubject.json();

            const responseGeoJson = await getGeoJson(currentSubject.name);
            if (responseGeoJson.ok) {
                geoJsonData = await responseGeoJson.json();
                showSuccessToast("Map successfully loaded", "Now you can explore the image archive of Kapellen and it's surroundings.")
            } else {
                throwError(responseGeoJson.statusText)
            }
        } catch (error) {
            showErrorToast("Map load failed", `It looks like something went wrong! Please contact the admins. ${error}`)
        } finally {
            mapLoaded = true;
        }
    });

</script>


<div class="text-center">

    {#if !mapLoaded}
        <div class="flex justify-center">
            <TextPlaceholder size="xl" class="mt-8"/>
        </div>
    {:else }
        <h1 class="m-4 mt-16 text-3xl font-extrabold leading-none tracking-tight text-gray-900 md:text-4xl lg:text-5xl dark:text-white max-w-5xl mx-auto">
            {currentSubject?.name}
        </h1>
        <p class="mb-6 text-lg font-normal text-gray-500 lg:text-xl sm:px-16 xl:px-48 dark:text-gray-400">
            {currentSubject?.explanation}
        </p>
    {/if}
</div>

<br>
<br>
<Map geoJsonData="{geoJsonData}" mapLoaded="{mapLoaded}"/>

<style>
    :global(.map) {
        min-height: 600px;
    }
</style>