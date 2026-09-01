<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';

	import Seo from '../components/Seo.svelte';
	import { registerStreets } from '$lib/page-data';
	import { MAX_SUBMISSION_BYTES, ALLOWED_CONTENT_TYPES } from '../../../sharedModels/submission';

	/**
	 * Sending a photograph in.
	 *
	 * No account, no login, nothing to fill in but the picture itself. Everything else is
	 * optional, because the photographs worth having most often come from people who will
	 * not fill in a form - and a name, a year or a street is a bonus, not a toll.
	 *
	 * What a contributor knows is almost always about one photograph, not the batch: THIS
	 * one is the bakery, THAT one is from around 1950. So the title, year and description
	 * ask beside each picture, and only the name, email and a general remark are asked once.
	 *
	 * Nothing appears on the site until someone has looked at it, and the page says so
	 * plainly rather than implying the photograph is live.
	 *
	 * ## Three states, not one page with a banner on top
	 *
	 * It used to be one page: the form, with a green "bedankt" panel appearing above it on
	 * success. By the time you press send you are at the bottom of a page that is several
	 * screens long - the button is under the dropzone, the per-photograph fields and the
	 * three fields about you - so the confirmation appeared entirely off-screen, above
	 * everything, and the page looked as though nothing had happened. Somebody who has just
	 * handed over their grandmother's photographs deserves better than wondering whether it
	 * worked.
	 *
	 * So the page is a small state machine. `form` collects, `sending` covers the screen and
	 * says how far along the upload is, and `done` replaces the page entirely: no form left
	 * to scroll past, and the way back to the archive right there under the message.
	 */

	const FUNCTIONS_BASE = import.meta.env.VITE_BASE_URL_GF ?? '';

	interface Entry {
		file: File;
		title: string;
		year: string;
		description: string;
	}

	/** Which of the three screens the page is showing. */
	type Stage = 'form' | 'sending' | 'done';

	let entries: Entry[] = [];
	let name = '';
	let email = '';
	let note = '';

	/**
	 * Which street this submission is about, when the reader arrived from one.
	 *
	 * The 277 register streets have a page and no photographs, and their whole purpose is to
	 * ask. Somebody who says yes there should not have to type the street name again - and
	 * more importantly, the curator on the other end should not have to guess it. The slug
	 * is resolved against the register rather than de-slugified, so what is shown and sent
	 * is the register's own spelling.
	 */
	let aboutStreet: string | null = null;

	onMount(async () => {
		const slug = $page.url.searchParams.get('straat');
		if (!slug) return;

		const street = (await registerStreets(fetch)).find((entry) => entry.slug === slug);
		if (!street) return;

		aboutStreet = street.name;
		// Prefilled rather than sent invisibly: a contributor can see exactly what goes
		// along with their photographs, and delete it if they came for something else.
		if (!note.trim()) note = `Foto's van: ${street.name}.`;
	});

	let dragging = false;
	let stage: Stage = 'form';
	let sent = 0;
	let error: string | null = null;
	/** The error panel, so a failure is scrolled to rather than left above the fold. */
	let errorBox: HTMLElement | null = null;

	/**
	 * Bytes actually out of the browser, and how many there are in total.
	 *
	 * A submission can be three photographs of 20 MB over a phone connection, which is a
	 * long time to look at a spinner that could equally mean "stuck". Real numbers are only
	 * available from XMLHttpRequest - `fetch` reports nothing about an upload in progress -
	 * which is the whole reason the send below is not a `fetch`.
	 */
	let uploaded = 0;
	let total = 0;

	/**
	 * The last byte is sent and the server is still working.
	 *
	 * The bar reaching 100% does not mean the archive has the photographs: the function
	 * still has to store them. Leaving the bar full while nothing else changes reads as a
	 * hang, so this says what is happening instead.
	 */
	let processing = false;

	$: sending = stage === 'sending';
	$: percent = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;

	$: tooBig = entries.filter((entry) => entry.file.size > MAX_SUBMISSION_BYTES);
	$: wrongType = entries.filter((entry) => !ALLOWED_CONTENT_TYPES.includes(entry.file.type));
	$: sendable = entries.length > 0 && tooBig.length === 0 && wrongType.length === 0;

	const FIELD_CLASSES =
		'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 ' +
		'placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ' +
		'dark:placeholder-gray-500';

	function add(incoming: FileList | null): void {
		if (!incoming) return;
		error = null;
		entries = [
			...entries,
			...Array.from(incoming).map((file) => ({ file, title: '', year: '', description: '' }))
		];
	}

	function remove(index: number): void {
		entries = entries.filter((_, i) => i !== index);
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

	/** Moving the page under somebody is only ever right when they asked for it. */
	function scrollToTop(): void {
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
	}

	/**
	 * POSTs the submission, reporting how much of it has gone.
	 *
	 * XMLHttpRequest rather than `fetch`, purely for `upload.progress`: the fetch API has no
	 * equivalent, and on this page the thing being waited for is measured in tens of
	 * megabytes.
	 */
	function post(url: string, body: FormData): Promise<string> {
		return new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();
			request.open('POST', url);

			request.upload.addEventListener('progress', (event) => {
				if (!event.lengthComputable) return;
				uploaded = event.loaded;
				total = event.total;
				// The bar is full but the archive does not have them yet.
				processing = event.loaded >= event.total;
			});

			request.addEventListener('load', () => {
				if (request.status >= 200 && request.status < 300) resolve(request.responseText);
				else {
					reject(new Error(request.responseText || `Insturen is niet gelukt (${request.status}).`));
				}
			});

			// A network error gives no detail on purpose, for privacy reasons that are the
			// browser's rather than ours - so the message has to be about what to do next.
			request.addEventListener('error', () =>
				reject(new Error('Geen verbinding met het archief. Probeer het zo nog eens.'))
			);
			request.addEventListener('abort', () => reject(new Error('Het insturen is afgebroken.')));
			request.addEventListener('timeout', () =>
				reject(new Error('Het insturen duurde te lang. Probeer het zo nog eens.'))
			);

			request.send(body);
		});
	}

	async function send(): Promise<void> {
		if (!sendable || sending) return;

		stage = 'sending';
		error = null;
		uploaded = 0;
		total = entries.reduce((sum, entry) => sum + entry.file.size, 0);
		processing = false;

		try {
			const body = new FormData();

			// One suggestion per photograph, in the same order the files are appended: the
			// server pairs meta[i] with the i-th file. The field goes first so it is parsed
			// before the last file finishes.
			body.append(
				'meta',
				JSON.stringify(
					entries.map((entry) => ({
						title: entry.title,
						year: entry.year,
						description: entry.description
					}))
				)
			);
			for (const entry of entries) body.append('foto', entry.file, entry.file.name);

			const query = new URLSearchParams();
			if (name.trim()) query.set('name', name.trim());
			if (email.trim()) query.set('email', email.trim());
			if (note.trim()) query.set('note', note.trim());

			const answer = await post(`${FUNCTIONS_BASE}submitPhoto?${query}`, body);
			const result = JSON.parse(answer) as { accepted: number };

			sent = result.accepted;
			entries = [];
			note = '';
			stage = 'done';

			// The whole page has just been replaced, and the reader was at the bottom of a
			// form several screens long. Without this they are looking at empty space.
			await tick();
			scrollToTop();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			stage = 'form';

			// A failure has the same problem the confirmation had: it is drawn above a form
			// the reader has already scrolled past.
			await tick();
			errorBox?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} finally {
			processing = false;
		}
	}

	/** Back to an empty form, for somebody who has another album to go through. */
	async function startOver(): Promise<void> {
		stage = 'form';
		sent = 0;
		error = null;
		uploaded = 0;
		total = 0;

		await tick();
		scrollToTop();
	}
