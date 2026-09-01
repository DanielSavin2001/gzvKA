<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import type { Archive, ArchivePhoto } from '$lib/archive';
	import { detailUrl, loadArchive, photoAlt, sortForDisplay, thumbUrl } from '$lib/archive';
	import type { PhotoSummary } from '$lib/page-data';
	import { SITE, summarise } from '$lib/seo';
	import { slugify } from '../../../../sharedModels/text';
	import Seo from '../../components/Seo.svelte';
	import DatePhoto from '../../components/DatePhoto.svelte';
	import { swipe } from '$lib/gestures';
	import {
		download,
		extensionOf,
		keepsakeName,
		loadedSource,
		originalFormat,
		saveConverted,
		shareOrCopy
	} from '$lib/keepsake';
	import { showErrorToast, showSuccessToast } from '../../../services/toaster-service';
	import Lightbox from '../../components/Lightbox.svelte';
	import type { LightboxItem } from '../../components/Lightbox.svelte';
	import type { PhotoContext } from '$lib/stories';
	import { loadStory, loadStoryPhotos, photoContext } from '$lib/stories';

	export let data: { id: string; summary: PhotoSummary | null };

	let archive: Archive | null = null;
	let error: string | null = null;

	/** What the old website wrote about this photograph, when it wrote anything. */
	let context: PhotoContext | null = null;

	onMount(async () => {
		listKey = new URLSearchParams(window.location.search).get('lijst') ?? '';

		try {
			archive = await loadArchive();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// A photograph can be opened from another without the page remounting, so the story
	// follows the id rather than being fetched once on mount.
	$: loadStoryFor(data.id);

	async function loadStoryFor(id: string): Promise<void> {
		context = null;

		try {
			const map = await loadStoryPhotos();
			const reference = map[id];
			if (!reference) return;

			const story = await loadStory(reference.slug);
			// Guard against a slower fetch for a photograph the reader has already left.
			if (data.id !== id) return;

			context = photoContext(story, reference);
		} catch {
			// The photograph and its details are the page; the story is an extra.
			context = null;
		}
	}

	let photo: ArchivePhoto | undefined;
	$: photo = archive?.photoById.get(data.id);

	/**
	 * The head reads from `load`, not from the archive.
	 *
	 * `photo` comes out of the archive index, which the browser fetches - so at prerender
	 * time it is null and every one of the 4,504 pages would carry the same empty title and
	 * no share image, which is exactly what a link preview reads.
	 */
	$: headTitle = data.summary?.title ?? photo?.t ?? 'Foto';

	/**
	 * The link preview is a different picture from the one on the page.
	 *
	 * The page wants the photograph in its own shape and as few bytes as possible, so it
	 * paints the thumbnail. A preview wants a fixed 1200x630 - below that Facebook and
	 * WhatsApp draw a small card instead of the big one - and the thumbnail is 480 on its
	 * long edge, so sharing any photograph in this archive produced the small card.
	 */
	$: headImage = data.summary?.card ?? null;

	/**
	 * The sentence a search result shows.
	 *
	 * Built from what the archive actually knows rather than from a template with blanks,
	 * so a photograph with a street and a year reads differently from one with neither.
	 */
	$: photoDescription = data.summary
		? summarise(
				data.summary.description ||
					[
						data.summary.title,
						data.summary.place ? `in de ${data.summary.place}` : null,
						data.summary.year ? `(${data.summary.year})` : null,
						'- uit het fotoarchief van Kapellen.'
					]
						.filter(Boolean)
						.join(' ')
		  )
		: 'Een foto uit het fotoarchief van Kapellen.';

	/**
	 * A curator's own words about the photograph, when there are any.
	 *
	 * From `load` first so it is in the prerendered HTML - it is the only real prose on the
	 * page and the one thing here worth reading. The archive copy takes over once it has
	 * loaded, so a curator sees their own edit without waiting for a deploy.
	 */
	$: description =
		(photo as (typeof photo & { desc?: string }) | undefined)?.desc ??
		data.summary?.description ??
		'';

	$: places = photo
		? photo.st
				.map((id) => archive?.placeById.get(id))
				.filter((place): place is NonNullable<typeof place> => place !== undefined)
		: [];

	/**
	 * The photographs this one sits among, in the order the visitor last saw them.
	 *
	 * The list is named in the `lijst` query parameter that the card they clicked put there,
	 * so the arrows walk the same street page they came from rather than some other order.
	 * Arriving with no parameter - a shared link, a bookmark - falls back to the photograph's
	 * own street, which is the most useful list it belongs to.
	 */
	/**
	 * Read from `window` rather than the page store.
	 *
	 * This page is prerendered now, and SvelteKit refuses `url.searchParams` on a
	 * prerendered page - rightly, since the query string does not exist when the HTML is
	 * written. The list is a browsing convenience, so resolving it after the page is on
	 * screen is exactly right: the photograph renders from the URL alone, and the arrows
	 * pick up the thread a moment later.
	 */
	let listKey = '';

	$: siblings = ((): ArchivePhoto[] => {
		if (!archive || !photo) return [];

		const [kind, value] = listKey.includes(':') ? splitOnce(listKey, ':') : ['', ''];

		if (kind === 'straat') return sortForDisplay(archive.photosByPlace.get(value) ?? []);
		if (kind === 'onderwerp') {
			return sortForDisplay(archive.photos.filter((other) => other.s === value));
		}
		// Arriving from somebody's page walks what that person gave, in the order that page
		// showed it. Matched on the slug rather than the name, so the spelling variants the
		// corpus carries do not split one donor's photographs into two shorter walks.
		if (kind === 'schenker') {
			return sortForDisplay(archive.photos.filter((other) => slugify(other.d) === value));
		}
		// The timeline has linked photographs with `jaren:` since it was built, and nothing
		// here read it - so arriving from the sixties walked the photograph's street
		// instead, and the counter said "1 van 401" of a decade holding eighty-three.
		if (kind === 'jaren') {
			return archive.photos
				.filter((other) => decadeKeyOf(other.y) === value)
				.sort((a, b) => Number(a.y) - Number(b.y) || a.t.localeCompare(b.t));
		}

		const street = places.find((place) => place.isStreet) ?? places[0];
		return street ? sortForDisplay(archive.photosByPlace.get(street.id) ?? []) : [];
	})();

	$: position = photo ? siblings.findIndex((other) => other.id === photo?.id) : -1;
	$: previous = position > 0 ? siblings[position - 1] : null;
	$: next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null;

	/** Keeps the `lijst` parameter across a step, or the next arrow would lose the thread. */
	$: neighbourQuery = listKey ? `?lijst=${encodeURIComponent(listKey)}` : '';

	/**
	 * Which timeline band a year falls in - the same rule `decades()` bands by.
	 *
	 * Everything before 1900 is one band there, so it has to be one band here too, or the
	 * arrows would walk a decade the timeline never drew.
	 */
	function decadeKeyOf(year: string | undefined): string | null {
		if (!year || !/^\d{4}$/.test(year)) return null;
		const value = Number(year);
		return value < 1900 ? 'voor-1900' : String(Math.floor(value / 10) * 10);
	}

	/** What the band is called in a breadcrumb. */
	$: decadeLabel = ((): string | null => {
		const [kind, value] = listKey.includes(':') ? splitOnce(listKey, ':') : ['', ''];
		if (kind !== 'jaren') return null;
		return value === 'voor-1900' ? 'Voor 1900' : value;
	})();

	function splitOnce(value: string, separator: string): [string, string] {
		const at = value.indexOf(separator);
		return [value.slice(0, at), value.slice(at + separator.length)];
	}

	function step(to: ArchivePhoto | null): void {
		if (to) goto(`/foto/${to.id}${neighbourQuery}`);
	}

	/**
	 * The element showing the photograph, so saving it saves what is on screen.
	 *
	 * The deploy carries thumbnails only, so the page asks for the 1400 px copy and falls
	 * back when it is not there. Pointing a download at the larger copy would hand people a
	 * 404 on the live site while working perfectly in development.
	 */
	let shown: HTMLImageElement | null = null;

	/**
	 * The URL that actually loaded, tracked rather than read once.
	 *
	 * `bind:this` fires when the element is created, which is *before* the browser has
	 * finished trying the 1400 px file. Reading `currentSrc` at that moment gave the URL
	 * being attempted, and because the reference never changes afterwards, the reactive
	 * statement below never re-ran when the error handler swapped in the thumbnail.
	 *
	 * So on the live site, where the larger copy is absent, the save button pointed at a
	 * URL that 404s. Static hosting answers a missing path with the site's own HTML shell,
	 * so what people actually downloaded was a 2 KB copy of the page renamed `.webp` - a
	 * broken image, which is exactly what it looked like. It worked perfectly in
	 * development, where the larger copies do exist.
	 */
	let settledSource: string | null = null;

	function noteSource(event: Event): void {
		settledSource = loadedSource(event.currentTarget as HTMLImageElement);
	}

	$: keepsake = ((): { source: string; name: string; mime: string } | null => {
		if (!settledSource || !photo) return null;

		const format = originalFormat(photo.p);
		return {
			source: settledSource,
			name: keepsakeName(photo.t, photo.y, format.extension),
			mime: format.mime
		};
	})();

	let saving = false;
	/** Set when the archive could not produce the file, so the page says so out loud. */
	let saveFailed = false;

	/**
	 * Hands over the photograph in the format the archive holds it in.
	 *
	 * The page shows WebP because it is half the bytes; a file in somebody's downloads
	 * folder should be a JPEG, because that is what it was and because it opens anywhere.
	 * If the conversion cannot be done the file is handed over exactly as it loaded, which
	 * is worse than a JPEG and much better than nothing.
	 */
	async function keep(): Promise<void> {
		if (!keepsake || saving) return;

		saving = true;
		saveFailed = false;
		try {
			const outcome = await saveConverted(keepsake.source, keepsake.name, keepsake.mime);
			if (outcome === 'saved') return;

			// Only when the bytes really were a photograph. Falling back on `not-an-image`
			// would hand over whatever the server sent instead - which, when the file is
			// missing, is this page - and that is the bug the button had to begin with.
			if (outcome === 'unconvertible') {
				download(keepsake.source, keepsakeName(photo!.t, photo!.y, extensionOf(keepsake.source)));
				return;
			}

			saveFailed = true;
		} finally {
			saving = false;
		}
	}

	async function share(): Promise<void> {
		if (!photo) return;

		const outcome = await shareOrCopy({
			title: photo.t,
			text: `${photo.t} - uit het fotoarchief van Kapellen`,
			url: `${SITE}/foto/${data.id}`
		});

		if (outcome === 'copied') {
			showSuccessToast('Link gekopieerd', 'Plak hem waar u wil.');
		}
		if (outcome === 'failed') {
			showErrorToast('Kopiëren lukte niet', 'Kopieer het adres uit de adresbalk.');
		}
	}

	/**
	 * The photograph, full screen.
	 *
	 * The page shows it at whatever size is left over after the heading, the neighbours and
	 * the details - which on a phone is a postcard. These are scans of photographs people
	 * want to look *at*, so there has to be a way to fill the screen with one, and once it
	 * fills the screen the obvious way to reach the next is to swipe.
	 *
	 * The same `Lightbox` the stories use: it already handles the swipe, the pinch-zoom, the
	 * arrow keys, Escape, and preloading the neighbours so stepping through is instant. A
	 * second one written for this page would drift from it.
	 */
	let openAt = -1;

	/** The list the arrows walk, so full screen steps through exactly the same order. */
	$: lightboxItems = ((): LightboxItem[] => {
		if (siblings.length > 0) return siblings.map((item) => ({ photo: item }));
		return photo ? [{ photo }] : [];
	})();

	/** Where the open photograph sits in that list. */
	$: lightboxStart = position >= 0 ? position : 0;

	/**
	 * Closing leaves you on the photograph you ended on.
	 *
	 * Moving inside the lightbox is local, so a swipe is instant rather than a page load.
	 * That would strand somebody who swiped five photographs along and closed - the page
	 * behind would still be the one they opened - so the navigation happens once, here.
	 */
	function closeLightbox(): void {
		const landed = lightboxItems[openAt]?.photo;
		openAt = -1;
		if (landed && landed.id !== data.id) step(landed);
	}

	function onKey(event: KeyboardEvent): void {
		// Not while someone is typing in the search box in the header.
		const target = event.target as HTMLElement | null;
		if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

		if (event.key === 'ArrowLeft') step(previous);
		if (event.key === 'ArrowRight') step(next);
	}

	/**
	 * Fetches the neighbours' images now, so stepping through the archive is instant rather
	 * than a blank frame per photograph. The browser keeps them in its own cache, so the
	 * `<img>` the next page renders finds them already there.
	 */
	$: if (archive) {
		for (const neighbour of [previous, next]) {
			if (!neighbour) continue;
			const preload = new Image();
			preload.src = detailUrl(archive, neighbour);
		}
	}

	/**
	 * Deploys carry the thumbnails only, because both sizes together come to 443 MB and
	 * hosting keeps every version. When the larger file is not there, show the thumbnail
	 * rather than a broken image - the photograph is still the point.
	 */
	function fallBackToThumbnail(event: Event): void {
		const image = event.currentTarget as HTMLImageElement;
		if (!archive || !photo) return;

		const thumb = thumbUrl(archive, photo);
		if (image.src.endsWith(thumb)) return; // already the fallback; let it fail visibly

		image.src = thumb;
	}
</script>

<svelte:window on:keydown={onKey} />

{#if archive && lightboxItems.length > 0}
	<Lightbox
		{archive}
		items={lightboxItems}
		index={openAt}
		on:close={closeLightbox}
		on:move={(event) => (openAt = event.detail)}
	/>
{/if}

<!--
	A photograph is the thing people actually search for and the thing they share, so this
	is where the head tags earn their keep: without og:image a picture pasted into WhatsApp
	shows as a bare link, and WhatsApp does not run JavaScript to find one.
-->
<Seo
	title={headTitle}
	description={photoDescription}
	path="/foto/{data.id}"
	image={headImage}
	structured={data.summary
		? {
				'@context': 'https://schema.org',
				'@type': 'Photograph',
				name: data.summary.title,
				description: photoDescription,
				contentUrl: SITE + headImage,
				inLanguage: 'nl-BE',
				isPartOf: { '@type': 'Collection', name: 'gzvKA fotoarchief', url: SITE },
				...(data.summary.year ? { dateCreated: data.summary.year } : {}),
				...(data.summary.donor ? { creditText: data.summary.donor } : {}),
				...(data.summary.place
					? {
							contentLocation: {
								'@type': 'Place',
								name: data.summary.place,
								address: {
									'@type': 'PostalAddress',
									addressLocality: 'Kapellen',
									addressCountry: 'BE'
								}
							}
					  }
					: {})
		  }
		: null}
/>

<div class="mx-auto max-w-5xl px-4 py-8">
	{#if error}
		<div
			class="my-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">Het archief kon niet geladen worden</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !archive}
		<!--
			The photograph itself, from `load`, before the archive has arrived.

			This used to be the word "Bezig met laden ...", which is also all a search engine
			ever saw of a photo page - the head was right and the body said nothing. It is the
			better experience too: the picture is on screen immediately instead of after a
			700 KB index has downloaded and parsed. The neighbours, the story and the place
			links fill in a moment later.
		-->
		{#if data.summary}
			<figure class="mt-4">
				<div class="flex h-[58vh] items-center justify-center sm:h-[64vh] print:h-auto">
					<img
						src={data.summary.image}
						alt={data.summary.alt}
						{...{ fetchpriority: 'high' }}
						decoding="async"
						class="max-h-full max-w-full rounded-lg border border-gray-200 bg-gray-100 object-contain dark:border-gray-700 dark:bg-gray-800 print:max-h-none print:border-0"
					/>
				</div>
				<figcaption class="mt-4">
					<h1
						class="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100"
						data-url="{SITE}/foto/{data.id}"
					>
						{data.summary.title}
					</h1>
					<p class="mt-2 text-gray-700 dark:text-gray-300">{photoDescription}</p>
					{#if data.summary.place}
						<!--
							A link, not a label. These 4,504 pages are the largest thing on the site
							and they pointed nowhere a crawler could follow, so the street pages had
							almost no inbound links and the archive read as 4,504 dead ends.
						-->
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
							{#if data.summary.placeId}
								<a
									class="text-blue-800 underline hover:no-underline dark:text-blue-300"
									href="/straat/{data.summary.placeId}"
								>
									{data.summary.place}
								</a>
							{:else}
								{data.summary.place}
							{/if}{data.summary.year ? ` · ${data.summary.year}` : ''}
						</p>
					{/if}
				</figcaption>
			</figure>
		{:else}
			<p class="py-16 text-center text-gray-600 dark:text-gray-400">Bezig met laden ...</p>
		{/if}
	{:else if !photo}
		<div class="py-16 text-center">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Deze foto kennen we niet</h1>
			<a
				class="mt-2 inline-block text-blue-800 dark:text-blue-300 underline hover:no-underline"
				href="/"
			>
				Terug naar de startpagina
			</a>
		</div>
	{:else}
		<!--
			The trail follows the way in, not the photograph's street.
			
			Coming from the timeline and being offered "Startpagina / Hoogboom" is a dead end:
			the decade you were reading is nowhere on the page, and going back means finding
			the timeline again and scrolling to where you were. The `lijst` parameter already
			says where somebody came from - it is what the arrows walk - so the trail says it
			too.
		-->
		<nav class="text-sm text-gray-600 dark:text-gray-400 print:hidden">
			<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/"
				>Startpagina</a
			>
			{#if decadeLabel}
				<span class="mx-2">/</span>
				<a class="text-blue-800 underline hover:no-underline dark:text-blue-300" href="/tijdlijn"
					>Tijdlijn</a
				>
				<span class="mx-2">/</span>
				<a
					class="text-blue-800 underline hover:no-underline dark:text-blue-300"
					href="/tijdlijn#jaren-{decadeLabel === 'Voor 1900' ? 'voor-1900' : decadeLabel}"
				>
					{decadeLabel}
				</a>
			{:else}
				{#each places.filter((p) => p.isStreet).slice(0, 1) as street (street.id)}
					<span class="mx-2">/</span>
					<a
						class="text-blue-800 underline hover:no-underline dark:text-blue-300"
						href="/straat/{street.id}"
					>
						{street.name}
					</a>
				{/each}
			{/if}
		</nav>

		<figure class="mt-4">
			<!--
				The photograph, with its neighbours showing at the edges. Seeing a sliver of the
				next picture is what tells you there is one; an arrow on its own does not. The
				slivers are hidden below `lg`, where there is no room beside the photograph for
				anything but the arrows themselves.
			-->
			<!--
				The stage is a fixed height and the photograph is fitted inside it. Letting the
				box follow each picture's own proportions moved the arrows up to 177px between
				one photograph and the next - measured, and thoroughly annoying to click.
			-->
			<div
				class="relative flex h-[58vh] touch-pan-y select-none items-center justify-center gap-3 sm:h-[64vh] print:h-auto"
				use:swipe={{ onLeft: () => step(next), onRight: () => step(previous) }}
			>
				{#if previous}
					<a
						href="/foto/{previous.id}{neighbourQuery}"
						class="hidden h-40 w-24 shrink-0 lg:block xl:h-52 xl:w-32 print:lg:hidden"
						aria-label="Vorige foto: {previous.t}"
					>
						<img
							src={thumbUrl(archive, previous)}
							alt=""
							loading="lazy"
							decoding="async"
							draggable="false"
							class="h-full w-full select-none rounded-l-lg object-cover opacity-40 transition hover:opacity-80"
						/>
					</a>
				{:else}
					<div class="hidden h-40 w-24 shrink-0 lg:block xl:h-52 xl:w-32 print:lg:hidden" />
				{/if}

				<div class="relative flex h-full min-w-0 flex-1 items-center justify-center">
					<button
						type="button"
						class="group flex h-full max-h-full max-w-full items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
						aria-label="Bekijk {photo.t} op volledig scherm"
						on:click={() => (openAt = lightboxStart)}
					>
						<img
							bind:this={shown}
							src={detailUrl(archive, photo)}
							on:load={noteSource}
							on:error={fallBackToThumbnail}
							alt={photoAlt(archive, photo)}
							{...{ fetchpriority: 'high' }}
							draggable="false"
							class="max-h-full max-w-full cursor-zoom-in select-none rounded-lg border border-gray-200 bg-gray-100 object-contain dark:border-gray-700 dark:bg-gray-800 print:max-h-none print:border-0"
						/>
					</button>

					<!--
						A visible way in. `cursor-zoom-in` says "this opens" on a desktop and says
						nothing at all on a phone, which is where filling the screen matters most.
					-->
					<button
						type="button"
						class="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 print:hidden text-lg text-gray-900 shadow-md transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-gray-900/85 dark:text-gray-100 dark:hover:bg-gray-700"
						aria-label="Volledig scherm"
						title="Volledig scherm"
						on:click={() => (openAt = lightboxStart)}
					>
						&#9974;
					</button>

					{#if previous}
						<a
							href="/foto/{previous.id}{neighbourQuery}"
							class="print:hidden absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white dark:bg-gray-900/85 text-2xl text-gray-900 dark:text-gray-100 shadow-md transition hover:bg-white dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							aria-label="Vorige foto"
						>
							&#8592;
						</a>
					{/if}
					{#if next}
						<a
							href="/foto/{next.id}{neighbourQuery}"
							class="print:hidden absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white dark:bg-gray-900/85 text-2xl text-gray-900 dark:text-gray-100 shadow-md transition hover:bg-white dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
							aria-label="Volgende foto"
						>
							&#8594;
						</a>
					{/if}
				</div>

				{#if next}
					<a
						href="/foto/{next.id}{neighbourQuery}"
						class="hidden w-24 shrink-0 lg:block xl:w-32 print:lg:hidden"
						aria-label="Volgende foto: {next.t}"
					>
						<img
							src={thumbUrl(archive, next)}
							alt=""
							class="h-40 w-full rounded-r-lg object-cover opacity-40 transition hover:opacity-80 xl:h-52"
						/>
					</a>
				{:else}
					<div class="hidden w-24 shrink-0 lg:block xl:w-32 print:lg:hidden" />
				{/if}
			</div>

			{#if siblings.length > 1 && position >= 0}
				<p class="mt-3 text-center text-sm text-gray-600 dark:text-gray-400 print:hidden">
					Foto {position + 1} van {siblings.length}
					{#if listKey.startsWith('straat:') && archive.placeById.get(listKey.slice(7))}
						in de {archive.placeById.get(listKey.slice(7))?.name}
					{/if}
					<span class="ml-2 hidden lg:inline">&middot; gebruik &larr; en &rarr;</span>
					<span class="ml-2 lg:hidden">&middot; veeg om te bladeren</span>
				</p>
			{/if}

			<figcaption class="mt-4">
				<h1
					class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl"
					data-url="{SITE}/foto/{photo.id}"
				>
					{photo.t}
				</h1>

				<!--
					Take it with you, or send it to somebody.

					The two things a visitor most obviously wanted and could not do: somebody
					finds their grandparents' house and the only way to keep it was a long-press
					on a file called `... .jpg.thumb.webp`.
				-->
				<div class="mt-4 flex flex-wrap gap-2 print:hidden">
					{#if keepsake}
						<!--
							A button rather than a link: the file is re-encoded before it is handed
							over, and `<a download>` can only pass on the bytes as they came.
						-->
						<button
							type="button"
							class="inline-flex items-center gap-2 rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-blue-950"
							disabled={saving}
							on:click={keep}
						>
							&#8681; {saving ? 'Bezig ...' : 'Bewaren'}
						</button>
					{/if}

					{#if saveFailed}
						<p class="w-full text-sm font-semibold text-red-800 dark:text-red-300">
							Deze foto kon niet bewaard worden. Probeer het later opnieuw.
						</p>
					{/if}

					<button
						type="button"
						class="inline-flex items-center gap-2 rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-blue-950"
						on:click={share}
					>
						&#8631; Delen
					</button>

					<!--
						Nobody finds the print menu on a phone, and this heemkring prints: members
						bring photographs to the meeting and post them to a sister in Canada.
					-->
					<button
						type="button"
						class="inline-flex items-center gap-2 rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-blue-950"
						on:click={() => window.print()}
					>
						&#128424; Afdrukken
					</button>
				</div>

				{#if description}
					<!--
						The one thing no filename could ever carry, so nothing here ever had one
						until a curator wrote it. Above the table rather than inside it: it is
						prose, not a field.
					-->
					<p class="mt-3 whitespace-pre-line text-gray-700 dark:text-gray-300">{description}</p>
				{/if}

				<dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
					{#if places.length > 0}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Plaats</dt>
							<dd class="flex flex-wrap gap-2">
								{#each places as place (place.id)}
									<a
										class="text-blue-800 dark:text-blue-300 underline hover:no-underline"
										href="/straat/{place.id}"
									>
										{place.name}{#if place.isStreet && photo.hn}&nbsp;{photo.hn}{/if}
									</a>
								{/each}
							</dd>
						</div>
					{/if}
					<div class="flex gap-2">
						<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Onderwerp</dt>
						<dd class="text-gray-900 dark:text-gray-100">{photo.s}</dd>
					</div>
					{#if photo.y}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">Jaartal</dt>
							<dd class="text-gray-900 dark:text-gray-100">{photo.y}</dd>
						</div>
					{/if}
					{#if photo.d}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">
								Ingezonden door
							</dt>
							<!--
								A link, not a line of text. 298 people gave this archive its
								photographs and their names were the one thing on the page that
								went nowhere - searchable, but only if you already knew to search.
							-->
							<dd>
								<a
									class="text-blue-800 underline hover:no-underline dark:text-blue-300"
									href="/schenker/{slugify(photo.d)}">{photo.d}</a
								>
							</dd>
						</div>
					{/if}
					{#if photo.a}
						<div class="flex gap-2">
							<dt class="w-36 shrink-0 font-semibold text-gray-700 dark:text-gray-300">
								Ontvangen op
							</dt>
							<dd class="text-gray-900 dark:text-gray-100">{photo.a}</dd>
						</div>
					{/if}
				</dl>

				<p
					class="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400"
				>
					Deze gegevens zijn automatisch uit de bestandsnaam gehaald en zijn niet altijd volledig.
				</p>

				<!--
					This used to be the sentence "laat het ons weten" with nothing to press. The
					year is the field worth asking for: 3,896 photographs have none, so the
					timeline shows an eighth of the archive, and the only person who can fix that
					is the one looking at the picture.
				-->
				<DatePhoto
					photoId={data.id}
					photoTitle={data.summary?.title ?? photo?.t ?? ''}
					currentYear={photo?.y ?? data.summary?.year}
				/>
			</figcaption>
		</figure>

		{#if context}
			<section
				class="mt-10 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 p-5 sm:p-6"
			>
				<p class="text-sm font-semibold uppercase tracking-wide text-amber-800">
					Uit het archief van de oude website
				</p>

				{#if context.caption}
					<p class="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">{context.caption}</p>
				{/if}

				{#if context.prose.length > 0}
					{#each context.prose as paragraph, i (i)}
						<p class="mt-3 leading-relaxed text-gray-800 dark:text-gray-200">{paragraph}</p>
					{/each}
				{:else}
					<p class="mt-2 text-gray-700 dark:text-gray-300">
						Deze foto stond op de pagina
						<strong>{context.story.title}</strong>{#if context.section.heading}, onder het kopje
							<strong>{context.section.heading}</strong>{/if}. Er stond geen tekst bij deze foto
						zelf.
					</p>
				{/if}

				<a
					class="mt-5 inline-block rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 print:hidden"
					href="/verhaal/{context.story.slug}#deel-{context.sectionIndex}"
				>
					Lees &ldquo;{context.story.title}&rdquo;
				</a>
			</section>
		{/if}
	{/if}
</div>
