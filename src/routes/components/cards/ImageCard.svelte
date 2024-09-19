<script lang="ts">
  import {Button, Card} from "flowbite-svelte";
  import {retrieveImage} from "../../../services/google-functions-service.js";
  import {ImageDocument} from "../../../../sharedModels/interfaces";
  import {onMount} from "svelte";

  export let imageDocument: ImageDocument;
  let imageUrl: string | undefined = undefined; // Updated to handle the image URL properly

  onMount(async () => {
    const imageResponse = await retrieveImage(imageDocument.imgURL);
    const imageBlob = await imageResponse.blob();
    imageUrl = URL.createObjectURL(imageBlob);
  });
</script>

<div class="space-y-4 mx-auto h-auto">
    <Card img={imageUrl}>
        <h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{imageDocument.imageName}</h5>
        <p class="mb-3 font-normal text-gray-700 dark:text-gray-400 leading-tight">Description: {imageDocument.imageDescription ? imageDocument.imageDescription : '/'}</p>
        <p class="mb-3 font-normal text-gray-700 dark:text-gray-400 leading-tight">Year of image: {imageDocument.yearOfImage ? imageDocument.yearOfImage : '/'}</p>
        <Button>
            Read more >
        </Button>
    </Card>
</div>