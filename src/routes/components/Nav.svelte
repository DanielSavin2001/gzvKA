<script lang="ts">
	import { onMount } from 'svelte';

	import type { Archive, ArchivePlace } from '$lib/archive';
	import { loadArchive } from '$lib/archive';
	import logo_no_background from '$lib/images/logo/svg/logo-no-background.svg';
	import flag_of_kapellen from '$lib/images/logo/kapellen-flag/Flag_of_Kapellen,_Belgium.svg';

	let archive: Archive | null = null;
	let open = false;

	// The menus used to be a hand-written list where almost every item linked nowhere.
	// They are now built from the archive itself, so an entry exists only when there are
	// photographs behind it and its count is always true.
	onMount(async () => {
		try {
			archive = await loadArchive();
		} catch {
			// The header must still render if the index cannot be loaded; the page itself
			// reports the problem.
		}
	});

	function top(
		loaded: Archive | null,
		kind: (place: ArchivePlace) => boolean,
		limit: number
	): ArchivePlace[] {
		if (!loaded) return [];
		return loaded.places
			.filter((place) => place.count > 0 && kind(place))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	}

	// `archive` has to appear in the reactive statement itself. Svelte 3 works out a
	// statement's dependencies from the identifiers written in it, so `top(...)` alone -
	// with `archive` read only inside the function body - never re-ran when the archive
	// finished loading, and all three menus stayed permanently empty.
	$: streets = top(archive, (place) => place.isStreet, 10);
	$: castles = top(archive, (place) => place.kind === 'castle-estate', 10);
	$: areas = top(archive, (place) => place.kind === 'area', 8);
</script>

<header class="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
	<div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
		<a href="/" class="flex shrink-0 items-center gap-3" aria-label="Naar de startpagina">
			<img src={logo_no_background} class="h-12 w-auto sm:h-16" alt="gzvKA" />
			<img src={flag_of_kapellen} class="hidden h-10 w-auto sm:block" alt="Vlag van Kapellen" />
		</a>

		<nav class="ml-auto hidden items-center gap-1 lg:flex" aria-label="Hoofdmenu">
			<a class="rounded px-3 py-2 font-medium text-gray-800 hover:bg-gray-100" href="/"
				>Startpagina</a
			>
			<a class="rounded px-3 py-2 font-medium text-gray-800 hover:bg-gray-100" href="/verhalen"
				>Verhalen</a
			>

			<div class="group relative">
				<button type="button" class="rounded px-3 py-2 font-medium text-gray-800 hover:bg-gray-100">
					Straten
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-64 rounded-lg border border-gray-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each streets as street (street.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 hover:bg-blue-50"
								href="/straat/{street.id}"
							>
								<span>{street.name}</span><span class="text-sm text-gray-500">{street.count}</span>
							</a>
						</li>
					{/each}
					<li class="mt-1 border-t border-gray-200">
						<a class="block px-4 py-2 font-medium text-blue-800 hover:bg-blue-50" href="/">
							Alle straten &rarr;
						</a>
					</li>
				</ul>
			</div>

			<div class="group relative">
				<button type="button" class="rounded px-3 py-2 font-medium text-gray-800 hover:bg-gray-100">
					Kastelen
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-72 rounded-lg border border-gray-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each castles as castle (castle.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 hover:bg-blue-50"
								href="/straat/{castle.id}"
							>
								<span>{castle.name}</span><span class="text-sm text-gray-500">{castle.count}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<div class="group relative">
				<button type="button" class="rounded px-3 py-2 font-medium text-gray-800 hover:bg-gray-100">
					Wijken
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-64 rounded-lg border border-gray-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each areas as area (area.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 hover:bg-blue-50"
								href="/straat/{area.id}"
							>
								<span>{area.name}</span><span class="text-sm text-gray-500">{area.count}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<a
				class="ml-2 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
				href="/upload"
			>
				Foto insturen
			</a>
		</nav>

		<button
			type="button"
			class="ml-auto rounded p-2 text-gray-800 hover:bg-gray-100 lg:hidden"
			aria-expanded={open}
			aria-controls="mobiel-menu"
			on:click={() => (open = !open)}
		>
			<span class="sr-only">Menu</span>
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
			</svg>
		</button>
	</div>

	{#if open}
		<nav id="mobiel-menu" class="border-t border-gray-200 px-4 py-2 lg:hidden" aria-label="Menu">
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 hover:bg-gray-100"
				href="/"
				on:click={() => (open = false)}>Startpagina</a
			>
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 hover:bg-gray-100"
				href="/verhalen"
				on:click={() => (open = false)}>Verhalen</a
			>
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 hover:bg-gray-100"
				href="/upload"
				on:click={() => (open = false)}>Foto insturen</a
			>

			{#if streets.length > 0}
				<p class="mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Straten</p>
				{#each streets.slice(0, 6) as street (street.id)}
					<a
						class="block rounded px-2 py-2 text-gray-800 hover:bg-gray-100"
						href="/straat/{street.id}"
						on:click={() => (open = false)}
					>
						{street.name} <span class="text-sm text-gray-500">{street.count}</span>
					</a>
				{/each}
			{/if}
		</nav>
	{/if}
</header>
