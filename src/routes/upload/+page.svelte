<script lang="ts">
	import { MAX_SUBMISSION_BYTES, ALLOWED_CONTENT_TYPES } from '../../../sharedModels/submission';

	/**
	 * Sending a photograph in.
	 *
	 * No account, no login, nothing to fill in but the picture itself. Everything else is
	 * optional, because the photographs worth having most often come from people who will
	 * not fill in a form - and a name, a year or a street is a bonus, not a toll.
	 *
	 * Nothing appears on the site until someone has looked at it, and the page says so
	 * plainly rather than implying the photograph is live.
	 */

	const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

	let files: File[] = [];
	let name = '';
	let email = '';
	let note = '';

	let dragging = false;
	let sending = false;
	let sent = 0;
	let error: string | null = null;

	$: tooBig = files.filter((file) => file.size > MAX_SUBMISSION_BYTES);
	$: wrongType = files.filter((file) => !ALLOWED_CONTENT_TYPES.includes(file.type));
	$: sendable = files.length > 0 && tooBig.length === 0 && wrongType.length === 0;

	function add(incoming: FileList | null): void {
		if (!incoming) return;
		error = null;
		sent = 0;
		files = [...files, ...Array.from(incoming)];
	}

	function remove(index: number): void {
		files = files.filter((_, i) => i !== index);
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		dragging = false;
		add(event.dataTransfer?.files ?? null);
	}

	function readableSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
	}

	/** A thumbnail straight from the file, so a contributor sees what they picked. */
	function preview(file: File): string {
		return URL.createObjectURL(file);
	}

	/** Releases the object URL once the browser has the picture; otherwise they accumulate. */
	function releasePreview(event: Event): void {
		const image = event.currentTarget as HTMLImageElement;
		URL.revokeObjectURL(image.src);
	}

	async function send(): Promise<void> {
		if (!sendable || sending) return;

		sending = true;
		error = null;

		try {
			const body = new FormData();
			for (const file of files) body.append('foto', file, file.name);

			const query = new URLSearchParams();
			if (name.trim()) query.set('name', name.trim());
			if (email.trim()) query.set('email', email.trim());
			if (note.trim()) query.set('note', note.trim());

			const response = await fetch(`${FUNCTIONS_BASE}submitPhoto?${query}`, {
				method: 'POST',
				body
			});

			if (!response.ok) throw new Error((await response.text()) || 'Insturen is niet gelukt.');

			const result = (await response.json()) as { accepted: number };
			sent = result.accepted;
			files = [];
			note = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>Foto insturen | gzvKA fotoarchief</title>
	<meta
		name="description"
		content="Stuur uw oude foto's van Kapellen in. Iedereen kan meedoen, een account is niet nodig."
	/>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<nav class="text-sm text-gray-600">
		<a class="text-blue-800 underline hover:no-underline" href="/">Startpagina</a>
		<span class="mx-2">/</span>
		<span>Foto insturen</span>
	</nav>

	<header class="mt-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
			Stuur uw foto in
		</h1>
		<p class="mt-3 text-lg text-gray-600">
			Hebt u een oude foto van Kapellen &mdash; uw straat, uw school, het café op de hoek? Stuur ze
			in. U hoeft geen account te maken en u hoeft niets in te vullen behalve de foto zelf.
		</p>
	</header>

	{#if sent > 0}
		<div class="mt-6 rounded-xl border border-green-300 bg-green-50 p-5">
			<p class="text-lg font-bold text-green-900">
				Bedankt &mdash; {sent}
				{sent === 1 ? 'foto is' : "foto's zijn"} ontvangen.
			</p>
			<p class="mt-1 text-green-900">
				Iemand van het archief bekijkt ze en zet ze dan online. Dat kan een paar dagen duren.
			</p>
		</div>
	{/if}

	{#if error}
		<div class="mt-6 rounded-xl border border-red-300 bg-red-50 p-5 text-red-900">
			<p class="font-semibold">Insturen is niet gelukt</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{/if}

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="mt-6 rounded-xl border-2 border-dashed p-8 text-center transition {dragging
			? 'border-blue-600 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
		on:dragover|preventDefault={() => (dragging = true)}
		on:dragleave={() => (dragging = false)}
		on:drop={onDrop}
	>
		<p class="text-lg font-semibold text-gray-900">Sleep uw foto's hierheen</p>
		<p class="mt-1 text-gray-600">of</p>

		<label
			class="mt-3 inline-block cursor-pointer rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900"
		>
			Kies foto's
			<input
				type="file"
				accept={ALLOWED_CONTENT_TYPES.join(',')}
				multiple
				class="sr-only"
				on:change={(event) => add(event.currentTarget.files)}
			/>
		</label>

		<p class="mt-3 text-sm text-gray-500">
			JPEG, PNG, GIF of WebP &middot; max {Math.round(MAX_SUBMISSION_BYTES / 1024 / 1024)} MB per foto
		</p>
	</div>

	{#if files.length > 0}
		<ul class="mt-6 space-y-3">
			{#each files as file, index (file.name + index)}
				<li class="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
					<img
						src={preview(file)}
						alt=""
						class="h-16 w-16 shrink-0 rounded object-cover"
						on:load={releasePreview}
					/>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium text-gray-900">{file.name}</p>
						<p class="text-sm text-gray-500">{readableSize(file.size)}</p>
						{#if file.size > MAX_SUBMISSION_BYTES}
							<p class="text-sm font-medium text-red-700">Te groot om in te sturen.</p>
						{:else if !ALLOWED_CONTENT_TYPES.includes(file.type)}
							<p class="text-sm font-medium text-red-700">Dit is geen foto.</p>
						{/if}
					</div>
					<button
						type="button"
						class="shrink-0 rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
						on:click={() => remove(index)}
					>
						Verwijderen
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-8 space-y-4">
		<h2 class="text-xl font-bold text-gray-900">Wilt u er iets bij vertellen?</h2>
		<p class="-mt-2 text-gray-600">Alles hieronder mag u leeg laten.</p>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-sm font-medium text-gray-700">Uw naam</span>
				<input
					bind:value={name}
					placeholder="Zo vermelden we u bij de foto"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
				/>
			</label>

			<label class="block">
				<span class="text-sm font-medium text-gray-700">E-mail</span>
				<input
					bind:value={email}
					type="email"
					placeholder="Alleen om iets te kunnen vragen"
					class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
				/>
				<span class="mt-1 block text-xs text-gray-500">Komt niet op de website.</span>
			</label>
		</div>

		<label class="block">
			<span class="text-sm font-medium text-gray-700">Wat staat erop?</span>
			<textarea
				bind:value={note}
				rows="4"
				placeholder="Welke straat, welk jaar, wie staat erop ... alles helpt."
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
			/>
		</label>
	</div>

	<button
		type="button"
		class="mt-6 w-full rounded-lg bg-blue-800 px-6 py-3 text-lg font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-400"
		disabled={!sendable || sending}
		on:click={send}
	>
		{#if sending}
			Bezig met versturen ...
		{:else if files.length === 0}
			Kies eerst een foto
		{:else}
			Stuur {files.length}
			{files.length === 1 ? 'foto' : "foto's"} in
		{/if}
	</button>

	<p class="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
		Uw foto komt eerst bij het archief terecht en wordt pas op de website gezet nadat iemand ze
		bekeken heeft. Stuur alleen foto's in die u zelf mag delen.
	</p>
</div>
