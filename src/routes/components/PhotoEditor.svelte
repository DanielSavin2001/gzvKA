<script lang="ts">
	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { thumbUrl } from '$lib/archive';
	import type { PhotoEdit, PhotoFields } from '$lib/photo-edits';
	import DonorPicker from './DonorPicker.svelte';
	import PlaceChooser from './PlaceChooser.svelte';
	import { revertPhotoEdit, savePhotoEdit } from '$lib/admin';

	/**
	 * Correcting one photograph that is already in the archive.
	 *
	 * Everything the archive knows about its photographs was read out of a filename, and a
	 * filename cannot hold a description, often gets the street wrong, and never knows the
	 * year. This is where a person fixes that.
	 *
	 * Only changed fields are sent. An edit is a patch over the generated index, so leaving
	 * a box alone is different from clearing it - and clearing one is how a wrong guess gets
	 * removed rather than replaced.
	 */

	export let archive: Archive;
	export let photo: ArchivePhoto;
	/** The edit already stored for this photograph, if there is one. */
	export let existing: PhotoEdit | undefined = undefined;

	let saving = false;
	let saved = false;
	let error: string | null = null;

	let title = photo.t ?? '';
	let subject = photo.s ?? '';
	let places = [...(photo.st ?? [])];
	let houseNumber: number | string = photo.hn ?? '';
	let year = photo.y ?? '';
	let donor = photo.d ?? '';
	let description = (photo as ArchivePhoto & { desc?: string }).desc ?? '';

	/**
	 * What actually changed.
	 *
	 * `null` means "clear this", which the server tells apart from an omitted field. Sending
	 * everything every time would work but would freeze the untouched fields at today's
	 * values, so a later re-index could never improve them.
	 */
	function changes(): PhotoFields {
		const fields: Record<string, unknown> = {};
		const was = (value: string | number | undefined) => (value == null ? '' : String(value));

		if (title.trim() !== was(photo.t)) fields.title = title.trim() || null;
		if (subject.trim() !== was(photo.s)) fields.subject = subject.trim() || null;
		if (donor.trim() !== was(photo.d)) fields.donor = donor.trim() || null;
		if (year.trim() !== was(photo.y)) fields.year = year.trim() || null;
		if (description.trim() !== was((photo as ArchivePhoto & { desc?: string }).desc)) {
			fields.description = description.trim() || null;
		}

		if (String(houseNumber) !== was(photo.hn)) {
			fields.houseNumber = String(houseNumber).trim() === '' ? null : Number(houseNumber);
		}

		const before = [...(photo.st ?? [])].join('|');
		if (places.join('|') !== before) fields.places = places;

		return fields as PhotoFields;
	}

	$: pending = Object.keys(changes()).length;

	async function save(): Promise<void> {
		if (saving || pending === 0) return;

		saving = true;
		error = null;

		try {
			existing = await savePhotoEdit(photo.id, changes());
			saved = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	async function revert(): Promise<void> {
		saving = true;
		error = null;

		try {
			await revertPhotoEdit(photo.id);
			existing = undefined;
			saved = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<div class="lg:flex lg:gap-6">
	<div class="lg:w-72 lg:shrink-0">
		<img
			src={thumbUrl(archive, photo)}
			alt={photo.t}
			class="w-full rounded-lg border border-gray-200 bg-gray-100 object-contain dark:border-gray-700 dark:bg-gray-800"
		/>
		<p class="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">{photo.p}</p>

		{#if existing}
			<p
				class="mt-2 rounded bg-amber-50 p-2 text-xs text-gray-800 dark:bg-amber-950 dark:text-gray-200"
			>
				Aangepast door {existing.editedBy} op
				{new Date(existing.editedAt).toLocaleDateString('nl-BE')}
			</p>
		{/if}

		<a
			class="mt-2 inline-block text-sm text-blue-800 underline hover:no-underline dark:text-blue-300"
			href="/foto/{photo.id}"
			target="_blank"
			rel="noreferrer">Bekijk op de site &rarr;</a
		>
	</div>

	<div class="mt-4 min-w-0 flex-1 lg:mt-0">
		<label class="block">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Titel</span>
			<input
				bind:value={title}
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
			/>
		</label>

		<label class="mt-3 block">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Categorie <span class="font-normal text-gray-500 dark:text-gray-400">(map)</span>
			</span>
			<input
				bind:value={subject}
				list="beheer-categorieen"
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
			/>
		</label>

		<label class="mt-3 block">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Beschrijving</span>
			<textarea
				bind:value={description}
				rows="3"
				placeholder="Wat is hier te zien? Dit staat in geen enkele bestandsnaam."
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
			/>
		</label>

		<div class="mt-3 grid gap-3 sm:grid-cols-3">
			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Huisnummer</span>
				<input
					type="number"
					bind:value={houseNumber}
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>
			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Jaartal</span>
				<input
					bind:value={year}
					placeholder="1935"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
				/>
			</label>
			<DonorPicker bind:value={donor} {archive} />
		</div>

		<div class="mt-3">
			<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Plaats
				{#if places.length > 0}
					<span class="font-normal text-gray-500 dark:text-gray-400">
						({places.length} gekozen)
					</span>
				{/if}
			</p>

			<PlaceChooser bind:chosen={places} {archive} label="" on:created />
		</div>

		{#if error}
			<p
				class="mt-3 rounded bg-red-50 p-2 text-sm font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
			>
				{error}
			</p>
		{/if}

		{#if saved && pending === 0}
			<p class="mt-3 text-sm font-medium text-green-800 dark:text-green-300">
				Opgeslagen. Dit is meteen zichtbaar op de site.
			</p>
		{/if}

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-400"
				disabled={saving || pending === 0}
				on:click={save}
			>
				{saving
					? 'Bezig ...'
					: pending === 0
					? 'Niets gewijzigd'
					: `Bewaar ${pending} wijziging${pending === 1 ? '' : 'en'}`}
			</button>

			{#if existing}
				<button
					type="button"
					class="rounded-lg border border-gray-400 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
					disabled={saving}
					on:click={revert}
					title="Zet deze foto terug naar wat de bestandsnaam zegt"
				>
					Terugzetten
				</button>
			{/if}
		</div>
	</div>
</div>
