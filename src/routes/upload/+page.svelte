<script lang="ts">
    import {Fileupload, Label, Listgroup, ListgroupItem} from 'flowbite-svelte';
    import {onMount} from "svelte";
    import {showErrorToast, showSuccessToast} from "../../services/toaster-service";
    import {throwError} from "svelte-preprocess/dist/modules/errors";
    import {Subject} from "../../../firestore-types/interfaces";

    let files: FileList;
    let subjects: Subject[];
    const removeFile = (index: number) => {
        const newFiles = Array.from(files).filter((_, i) => i !== index);
        files = new DataTransfer().files;
        const dt = new DataTransfer();
        newFiles.forEach(file => dt.items.add(file));
        files = dt.files;
    };


    onMount(async () => {
        try {
            const response = await fetch(import.meta.env.VITE_BASE_URL_GF + 'http_retrieve_subjects');
            if (response.ok) {
                subjects = await response.json();
                console.log(subjects)
                
                showSuccessToast("Map successfully loaded", "Now you can explore the image archive of Kapellen and it's surroundings.")
            } else {
                throwError(response.statusText)
            }
        } catch (error) {
            showErrorToast("Map load failed", `It looks like something went wrong! Please contact the admins. ${error}`)
        }
    });
    
</script>

<h1 class="text-center text-4xl my-4">Upload zone</h1>

<div class="mx-4">
    <Label class="pb-2 text-xl" for="">Select subject</Label>

    <select name="" id="">
        {#if !subjects || subjects.length === 0}
            <ListgroupItem>No files</ListgroupItem>
        {:else}
            {#each subjects as subject, index}
                <option value="{subject.id}">
                    {subject.name}
                </option>
            {/each}
        {/if}
    </select>
    
    <Label class="pb-2 text-xl" for="multiple_files">Upload images for the current subject: </Label>
    <Fileupload id="multiple_files" multiple bind:files/>
    <Listgroup class="mt-2">

        {#if !files || files.length === 0}
            <ListgroupItem>No files</ListgroupItem>
        {:else}
            {#each Array.from(files) as item, index}
                <ListgroupItem>
                    <div class="flex justify-between">
                        <span>{index + 1}. {item.name}</span>
                        <button class="ml-4" on:click={() => removeFile(index)}>DELETE</button>
                    </div>
                </ListgroupItem>
            {/each}
        {/if}
    </Listgroup>
</div>