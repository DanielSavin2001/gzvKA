<script lang="ts">
    import {Button, Fileupload, Input, Label, Listgroup, ListgroupItem, Modal, Spinner, Textarea} from 'flowbite-svelte';
    import {onMount} from "svelte";
    import {showErrorToast, showSuccessToast} from "../../services/toaster-service";
    import {throwError} from "svelte-preprocess/dist/modules/errors";
    import {MapMarker, Subject} from "../../../sharedModels/interfaces";
    import {createSubject, getAllSubjects, uploadImages} from "../../services/google-functions-service";
    import uploadHeroImage from '$lib/images/upload-hero.jpg';
    import {DefaultMarker, MapEvents, MapLibre, RasterLayer, RasterTileSource} from "svelte-maplibre";

    let retrievedSubjects: Subject[];
    let files: FileList;
    let showCreationModal = false;
    let startedCreation = false;
    let currentSubject: Subject | null = null;
    let uploading = false;
    let loading = true;
    let marker: MapMarker | null = null;

    function addMarker(e: any) {
        marker = {lngLat: e.detail.lngLat};
    }

    onMount(async () => {
        try {
            const response = await getAllSubjects();
            if (response.ok) retrievedSubjects = await response.json();
            else throwError(response.statusText)
        } catch (error) {
            showErrorToast("Page load failed", `It looks like something went wrong! Please contact the admins. ${error}`)
        } finally {
            loading = false;
        }
    });

    async function handleSubmitCreationSubject(event: Event) {
        event.preventDefault();
        startedCreation = true;

        const form = event.target as HTMLFormElement;
        const formData = new FormData(form);

        const subjectName = formData.get('subjectName') as string;
        const subjectExplanation = formData.get('subjectExplanation') as string;

        try {
            const responseCreation = await createSubject({name: subjectName, explanation: subjectExplanation})
            if (responseCreation.ok) retrievedSubjects = await (await getAllSubjects()).json();
            else throwError(responseCreation.statusText)

            showCreationModal = false // Can not be in finally statement, when the creation fails we would like to save the current progress.
            showSuccessToast("Subject created successfully", `Subject with the name "${subjectName}" was created.`)
        } catch (error) {
            showErrorToast("Subject creation failed", `${error}`)
        } finally {
            startedCreation = false // Needs to be in finally statement to reset the disabled state of the creation button.
        }
    }

    function handleSubjectSelect(event: Event) {
        const selectElement = event.target as HTMLSelectElement;
        const selectedIndex = selectElement.selectedIndex;
        if (!currentSubject) currentSubject = retrievedSubjects[selectedIndex - 1];
        else currentSubject = retrievedSubjects[selectedIndex]
    }

    function removeFile(index: number) {
        const newFiles = Array.from(files).filter((_, i) => i !== index);
        files = new DataTransfer().files;
        const dt = new DataTransfer();
        newFiles.forEach(file => dt.items.add(file));
        files = dt.files;
    }

    async function handleUpload() {
        if (!currentSubject || !files || files.length === 0) return;

        uploading = true;

        try {
            const response = await uploadImages(currentSubject.id, Array.from(files), marker);
            files = new DataTransfer().files;

            if (response.ok) {
                showSuccessToast("Upload successful", "Your images have been uploaded.");
            } else {
                throwError(response.statusText);
            }
        } catch (error) {
            showErrorToast("Upload failed", `It looks like something went wrong! Please contact the admins. ${error}`);
        } finally {
            uploading = false;
        }
    }


</script>

<h1 class="text-center text-4xl my-4">Upload zone</h1>

<img src="{uploadHeroImage}" class="rounded-3xl w-6/12 mx-auto mt-3" style="max-width: 30em" alt="">

