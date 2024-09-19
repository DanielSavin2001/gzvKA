<script lang="ts">
  import {onMount} from "svelte";
  import {throwError} from "svelte-preprocess/dist/modules/errors";
  import {TextPlaceholder} from "flowbite-svelte";

  import {showErrorToast, showSuccessToast} from "../../../services/toaster-service";
  import {getGeoJson, getImageDocuments, getSubject} from "../../../services/google-functions-service";
  import {GeoJSONFeatureCollection, ImageDocument, Subject} from "../../../../sharedModels/interfaces";
  import Map from "../../components/Map.svelte";
  import ImageCard from "../../components/cards/ImageCard.svelte";

  export let data;

  let geoJsonData: GeoJSONFeatureCollection;
  let mapLoaded = false;
  let imagesLoaded = false;
  let currentSubject: Subject;
  let imageDocuments: ImageDocument[];

  onMount(async () => {
    try {
      const responseSubject = await getSubject(data.id);
      currentSubject = await responseSubject.json();

      const responseGeoJson = await getGeoJson(currentSubject.name);
      if (responseGeoJson.ok) {
        geoJsonData = await responseGeoJson.json();
        showSuccessToast("Map successfully loaded", `Now you can explore the map of related images of ${currentSubject.name}`)
      } else {
        throwError(responseGeoJson.statusText)
      }

      const responseGetImages = await getImageDocuments(data.id);
      if (responseGetImages.ok) {
        imageDocuments = await responseGetImages.json();
        showSuccessToast("Images successfully loaded", "Now you can explore the image archive of Kapellen and it's surroundings.")
      } else {
        throwError(responseGeoJson.statusText)
      }
    } catch (error) {
      showErrorToast("Map or Image load failed", `It looks like something went wrong! Please contact the admins. ${error}`)
    } finally {
      mapLoaded = true;
      imagesLoaded = true;
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
<br>
<br>
{#if imagesLoaded}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {#each imageDocuments as imageDocument}
            <ImageCard imageDocument={imageDocument}/>
        {/each}
    </div>
{/if}


<style>
    :global(.map) {
        min-height: 600px;
    }
</style>