</script>

<Seo
	title="Foto insturen"
	description="Stuur uw oude foto's van Kapellen in. Iedereen kan meedoen, een account is niet nodig."
	path="/upload"
/>

{#if stage === 'sending'}
	<!--
		Over everything, because it is the only thing happening. `role="status"` with
		`aria-live` so a screen reader is told as much; the spinner is decorative and the
		percentage carries the same information for anybody who has turned motion off.
	-->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm"
		role="status"
		aria-live="polite"
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
			<div
				class="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-blue-800 motion-reduce:animate-none dark:border-gray-700 dark:border-t-blue-400"
				aria-hidden="true"
			/>

			<p class="mt-6 text-lg font-bold text-gray-900 dark:text-gray-100">
				{processing ? 'Bijna klaar ...' : 'Bezig met versturen ...'}
			</p>

			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{#if processing}
					De foto's zijn verstuurd. Het archief slaat ze nu op.
				{:else if total > 0}
					{readableSize(uploaded)} van {readableSize(total)} &middot; {percent}%
				{:else}
					Een ogenblik geduld.
				{/if}
			</p>

			<div
				class="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<div
					class="h-full rounded-full bg-blue-800 transition-all duration-300 dark:bg-blue-500"
					style="width: {processing ? 100 : percent}%"
				/>
			</div>

			<p class="mt-5 text-xs text-gray-500 dark:text-gray-400">
				Sluit deze pagina niet terwijl dit bezig is.
			</p>
		</div>
	</div>
{/if}

{#if stage === 'done'}
	<!--
		The whole page, not a panel on top of one. The form is gone: there is nothing left
		to fill in, and leaving it under the message invites somebody to send the same
		photographs twice. The way back to the archive is the first thing under the text,
		because that is what almost everybody wants next.
	-->
	<div class="mx-auto flex min-h-[75vh] max-w-2xl flex-col items-center justify-center px-4 py-16">
		<div
			class="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 sm:h-28 sm:w-28 dark:bg-green-900/40"
		>
			<svg
				class="h-12 w-12 text-green-700 sm:h-14 sm:w-14 dark:text-green-300"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M20 6 9 17l-5-5" />
			</svg>
		</div>

		<h1
			class="mt-8 text-center text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-100"
		>
			Bedankt!
		</h1>

		<p class="mt-4 text-center text-xl text-gray-800 sm:text-2xl dark:text-gray-200">
			{sent}
			{sent === 1 ? 'foto is' : "foto's zijn"} aangekomen bij het archief van Kapellen.
		</p>

		<p class="mt-5 max-w-lg text-center text-gray-600 dark:text-gray-400">
			Iemand van het archief bekijkt {sent === 1 ? 'ze' : 'ze'} en zet {sent === 1 ? 'ze' : 'ze'} daarna
			online. Dat kan een paar dagen duren. U hoeft verder niets te doen.
			{#if email.trim()}
				Is er iets onduidelijk, dan nemen we contact op via het adres dat u opgaf.
			{/if}
		</p>

		<div class="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
			<a
				class="rounded-lg bg-blue-800 px-8 py-3.5 text-center text-lg font-semibold text-white transition hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
				href="/"
			>
				Terug naar de startpagina
			</a>
			<button
				type="button"
				class="rounded-lg border border-gray-300 px-8 py-3.5 text-center text-lg font-semibold text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-blue-950"
				on:click={startOver}
			>
				Nog foto's insturen
			</button>
		</div>

		<p class="mt-10 text-center text-sm text-gray-600 dark:text-gray-400">
			Zin om te bladeren?
			<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/straten">
				Alle straten
			</a>
			&middot;
			<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/kastelen">
				de kastelen
			</a>
			&middot;
			<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/verhalen">
				de verhalen
			</a>
		</p>
	</div>
{:else}
	<div class="mx-auto max-w-3xl px-4 py-8">
		<nav class="text-sm text-gray-600 dark:text-gray-400">
			<a class="text-blue-800 dark:text-blue-300 underline hover:no-underline" href="/"
				>Startpagina</a
			>
			<span class="mx-2">/</span>
			<span>Foto insturen</span>
		</nav>

		<header class="mt-3">
			<h1
				class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl"
			>
				Stuur uw foto in
			</h1>
			<p class="mt-3 text-lg text-gray-600 dark:text-gray-400">
				Hebt u een oude foto van Kapellen &mdash; uw straat, uw school, het café op de hoek? Stuur
				ze in. U hoeft geen account te maken en u hoeft niets in te vullen behalve de foto zelf.
			</p>

			{#if aboutStreet}
				<p
					class="mt-4 inline-block rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-gray-800 dark:border-blue-900 dark:bg-blue-950 dark:text-gray-200"
				>
					Straat: {aboutStreet}
				</p>
			{/if}
		</header>

		{#if error}
			<div
				bind:this={errorBox}
				class="mt-6 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
			>
				<p class="font-semibold">Insturen is niet gelukt</p>
				<p class="mt-1 text-sm">{error}</p>
				<p class="mt-2 text-sm">
					Uw foto's en wat u erbij schreef staan er nog. U kunt het gerust nog eens proberen.
				</p>
			</div>
		{/if}

		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="mt-6 rounded-xl border-2 border-dashed p-8 text-center transition {dragging
				? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
				: 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}"
			on:dragover|preventDefault={() => (dragging = true)}
			on:dragleave={() => (dragging = false)}
			on:drop={onDrop}
		>
			<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">Sleep uw foto's hierheen</p>
			<p class="mt-1 text-gray-600 dark:text-gray-400">of</p>

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

			<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
				JPEG, PNG, GIF of WebP &middot; max {Math.round(MAX_SUBMISSION_BYTES / 1024 / 1024)} MB per foto
			</p>
		</div>

		{#if entries.length > 0}
			<div class="mt-8">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					Wat weet u over {entries.length === 1 ? 'deze foto' : "deze foto's"}?
				</h2>
				<p class="mt-1 text-gray-600 dark:text-gray-400">
					Alles mag u leeg laten &mdash; maar elke straat, elk jaartal en elke naam helpt het
					archief.
				</p>
			</div>

			<ul class="mt-4 space-y-4">
				{#each entries as entry, index (entry.file.name + index)}
					<li
						class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
					>
						<div class="flex items-start gap-4">
							<img
								src={preview(entry.file)}
								alt=""
								class="h-20 w-20 shrink-0 rounded object-cover"
								on:load={releasePreview}
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium text-gray-900 dark:text-gray-100">
									{entry.file.name}
								</p>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									{readableSize(entry.file.size)}
								</p>
								{#if entry.file.size > MAX_SUBMISSION_BYTES}
									<p class="text-sm font-medium text-red-700 dark:text-red-300">
										Te groot om in te sturen.
									</p>
								{:else if !ALLOWED_CONTENT_TYPES.includes(entry.file.type)}
									<p class="text-sm font-medium text-red-700 dark:text-red-300">
										Dit is geen foto.
									</p>
								{/if}
							</div>
							<button
								type="button"
								class="shrink-0 rounded px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
								on:click={() => remove(index)}
							>
								Verwijderen
							</button>
						</div>

						<div class="mt-3 grid gap-3 sm:grid-cols-3">
							<label class="block sm:col-span-2">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Titel</span>
								<input
									bind:value={entry.title}
									placeholder="bv. Dorpsstraat, bakkerij Peeters"
									class={FIELD_CLASSES}
								/>
							</label>
							<label class="block">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Jaartal</span>
								<input
									bind:value={entry.year}
									placeholder="bv. 1957, of 'rond 1950'"
									class={FIELD_CLASSES}
								/>
							</label>
						</div>
						<label class="mt-3 block">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Wat staat erop?
							</span>
							<textarea
								bind:value={entry.description}
								rows="2"
								placeholder="Welke straat, wie staat erop, wat gebeurt er ... alles helpt."
								class={FIELD_CLASSES}
							/>
						</label>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-8 space-y-4">
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Over u</h2>
			<p class="-mt-2 text-gray-600 dark:text-gray-400">Ook dit mag u leeg laten.</p>

			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Uw naam</span>
					<input
						bind:value={name}
						placeholder="Zo vermelden we u bij de foto"
						class={FIELD_CLASSES}
					/>
				</label>

				<label class="block">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">E-mail</span>
					<input
						bind:value={email}
						type="email"
						placeholder="Alleen om iets te kunnen vragen"
						class={FIELD_CLASSES}
					/>
					<span class="mt-1 block text-xs text-gray-600 dark:text-gray-400"
						>Komt niet op de website.</span
					>
				</label>
			</div>

			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Wilt u nog iets kwijt over deze inzending als geheel?
				</span>
				<textarea
					bind:value={note}
					rows="3"
					placeholder="bv. Alle foto's komen uit het album van mijn grootmoeder."
					class={FIELD_CLASSES}
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
			{:else if entries.length === 0}
				Kies eerst een foto
			{:else}
				Stuur {entries.length}
				{entries.length === 1 ? 'foto' : "foto's"} in
			{/if}
		</button>

		<p
			class="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-600 dark:text-gray-400"
		>
			Uw foto komt eerst bij het archief terecht en wordt pas op de website gezet nadat iemand ze
			bekeken heeft. Stuur alleen foto's in die u zelf mag delen.
		</p>
	</div>
{/if}
