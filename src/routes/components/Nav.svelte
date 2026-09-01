<script lang="ts">
	import { onMount } from 'svelte';

	import ThemeToggle from './ThemeToggle.svelte';
	import logo_no_background from '$lib/images/logo/svg/logo-no-background.svg';
	import logo_white from '$lib/images/logo/svg/logo-white-transparent.svg';
	import flag_of_kapellen from '$lib/images/logo/kapellen-flag/Flag_of_Kapellen,_Belgium.svg';

	/** All a menu entry is: somewhere to go, what to call it, and how much is there. */
	interface MenuPlace {
		id: string;
		name: string;
		count: number;
	}

	interface Menu {
		straten: MenuPlace[];
		kastelen: MenuPlace[];
		wijken: MenuPlace[];
	}

	const EMPTY: Menu = { straten: [], kastelen: [], wijken: [] };

	let menu: Menu = EMPTY;
	let open = false;

	/**
	 * The menus are their own small file, not a slice of the archive.
	 *
	 * They were built from the full index, which meant every cold visit downloaded 1.1 MB
	 * before a dropdown could list ten street names - about forty names and counts, paid for
	 * with a megabyte, on the critical path of every page on the site. `menu.json` is the
	 * same answer in under two kilobytes, generated alongside the index so it cannot
	 * disagree with it.
	 *
	 * Still after mount rather than from `load`: SvelteKit inlines a layout's load data into
	 * every prerendered page, and two kilobytes across 4,700 pages is nine megabytes of HTML
	 * to save one small cached fetch.
	 */
	onMount(async () => {
		try {
			const response = await fetch('/data/menu.json');
			if (response.ok) menu = (await response.json()) as Menu;
		} catch {
			// The header must still render without it. Every menu has an "Alle ..." link at
			// the foot that goes to the full index page, so nothing becomes unreachable.
		}
	});

	// `menu` has to appear in the reactive statement itself. Svelte 3 works out a
	// statement's dependencies from the identifiers written in it, so a call that read it
	// only inside a function body never re-ran when the data arrived, and all three menus
	// stayed permanently empty.
	$: streets = menu.straten;
	$: castles = menu.kastelen;
	$: areas = menu.wijken;

	/**
	 * The same three families the index pages use, for the phone menu.
	 *
	 * The desktop dropdowns above now read the same three lists. They used to apply their
	 * own narrower rule - `castle-estate` only, `area` only - which meant the header could
	 * file a fort under nothing while /kastelen listed it, so a place was reachable from the
	 * page and missing from the menu that points at it.
	 */
	$: groups = [
		{ slug: 'straten', label: 'Straten', places: menu.straten },
		{ slug: 'kastelen', label: 'Kastelen', places: menu.kastelen },
		{ slug: 'wijken', label: 'Wijken', places: menu.wijken }
	];

	/** Which group is folded open. One at a time, so the menu stays a menu. */
	let unfolded: string | null = null;
</script>

<header
	class="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 print:hidden"