<div class="px-2 mx-auto mt-5" style="max-width: 50em">
    <Label class="pb-2 text-xl" for="">1. Select subject</Label>

    {#if loading}
        <Spinner class="me-3" size="6" color="blue"/>
        Loading subjects...
    {:else }
        <select name="" id="" class="rounded-xl w-full" on:change={handleSubjectSelect}>
            {#if !retrievedSubjects || retrievedSubjects.length === 0}
                <ListgroupItem>No retrievedSubjects</ListgroupItem>
            {:else}
                {#if !currentSubject}
                    <option value="">
                        Select a value
                    </option>
                {/if}
                {#each retrievedSubjects as subject, index}
                    <option value="{index}">
                        {subject.name}
                    </option>
                {/each}
            {/if}
        </select>

        <div class="py-2">
            <p class="text-gray-600 pb-2">Can't find a relevant subject?</p>
            <Button pill outline on:click={() => (showCreationModal = true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24" {...$$props}>
                    <path fill="currentColor"
                          d="M5 19V5zm0 2q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v7.525q0 .425-.288.7T20 13.5t-.712-.288T19 12.5V5H5v14h6q.425 0 .713.288T12 20t-.288.713T11 21zm3-4q.425 0 .713-.288T9 16t-.288-.712T8 15t-.712.288T7 16t.288.713T8 17m0-4q.425 0 .713-.288T9 12t-.288-.712T8 11t-.712.288T7 12t.288.713T8 13m0-4q.425 0 .713-.288T9 8t-.288-.712T8 7t-.712.288T7 8t.288.713T8 9m8 4q.425 0 .713-.288T17 12t-.288-.712T16 11h-4q-.425 0-.712.288T11 12t.288.713T12 13zm0-4q.425 0 .713-.288T17 8t-.288-.712T16 7h-4q-.425 0-.712.288T11 8t.288.713T12 9zm-5 7q0 .425.288.713T12 17h.05q.425 0 .713-.288T13.05 16t-.288-.712T12.05 15H12q-.425 0-.712.288T11 16m6 4h-2q-.425 0-.712-.288T14 19t.288-.712T15 18h2v-2q0-.425.288-.712T18 15t.713.288T19 16v2h2q.425 0 .713.288T22 19t-.288.713T21 20h-2v2q0 .425-.288.713T18 23t-.712-.288T17 22z"/>
                </svg>
                &nbsp; Create Subject
            </Button>
            <Modal bind:open={showCreationModal} size="xs" autoclose={false} class="w-full">
                <form class="flex flex-col space-y-6" on:submit={handleSubmitCreationSubject}>
                    <h3 class="text-xl font-medium text-gray-900 dark:text-white">Create new Subject</h3>
                    <Label class="space-y-2">
                        <span>Name <span class="text-red-500">*</span></span>
                        <Input type="text" name="subjectName" placeholder="street name, event, ..." required/>
                    </Label>
                    <Label class="space-y-2">
                        <span>Explanation</span>
                        <Textarea rows="4" name="subjectExplanation"/>
                    </Label>
                    <Button type="submit" class="w-full" disabled={startedCreation}>
                        {#if startedCreation}
                            <Spinner class="me-3" size="4" color="white"/>
                            Creating subject...
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24" {...$$props}>
                                <path fill="currentColor"
                                      d="M5 19V5zm0 2q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v7.525q0 .425-.288.7T20 13.5t-.712-.288T19 12.5V5H5v14h6q.425 0 .713.288T12 20t-.288.713T11 21zm3-4q.425 0 .713-.288T9 16t-.288-.712T8 15t-.712.288T7 16t.288.713T8 17m0-4q.425 0 .713-.288T9 12t-.288-.712T8 11t-.712.288T7 12t.288.713T8 13m0-4q.425 0 .713-.288T9 8t-.288-.712T8 7t-.712.288T7 8t.288.713T8 9m8 4q.425 0 .713-.288T17 12t-.288-.712T16 11h-4q-.425 0-.712.288T11 12t.288.713T12 13zm0-4q.425 0 .713-.288T17 8t-.288-.712T16 7h-4q-.425 0-.712.288T11 8t.288.713T12 9zm-5 7q0 .425.288.713T12 17h.05q.425 0 .713-.288T13.05 16t-.288-.712T12.05 15H12q-.425 0-.712.288T11 16m6 4h-2q-.425 0-.712-.288T14 19t.288-.712T15 18h2v-2q0-.425.288-.712T18 15t.713.288T19 16v2h2q.425 0 .713.288T22 19t-.288.713T21 20h-2v2q0 .425-.288.713T18 23t-.712-.288T17 22z"/>
                            </svg>
                            &nbsp; Create Subject
                        {/if}
                    </Button>
                </form>
            </Modal>
        </div>
    {/if}


    <br>
    <Label class="pb-2 text-xl" for="multiple_files">2. Upload images for: <b class="text-2xl">{currentSubject ? currentSubject?.name : "No subject selected"}</b></Label>
    <Fileupload id="multiple_files" multiple bind:files/>
    <Listgroup class="mt-2">

        {#if !files || files.length === 0}
            <ListgroupItem>No files</ListgroupItem>
        {:else}
            {#each Array.from(files) as item, index}
                <ListgroupItem>
                    <div class="flex justify-between">
                        <span>{index + 1}. {item.name}</span>
                        <Button type="button" color="red" pill class="ml-4" on:click={() => removeFile(index)}>
                            DELETE
                        </Button>
                    </div>
                </ListgroupItem>
            {/each}
        {/if}
    </Listgroup>

    <br>
    <Label class="pb-2 text-xl" for="">3. Select the approximate coordinates for all the pictures (optional)</Label>
    {#if marker}
        <p><b>Selected Coordinate (WGS84)</b>: {marker.lngLat.lat}, {marker.lngLat.lng}</p>
    {:else}
        <p>No location is yet selected.</p>
    {/if}
    <br>
    <MapLibre
            center={[4.4295289921711, 51.312513921524356]}
            zoom={11}
            class="relative max-h-70 w-full sm:aspect-video sm:max-h-full"
            standardControls
            style={{
                version: 8,
                pitch: 52,
                sources: {},
                layers: [],
            }}>
        <MapEvents on:click={addMarker}/>
        {#if marker}
            <DefaultMarker lngLat={marker.lngLat}/>
        {/if}
        <RasterTileSource tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']} tileSize={256}>
            <RasterLayer paint={{}}/>
        </RasterTileSource>
    </MapLibre>

    <div class="flex justify-center mt-5">
        <Button on:click={handleUpload} type="button" color="green" pill class="" disabled="{!currentSubject || files===undefined || files.length === 0}">
            {#if uploading}
                <Spinner class="me-3" size="4" color="white"/>
                Uploading...
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" {...$$props}>
                    <path fill="currentColor"
                          d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
                </svg>
                &nbsp; Upload Images
            {/if}
        </Button>
    </div>
</div>