<script lang="ts">
	import Seo from '../components/Seo.svelte';
	import { onMount } from 'svelte';

	import type { Archive } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import type { Curator, Decision, QueuedSubmission } from '$lib/admin';
	import {
		corrections,
		isConfigured,
		judgeCorrection,
		queue,
		removePlacePin,
		review,
		savePlacePin,
		signIn,
		signOut,
		watchSignIn,
		whoAmI
	} from '$lib/admin';
	import type { PlaceCorrection } from '../../../sharedModels/correction';
	import type { ArchivePhoto, ArchivePlace } from '$lib/archive';
	import { searchPhotos, thumbUrl } from '$lib/archive';
	import type { PhotoEdit } from '$lib/photo-edits';
	import { forgetPhotoEdits, loadPhotoEdits } from '$lib/photo-edits';
	import { forgetPublished } from '$lib/published';
	import type { CoordinateSource, PlacedCoordinate, StreetGeometry } from '$lib/coordinates';
	import {
		forgetCoordinates,
		loadCommittedPlaces,
		loadStreetGeometry,
		locate
	} from '$lib/coordinates';
	import { isPersonKind } from '../../../sharedModels/place-family';
	import type { Approximation } from '$lib/approximations';
	import { loadApproximations } from '$lib/approximations';
	import type { PlacePin } from '$lib/place-pins';
	import { forgetPlacePins, loadPlacePins } from '$lib/place-pins';
	import { normalizeText } from '../../../sharedModels/text';
	import PhotoEditor from '../components/PhotoEditor.svelte';
	import DatingDesk from '../components/DatingDesk.svelte';
	import PinPicker from '../components/PinPicker.svelte';

	/**
	 * The curator's desk.
	 *
	 * Everything an approved photograph needs that a filename cannot give it - a title, the
	 * street it belongs to, a house number, a year, who gave it - is set here by a person,
	 * one photograph at a time. Approving publishes it immediately; the archive's own record
	 * catches up later.
	 *
	 * The page shows nothing until the server has confirmed the account curates this archive.
	 * That check is the server's, not this page's: hiding a button protects nobody.
	 */

	let archive: Archive | null = null;
	let curator: Curator | null = null;
	let signedInAs: string | null = null;
	let checking = true;
	let error: string | null = null;

	let showing: 'pending' | 'approved' | 'rejected' = 'pending';

	/**
	 * Which desk the curator is at.
	 *
	 * `archief` is the one that was missing: the queue only ever handled photographs coming
	 * *in*, and the 4,504 already here - every field of them read out of a filename - had no
	 * way to be corrected at all.
	 */
	let desk: 'fotos' | 'archief' | 'correcties' | 'jaartallen' = 'fotos';
	let reports: PlaceCorrection[] = [];
	let reportBusy: string | null = null;

	/**
	 * The positioning workbench: every place the archive knows, its current position and
	 * where that position came from, and a picker to set a better one. This is what makes
	 * "24 places wait for somebody who knows better" an afternoon instead of a year: a pin
	 * saved here is live for the next visitor, no file download, no commit, no deploy.
	 */
	let placeQuery = '';
	let placesReady = false;
	let pins: Record<string, PlacePin> = {};
	let allCoordinates: Record<string, PlacedCoordinate> = {};
	let streetGeometry: Record<string, StreetGeometry> = {};
	let approximations: Record<string, Approximation> = {};
	let picking: ArchivePlace | null = null;
	let pinBusy = false;

	async function loadPlacesData(): Promise<void> {
		// Fresh rather than from any cache - the module's or the browser's - so a curator
		// sees their own last pin rather than the answer of up to a minute ago.
		forgetPlacePins();
		forgetCoordinates();
		const [committed, geometry, research, livePins] = await Promise.all([
			loadCommittedPlaces(),
			loadStreetGeometry(),
			loadApproximations(),
			loadPlacePins(fetch, { fresh: true })
		]);
		pins = livePins ?? {};
		allCoordinates = { ...(committed ?? {}), ...pins };
		streetGeometry = geometry;
		approximations = research;
		placesReady = true;
	}

	interface PlaceRow {
		place: ArchivePlace;
		located: { lat: number; lng: number; source: CoordinateSource } | null;
		hasPin: boolean;
		radius?: number;
	}

	/** Unlocated first, then the busiest: the same order the old placing queue used. */
	$: placeRows = ((): PlaceRow[] => {
		if (!archive || !placesReady) return [];
		const query = normalizeText(placeQuery);

		return archive.places
			.filter((place) => !isPersonKind(place))
			.filter((place) => query === '' || normalizeText(place.name).includes(query))
			.map((place) => ({
				place,
				located: locate(place.id, allCoordinates, streetGeometry, approximations),
				hasPin: place.id in pins,
				radius: approximations[place.id]?.radius
			}))
			.sort(
				(a, b) =>
					Number(a.located !== null) - Number(b.located !== null) ||
					b.place.count - a.place.count
			);
	})();

	$: correctableCount = Object.values(approximations).filter((entry) => entry.correctable).length;

	function sourceLabel(row: PlaceRow): string {
		if (row.located === null) return 'Niet geplaatst';
		if (row.hasPin) return 'Vastgelegd via beheer';
		if (row.located.source === 'placed') return 'Vastgelegd';
		if (row.located.source === 'register') return 'Stratenregister';
		return row.radius ? `Onderzoek, ± ${row.radius} m` : 'Onderzoek';
	}

	async function savePin(place: ArchivePlace, spot: { lat: number; lng: number }): Promise<void> {
		pinBusy = true;
		try {
			const saved = await savePlacePin(place.id, spot.lat, spot.lng);
			pins = { ...pins, [place.id]: saved.pin };
			allCoordinates = { ...allCoordinates, [place.id]: saved.pin };
			// The public map caches; forget so a curator checking their work sees the pin.
			forgetPlacePins();
			forgetCoordinates();
			picking = null;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			pinBusy = false;
		}
	}

	async function dropPin(place: ArchivePlace): Promise<void> {
		pinBusy = true;
		try {
			await removePlacePin(place.id);
			picking = null;
			error = null;
			// The committed file may still hold an older coordinate; rebuild from scratch
			// rather than guessing what the place falls back to.
			await loadPlacesData();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			pinBusy = false;
		}
	}

	/**
	 * One click for the common case: the visitor pointed at the right spot, so accepting
	 * the report and placing the pin are the same decision.
	 *
	 * The pin goes first. If accepting then failed, a retry simply re-saves the same pin
	 * and accepts; the other way round, a failed pin save would leave the report accepted,
	 * every retry refused as "al accepted", and the visitor's coordinate silently dropped.
	 */
	async function acceptWithPin(report: PlaceCorrection): Promise<void> {
		if (report.lat == null || report.lng == null) return;
		reportBusy = report.id;
		try {
			const saved = await savePlacePin(report.placeId, report.lat, report.lng);
			await judgeCorrection({ id: report.id, status: 'accepted' });
			pins = { ...pins, [report.placeId]: saved.pin };
			allCoordinates = { ...allCoordinates, [report.placeId]: saved.pin };
			forgetPlacePins();
			forgetCoordinates();
			reports = reports.filter((other) => other.id !== report.id);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			reportBusy = null;
		}
	}

	/**
	 * The merged coordinates as a committable file, so the repository stays the durable
	 * record: pins live in Firestore, and this is the way they come home.
	 */
	function exportCoordinates(): void {
		const payload = {
			_comment:
				'Hand-placed coordinates for places the street register cannot know. Exported from ' +
				'/beheer, where the live pins are placed; committing this file makes them durable.',
			_format: '{ "<gazetteer-id>": { "lat": 51.3, "lng": 4.4, "by": "who", "on": "YYYY-MM-DD" } }',
			places: allCoordinates
		};

		const blob = new Blob([JSON.stringify(payload, null, '\t') + '\n'], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'place-coordinates.json';
		// In the document, and the URL revoked only after the click has been handled: some
		// browsers resolve a blob URL asynchronously, and a synchronous revoke on a detached
		// anchor can silently abort the download.
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	/** Finding a photograph among 4,504 of them. */
	let photoQuery = '';
	let openPhoto: ArchivePhoto | null = null;
	let photoEdits: Record<string, PhotoEdit> = {};

	$: photoHits =
		archive && photoQuery.trim().length >= 2 ? searchPhotos(archive, photoQuery).slice(0, 60) : [];

	async function openArchiveDesk(): Promise<void> {
		desk = 'archief';
		openPhoto = null;
		error = null;
		await refreshEdits();
	}

	/**
	 * The dating desk wants the same overlay the archive desk does, for the same reason: a
	 * year saved on top of a corrected title must not erase the title.
	 */
	async function openDatingDesk(): Promise<void> {
		desk = 'jaartallen';
		error = null;
		await refreshEdits();
	}

	async function refreshEdits(): Promise<void> {
		// Fetched fresh rather than from the cache the site holds, so a curator sees their
		// own last edit rather than whatever was loaded when the page opened.
		forgetPhotoEdits();
		try {
			photoEdits = await loadPhotoEdits();
		} catch {
			photoEdits = {};
		}
	}

	const tabs: ['pending' | 'approved' | 'rejected', string][] = [
		['pending', 'Te bekijken'],
		['approved', 'Goedgekeurd'],
		['rejected', 'Afgewezen']
	];
	let items: QueuedSubmission[] = [];
	let loading = false;

	/** Edits in progress, keyed by submission id, so a half-filled form is not lost. */
	let edits: Record<string, Decision> = {};
	let busy: string | null = null;

	onMount(async () => {
		if (!isConfigured()) {
			error =
				'Firebase is niet ingesteld in deze build. Zet de VITE_FIREBASE_* waarden in .env - zie .env.example.';
			checking = false;
			return;
		}

		try {
			await watchSignIn(async (email) => {
				signedInAs = email;
				curator = null;

				if (!email) {
					checking = false;
					return;
				}

				checking = true;
				try {
					curator = await whoAmI();
					error = null;
					await refresh();
				} catch (e) {
					// A signed-in account that is not on the list: say so plainly rather than
					// showing an empty page that looks broken.
					error = e instanceof Error ? e.message : String(e);
				} finally {
					checking = false;
				}
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			checking = false;
		}

		try {
			archive = await loadArchive();
		} catch {
			// The queue works without it; only the street picker needs the archive.
		}
	});

	async function refresh(): Promise<void> {
		loading = true;
		try {
			if (desk === 'correcties') {
				reports = await corrections(
					showing === 'approved' ? 'accepted' : showing === 'rejected' ? 'rejected' : 'pending'
				);
			} else {
				items = await queue(showing);
			}
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function judge(
		report: PlaceCorrection,
		status: 'accepted' | 'rejected' | 'pending'
	): Promise<void> {
		reportBusy = report.id;
		try {
			let reason: string | undefined;

			if (status === 'rejected') {
				const typed = window.prompt('Waarom wordt deze melding afgewezen?') ?? '';
				if (!typed.trim()) {
					reportBusy = null;
					return;
				}
				reason = typed.trim();
			}

			await judgeCorrection({ id: report.id, status, rejectionReason: reason });
			reports = reports.filter((other) => other.id !== report.id);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			reportBusy = null;
		}
	}

	/** What the person is actually claiming, in one line a curator can act on. */
	function claim(report: PlaceCorrection): string {
		if (report.kind === 'not-a-place') return 'Dit is geen plaats';
		if (report.kind === 'still-unknown') return 'Geen van de mogelijkheden';
		if (report.kind === 'candidate') return `Het is: ${report.candidateLabel}`;
		return `Hier: ${report.lat?.toFixed(5)}, ${report.lng?.toFixed(5)}`;
	}

	function editsFor(item: QueuedSubmission): Decision {
		if (!edits[item.id]) {
			// The contributor's suggestion prefills the form, so publishing it is one look and
			// one click rather than retyping - but it only reaches the site through these
			// fields, after a curator has seen it. A suggested year prefills only when it is
			// already a real year ("1957" or "1957-1958"): the server refuses anything else,
			// and silently losing "rond 1950" on approve is worse than showing it as a quote.
			const suggestedYear = /^\d{4}(-\d{4})?$/.test(item.suggestion?.year ?? '')
				? item.suggestion?.year
				: undefined;
			edits[item.id] = {
				id: item.id,
				status: 'approved',
				title: item.title ?? item.suggestion?.title ?? item.originalName.replace(/\.[^.]+$/, ''),
				places: item.places ?? [],
				...(item.houseNumber != null ? { houseNumber: item.houseNumber } : {}),
				...(item.year ? { year: item.year } : suggestedYear ? { year: suggestedYear } : {}),
				donor: item.donor ?? item.contributor.name ?? '',
				description: item.description ?? item.suggestion?.description ?? ''
			};
		}
		return edits[item.id];
	}

	async function decide(item: QueuedSubmission, status: Decision['status']): Promise<void> {
		busy = item.id;
		try {
			const decision: Decision = { ...editsFor(item), status };

			if (status === 'rejected') {
				const reason = window.prompt('Waarom wordt deze foto afgewezen?') ?? '';
				if (!reason.trim()) {
					busy = null;
					return;
				}
				decision.rejectionReason = reason.trim();
			}

			await review(decision);
			// The site merges the approved photographs into the archive; forget what was
			// fetched so a curator who opens the site next sees the one they just approved.
			forgetPublished();
			delete edits[item.id];
			edits = edits;
			items = items.filter((other) => other.id !== item.id);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = null;
		}
	}

	/** Places a curator can file a photograph under, busiest first so the common ones lead. */
	$: places = archive
		? [...archive.places].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		: [];

	function togglePlace(item: QueuedSubmission, placeId: string): void {
		const current = editsFor(item);
		const chosen = current.places ?? [];
		current.places = chosen.includes(placeId)
			? chosen.filter((id) => id !== placeId)
			: [...chosen, placeId];
		edits = edits;
	}

	function readableSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
	}
</script>

<Seo title="Beheer" description="De werkplek van wie het archief beheert." path="/beheer" noindex />

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">Beheer</h1>

		{#if signedInAs}
			<div class="flex items-center gap-3 text-sm">
				<span class="text-gray-600 dark:text-gray-400">{signedInAs}</span>
				<button
					type="button"
					class="rounded border border-gray-300 dark:border-gray-700 px-3 py-1.5 font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
					on:click={signOut}
				>
					Afmelden
				</button>
			</div>
		{/if}
	</header>

	{#if error}
		<div
			class="mt-6 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5 text-red-900 dark:text-red-200"
		>
			<p class="font-semibold">{error}</p>
		</div>
	{/if}

	{#if checking}
		<p class="py-16 text-center text-gray-500 dark:text-gray-400">Bezig met aanmelden ...</p>
	{:else if !curator}
		<div
			class="mt-8 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center"
		>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Aanmelden</h2>
			<p class="mx-auto mt-2 max-w-md text-gray-600 dark:text-gray-400">
				Deze pagina is voor wie het archief beheert. Meld u aan met het Google-account dat op de
				beheerderslijst staat.
			</p>
			<button
				type="button"
				class="mt-5 rounded-lg bg-blue-800 px-6 py-3 font-semibold text-white hover:bg-blue-900"
				on:click={signIn}
				disabled={!isConfigured()}
			>
				Aanmelden met Google
			</button>
		</div>
	{:else}
		<nav class="mt-6 flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
			{#each [['fotos', 'Inzendingen'], ['archief', "Foto's in het archief"], ['jaartallen', 'Jaartallen'], ['correcties', 'Plaatsen op de kaart']] as [value, label] (value)}
				<button
					type="button"
					class="rounded-lg px-4 py-2 font-semibold transition {desk === value
						? 'bg-gray-900 text-white'
						: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
					on:click={() => {
						if (value === 'archief') {
							openArchiveDesk();
							return;
						}
						if (value === 'jaartallen') {
							openDatingDesk();
							return;
						}
						desk = value === 'correcties' ? 'correcties' : 'fotos';
						showing = 'pending';
						refresh();
						if (desk === 'correcties' && !placesReady) loadPlacesData();
					}}
				>
					{label}
				</button>
			{/each}
		</nav>

		<nav class="mt-6 flex gap-2" class:hidden={desk === 'archief' || desk === 'jaartallen'}>
			{#each tabs as [value, label] (value)}
				<button
					type="button"
					class="rounded-lg px-4 py-2 font-medium transition {showing === value
						? 'bg-blue-800 text-white'
						: 'border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}"
					on:click={() => {
						showing = value;
						refresh();
					}}
				>
					{label}
				</button>
			{/each}
		</nav>

		{#if desk === 'jaartallen'}
			<!--
				Where the timeline actually grows. 3,896 photographs have no year, and the two
				ways that changes - what a visitor suggests and what a curator knows - are the
				same job from two directions, so they share a desk.
			-->
			{#if archive}
				<DatingDesk {archive} edits={photoEdits} />
			{:else}
				<p class="py-10 text-center text-gray-500 dark:text-gray-400">
					Bezig met het laden van het archief ...
				</p>
			{/if}
		{:else if desk === 'archief'}
			<section class="mt-6">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					Een foto uit het archief aanpassen
				</h2>
				<p class="mt-1 text-gray-600 dark:text-gray-400">
					Alles wat het archief van deze foto's weet, komt uit de bestandsnaam. Een titel die krom
					loopt, een verkeerde straat, een jaartal dat nergens in stond &mdash; dat zet u hier
					recht. Wijzigingen zijn meteen zichtbaar op de site.
				</p>

				<label class="mt-4 block">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Zoek een foto</span>
					<input
						bind:value={photoQuery}
						placeholder="Straat, titel, jaartal, wie ze gaf ..."
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
					/>
				</label>

				{#if !archive}
					<p class="py-10 text-center text-gray-500 dark:text-gray-400">
						Bezig met laden van het archief ...
					</p>
				{:else if openPhoto}
					<div class="mt-5 rounded-xl border border-gray-300 p-4 dark:border-gray-700">
						<button
							type="button"
							class="mb-4 text-sm font-medium text-blue-800 underline hover:no-underline dark:text-blue-300"
							on:click={() => (openPhoto = null)}
						>
							&larr; Terug naar de resultaten
						</button>

						{#key openPhoto.id}
							<PhotoEditor {archive} photo={openPhoto} existing={photoEdits[openPhoto.id]} />
						{/key}
					</div>
				{:else if photoQuery.trim().length < 2}
					<p class="py-10 text-center text-gray-600 dark:text-gray-400">
						Typ iets om te zoeken in {archive.imageCount.toLocaleString('nl-BE')} foto's.
					</p>
				{:else if photoHits.length === 0}
					<p class="py-10 text-center text-gray-600 dark:text-gray-400">
						Niets gevonden voor &ldquo;{photoQuery}&rdquo;.
					</p>
				{:else}
					<ul class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						{#each photoHits as hit (hit.photo.id)}
							<li>
								<button
									type="button"
									class="w-full overflow-hidden rounded-lg border border-gray-200 text-left transition hover:border-blue-600 dark:border-gray-700"
									on:click={() => (openPhoto = hit.photo)}
								>
									<img
										src={thumbUrl(archive, hit.photo)}
										alt={hit.photo.t}
										loading="lazy"
										class="aspect-[4/3] w-full bg-gray-100 object-cover dark:bg-gray-800"
									/>
									<span
										class="block truncate px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
										title={hit.photo.t}
									>
										{hit.photo.t}
									</span>
									{#if photoEdits[hit.photo.id]}
										<span
											class="block px-2 pb-1 text-xs font-medium text-amber-700 dark:text-amber-400"
										>
											aangepast
										</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<!-- Existing folder names, so a curator reuses one rather than inventing a variant. -->
			<datalist id="beheer-categorieen">
				{#each archive?.subjects ?? [] as subject (subject.slug)}
					<option value={subject.name} />
				{/each}
			</datalist>
		{:else if desk === 'correcties'}
			<h2 class="mt-6 text-xl font-bold text-gray-900 dark:text-gray-100">
				Meldingen van bezoekers
			</h2>
			{#if loading}
				<p class="py-8 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
			{:else if reports.length === 0}
				<p class="py-8 text-center text-gray-600 dark:text-gray-400">
					Geen meldingen.
					{#if correctableCount > 0}
						{correctableCount} plaatsen staan bij benadering op de kaart en wachten op iemand die
						het beter weet &mdash; die kunt u hieronder zelf zetten.
					{/if}
				</p>
			{:else}
				<ul class="mt-4 space-y-4">
					{#each reports as report (report.id)}
						<li
							class="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
						>
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
										{report.placeName}
									</h3>
									<p class="font-medium text-gray-800 dark:text-gray-200">{claim(report)}</p>
									{#if report.message}
										<p
											class="mt-2 rounded bg-amber-50 dark:bg-amber-950 p-2 text-sm text-gray-800 dark:text-gray-200"
										>
											&ldquo;{report.message}&rdquo;
										</p>
									{/if}
									<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
										Gemeld {new Date(report.submittedAt).toLocaleDateString('nl-BE')}
										{#if report.contributor.name}door {report.contributor.name}{/if}
										{#if report.contributor.email}&middot; {report.contributor.email}{/if}
									</p>
								</div>

								<!-- What the map was claiming when they objected. Captured at the time,
								     because the research may have been regenerated since. -->
								<dl
									class="shrink-0 rounded bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300"
								>
									<dt class="font-semibold">Stond als</dt>
									<dd>{report.previous.display} &middot; klasse {report.previous.grade}</dd>
									{#if report.previous.lat != null}
										<dd>{report.previous.lat.toFixed(5)}, {report.previous.lng?.toFixed(5)}</dd>
									{/if}
									{#if report.previous.radius}<dd>&plusmn; {report.previous.radius} m</dd>{/if}
								</dl>
							</div>

							<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
								{#if report.kind === 'coordinate' && report.lat != null}
									&ldquo;Klopt, zet de pin&rdquo; keurt goed en verplaatst meteen het punt op de
									kaart. De onderzoeksklasse en twijfeltekst in
									<code class="rounded bg-gray-100 dark:bg-gray-800 px-1">plaatsen.geojson</code>
									volgen bij de volgende commit.
								{:else}
									Goedkeuren noteert dat de melding klopt. De kaart verandert pas als
									<code class="rounded bg-gray-100 dark:bg-gray-800 px-1">plaatsen.geojson</code> wordt
									aangepast, zodat de klasse en de twijfeltekst mee veranderen met het punt.
								{/if}
							</p>

							<div class="mt-3 flex flex-wrap gap-2">
								{#if report.status !== 'accepted' && report.kind === 'coordinate' && report.lat != null}
									<button
										type="button"
										class="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:bg-gray-400"
										disabled={reportBusy === report.id}
										on:click={() => acceptWithPin(report)}
									>
										{reportBusy === report.id ? 'Bezig ...' : 'Klopt, zet de pin'}
									</button>
								{/if}
								{#if report.status !== 'accepted'}
									<button
										type="button"
										class="rounded-lg px-5 py-2.5 font-semibold {report.kind === 'coordinate' &&
										report.lat != null
											? 'border-2 border-green-700 text-green-800 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950'
											: 'bg-green-700 text-white hover:bg-green-800'} disabled:opacity-50"
										disabled={reportBusy === report.id}
										on:click={() => judge(report, 'accepted')}
									>
										{reportBusy === report.id
											? 'Bezig ...'
											: report.kind === 'coordinate' && report.lat != null
											? 'Klopt, zonder pin'
											: 'Klopt'}
									</button>
								{/if}
								{#if report.status !== 'rejected'}
									<button
										type="button"
										class="rounded-lg border-2 border-red-600 px-5 py-2.5 font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 disabled:opacity-50"
										disabled={reportBusy === report.id}
										on:click={() => judge(report, 'rejected')}
									>
										Klopt niet
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-10 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Alle plaatsen</h2>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Elke plaats, met waar ze nu staat en waar dat vandaan komt. Klik en zet de pin
						&mdash; die staat er meteen, voor iedereen.
					</p>
				</div>
				<button
					type="button"
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
					on:click={exportCoordinates}
					title="De pins leven in de databank; dit bestand maakt ze blijvend in de repository."
				>
					Bewaar als place-coordinates.json
				</button>
			</div>

			<input
				bind:value={placeQuery}
				type="search"
				placeholder="Zoek een plaats ..."
				class="mt-3 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
			/>

			{#if !placesReady}
				<p class="py-8 text-center text-gray-500 dark:text-gray-400">
					Bezig met het laden van de plaatsen ...
				</p>
			{:else if placeRows.length === 0}
				<p class="py-8 text-center text-gray-600 dark:text-gray-400">Geen plaats gevonden.</p>
			{:else}
				<ul class="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-300 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
					{#each placeRows as row (row.place.id)}
						<li class="flex flex-wrap items-center gap-3 px-4 py-2.5">
							<div class="min-w-0 flex-1">
								<span class="font-medium text-gray-900 dark:text-gray-100">{row.place.name}</span>
								<span class="ml-2 text-sm text-gray-500 dark:text-gray-400">
									{row.place.count}
									{row.place.count === 1 ? 'foto' : "foto's"}
								</span>
							</div>
							<span
								class="rounded-full px-3 py-0.5 text-xs font-medium {row.located === null
									? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
									: row.hasPin || row.located.source === 'placed'
									? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
									: row.located.source === 'register'
									? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
									: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}"
							>
								{sourceLabel(row)}
							</span>
							<button
								type="button"
								class="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
								on:click={() => (picking = row.place)}
							>
								{row.located === null ? 'Plaats' : 'Verplaats'}
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if picking}
				{@const current = locate(picking.id, allCoordinates, streetGeometry, approximations)}
				<PinPicker
					placeName={picking.name}
					start={current ? { lat: current.lat, lng: current.lng } : null}
					hasPin={picking.id in pins}
					busy={pinBusy}
					on:save={(event) => picking && savePin(picking, event.detail)}
					on:remove={() => picking && dropPin(picking)}
					on:close={() => (picking = null)}
				/>
			{/if}
		{:else if loading}
			<p class="py-16 text-center text-gray-500 dark:text-gray-400">Bezig met laden ...</p>
		{:else if items.length === 0}
			<p class="py-16 text-center text-gray-600 dark:text-gray-400">
				{showing === 'pending' ? 'Niets te bekijken. Alles is afgehandeld.' : 'Niets hier.'}
			</p>
		{:else}
			<ul class="mt-6 space-y-6">
				{#each items as item (item.id)}
					{@const ready = editsFor(item)}
					<li
						class="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 lg:flex lg:gap-6"
					>
						<div class="lg:w-80 lg:shrink-0">
							<img
								src={item.previewUrl}
								alt={item.originalName}
								class="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 object-contain"
							/>
							<p
								class="mt-2 truncate text-sm text-gray-500 dark:text-gray-400"
								title={item.originalName}
							>
								{item.originalName} &middot; {readableSize(item.bytes)}
							</p>
							<p class="text-sm text-gray-500 dark:text-gray-400">
								Ingestuurd {new Date(item.submittedAt).toLocaleDateString('nl-BE')}
								{#if item.contributor.name}door {item.contributor.name}{/if}
							</p>
							{#if item.contributor.email}
								<p class="text-sm text-gray-500 dark:text-gray-400">{item.contributor.email}</p>
							{/if}
							{#if item.contributor.note}
								<p
									class="mt-2 rounded bg-amber-50 dark:bg-amber-950 p-2 text-sm text-gray-800 dark:text-gray-200"
								>
									Over de inzending: &ldquo;{item.contributor.note}&rdquo;
								</p>
							{/if}
							{#if item.suggestion}
								<!--
									What they said about this photograph in particular. Shown verbatim
									beside the form it prefilled, so a curator can see what was suggested
									even after editing the fields.
								-->
								<div
									class="mt-2 space-y-1 rounded bg-amber-50 dark:bg-amber-950 p-2 text-sm text-gray-800 dark:text-gray-200"
								>
									{#if item.suggestion.title}
										<p>Titel: &ldquo;{item.suggestion.title}&rdquo;</p>
									{/if}
									{#if item.suggestion.year}
										<p>Jaartal: &ldquo;{item.suggestion.year}&rdquo;</p>
									{/if}
									{#if item.suggestion.description}
										<p>&ldquo;{item.suggestion.description}&rdquo;</p>
									{/if}
								</div>
							{/if}
							{#if item.rejectionReason}
								<p
									class="mt-2 rounded bg-red-50 dark:bg-red-950 p-2 text-sm text-red-900 dark:text-red-200"
								>
									Afgewezen: {item.rejectionReason}
								</p>
							{/if}
						</div>

						<div class="mt-4 min-w-0 flex-1 lg:mt-0">
							<label class="block">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Titel</span>
								<input
									bind:value={edits[item.id].title}
									class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
							</label>

							<label class="mt-3 block">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
									>Beschrijving</span
								>
								<textarea
									bind:value={edits[item.id].description}
									rows="2"
									class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
							</label>

							<div class="mt-3 grid gap-3 sm:grid-cols-3">
								<label class="block">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
										>Huisnummer</span
									>
									<input
										type="number"
										bind:value={edits[item.id].houseNumber}
										class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									/>
								</label>
								<label class="block">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Jaartal</span>
									<input
										bind:value={edits[item.id].year}
										placeholder="1935"
										class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									/>
								</label>
								<label class="block">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
										>Ingezonden door</span
									>
									<input
										bind:value={edits[item.id].donor}
										class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									/>
								</label>
							</div>

							<div class="mt-3">
								<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Plaats
									{#if ready.places && ready.places.length > 0}
										<span class="font-normal text-gray-500 dark:text-gray-400"
											>({ready.places.length} gekozen)</span
										>
									{/if}
								</p>

								{#if ready.places && ready.places.length > 0}
									<ul class="mt-1 flex flex-wrap gap-1">
										{#each ready.places as placeId (placeId)}
											<li>
												<button
													type="button"
													class="rounded-full bg-blue-800 px-3 py-1 text-sm text-white"
													on:click={() => togglePlace(item, placeId)}
												>
													{archive?.placeById.get(placeId)?.name ?? placeId} &times;
												</button>
											</li>
										{/each}
									</ul>
								{/if}

								<select
									class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									on:change={(event) => {
										if (event.currentTarget.value) togglePlace(item, event.currentTarget.value);
										event.currentTarget.value = '';
									}}
								>
									<option value="">Straat of plaats toevoegen ...</option>
									{#each places as place (place.id)}
										<option value={place.id}>{place.name} ({place.count})</option>
									{/each}
								</select>
							</div>

							<div class="mt-5 flex flex-wrap gap-2">
								{#if item.status !== 'approved'}
									<button
										type="button"
										class="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:bg-gray-400"
										disabled={busy === item.id}
										on:click={() => decide(item, 'approved')}
									>
										{busy === item.id ? 'Bezig ...' : 'Goedkeuren en publiceren'}
									</button>
								{/if}

								{#if item.status !== 'rejected'}
									<button
										type="button"
										class="rounded-lg border-2 border-red-600 px-5 py-2.5 font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 disabled:opacity-50"
										disabled={busy === item.id}
										on:click={() => decide(item, 'rejected')}
									>
										Afwijzen
									</button>
								{/if}

								{#if item.status !== 'pending'}
									<button
										type="button"
										class="rounded-lg border border-gray-400 dark:border-gray-600 px-5 py-2.5 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
										disabled={busy === item.id}
										on:click={() => decide(item, 'pending')}
									>
										Terug naar de wachtrij
									</button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