>
	<div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
		<a href="/" class="flex shrink-0 items-center gap-3" aria-label="Naar de startpagina">
			<!--
				Two files rather than one. The wordmark is dark blue, which vanishes on a dark
				header - and a CSS filter that inverts it would take the yellow with it. Both
				are in the page and CSS picks; the second costs a few kilobytes once.
			-->
			<img src={logo_no_background} class="h-12 w-auto sm:h-16 dark:hidden" alt="gzvKA" />
			<img src={logo_white} class="hidden h-12 w-auto sm:h-16 dark:block" alt="gzvKA" />
			<img src={flag_of_kapellen} class="hidden h-10 w-auto sm:block" alt="Vlag van Kapellen" />
		</a>

		<nav class="ml-auto hidden items-center gap-1 lg:flex" aria-label="Hoofdmenu">
			<a
				class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/">Startpagina</a
			>
			<a
				class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/verhalen">Verhalen</a
			>
			<a
				class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/tijdlijn">Tijdlijn</a
			>

			<div class="group relative">
				<button
					type="button"
					class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					Straten
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each streets as street (street.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950"
								href="/straat/{street.id}"
							>
								<span>{street.name}</span><span class="text-sm text-gray-500 dark:text-gray-400"
									>{street.count}</span
								>
							</a>
						</li>
					{/each}
					<li class="mt-1 border-t border-gray-200 dark:border-gray-700">
						<a
							class="block px-4 py-2 font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
							href="/straten"
						>
							Alle straten &rarr;
						</a>
					</li>
				</ul>
			</div>

			<div class="group relative">
				<button
					type="button"
					class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					Kastelen
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each castles as castle (castle.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950"
								href="/straat/{castle.id}"
							>
								<span>{castle.name}</span><span class="text-sm text-gray-500 dark:text-gray-400"
									>{castle.count}</span
								>
							</a>
						</li>
					{/each}
					<li class="mt-1 border-t border-gray-200 dark:border-gray-700">
						<a
							class="block px-4 py-2 font-medium text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
							href="/kastelen"
						>
							Alle kastelen &rarr;
						</a>
					</li>
				</ul>
			</div>

			<div class="group relative">
				<button
					type="button"
					class="rounded px-3 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					Wijken
				</button>
				<ul
					class="invisible absolute right-0 z-50 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
				>
					{#each areas as area (area.id)}
						<li>
							<a
								class="flex items-center justify-between px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950"
								href="/straat/{area.id}"
							>
								<span>{area.name}</span><span class="text-sm text-gray-500 dark:text-gray-400"
									>{area.count}</span
								>
							</a>
						</li>
					{/each}
					<li class="mt-1 border-t border-gray-200 dark:border-gray-700">
						<a
							class="block px-4 py-2 font-medium text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
							href="/wijken"
						>
							Alle wijken &rarr;
						</a>
					</li>
				</ul>
			</div>

			<a
				class="ml-2 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
				href="/upload"
			>
				Foto insturen
			</a>

			<div class="ml-2"><ThemeToggle /></div>
		</nav>

		<button
			type="button"
			class="ml-auto rounded p-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
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
		<nav
			id="mobiel-menu"
			class="border-t border-gray-200 px-4 py-2 lg:hidden dark:border-gray-700"
			aria-label="Menu"
		>
			<div class="py-2"><ThemeToggle /></div>

			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/"
				on:click={() => (open = false)}>Startpagina</a
			>
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/verhalen"
				on:click={() => (open = false)}>Verhalen</a
			>
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/tijdlijn"
				on:click={() => (open = false)}>Tijdlijn</a
			>
			<a
				class="block rounded px-2 py-2 font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				href="/upload"
				on:click={() => (open = false)}>Foto insturen</a
			>

			<!--
				Straten, Kastelen and Wijken, each folding open to the ten busiest.

				This used to be a flat run of six street names under a heading, with no way to
				reach the castles or the districts at all and nothing linking to a full list.
				A phone menu that shows six of 121 places, chosen by one category, is not a
				way into an archive.

				"Alle ..." is the first entry inside each group rather than the last, because
				somebody who opened the group wanting the whole list should not have to scroll
				past ten names to find out there is one.
			-->
			{#each groups as group (group.slug)}
				{#if group.places.length > 0}
					<button
						type="button"
						class="mt-1 flex w-full items-center justify-between rounded px-2 py-2 font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
						aria-expanded={unfolded === group.slug}
						aria-controls="menu-{group.slug}"
						on:click={() => (unfolded = unfolded === group.slug ? null : group.slug)}
					>
						{group.label}
						<span class="text-sm text-gray-500 dark:text-gray-400">
							{unfolded === group.slug ? '\u2212' : '+'}
						</span>
					</button>

					{#if unfolded === group.slug}
						<div id="menu-{group.slug}" class="border-l border-gray-200 pl-2 dark:border-gray-700">
							<a
								class="block rounded px-2 py-2 font-medium text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
								href="/{group.slug}"
								on:click={() => (open = false)}
							>
								Alle {group.label.toLowerCase()} &rarr;
							</a>
							{#each group.places as place (place.id)}
								<a
									class="flex items-baseline justify-between gap-3 rounded px-2 py-2 text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
									href="/straat/{place.id}"
									on:click={() => (open = false)}
								>
									<span>{place.name}</span>
									<span class="text-sm text-gray-500 dark:text-gray-400">{place.count}</span>
								</a>
							{/each}
						</div>
					{/if}
				{/if}
			{/each}
		</nav>
	{/if}
</header>
