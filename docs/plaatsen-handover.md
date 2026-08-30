# Kapellen map data — handover

Read this before touching `plaatsen-ingevuld.geojson`, `11023_Kapellen_streets.geojson`, or
any street-matching code. It is written for whoever (or whatever) picks the project up next.

---

## 1. The data model has two layers, and they behave differently

**Layer 1 — streets.** 313 features, one per official street, from
`11023_Kapellen_streets.geojson`. Authoritative, complete, machine-derived. Every feature has
a `street_id` from the Flemish address register.

**Layer 2 — places.** 82 features in `plaatsen-ingevuld.geojson`: castles, chapels, cafés,
hamlets, forts. Human-derived, partly from prose, with a per-row confidence grade. **No stable
IDs exist for these** — no registry assigns identifiers to a demolished café.

Do not merge these into one collection with one schema. The streets layer can be regenerated
from scratch by rerunning `build_municipality.py`; the places layer cannot, because a third of
it came from reading sentences on a heritage website. Regenerating would destroy work.

### Confidence grades are load-bearing

| grade | count | photos | what it means                                                                            |
| :---: | ----: | -----: | ---------------------------------------------------------------------------------------- |
|   A   |    51 |  2.935 | Geocoded address, or an OSM object with the same name. Building-level.                   |
|   B   |    15 |    447 | Street or junction certain from a written source; point is the street itself. ±50–150 m. |
|   C   |    13 |    249 | Inferred from a description. ±200–400 m.                                                 |
|   ?   |     3 |     13 | Not found. Deliberately empty.                                                           |

**Never render C the same as A.** A is a geocoded building; C is my reading of a phrase like
"on the north side of the Kalmthoutsesteenweg" — a street 1.7 km long. If the UI shows both as
identical pins, the map asserts a precision the data does not have, and nobody will ever know
which pins to distrust. Render C with a visibly larger radius or a distinct style.

**Never silently upgrade a grade.** If someone corrects a point via `/?beheer`, that is
new evidence and the row should become A — but that must be an explicit edit that also
rewrites `toelichting`, not a side effect of the point moving.

---

## 2. Three structural traps in Belgian street data

These already caused real bugs in this project. Each will recur when the scope extends to
neighbouring municipalities.

### 2.1 Name matching must be case-, accent- and punctuation-insensitive

The official register is **not internally consistent about its own spellings**:

- It writes **`van Vredenburchlaan`** with a lowercase _van_. An exact string comparison
  against a locally-capitalised list reports a phantom missing street. This cost a bogus
  entry in the first audit.
- Stabroek carries **`M.Vloeberghslaan`** _and_ **`M. Vloeberghslaan`** — two different
  `street_id` values, one street, differing only by a space after the period.

The `norm()` function in `build_municipality.py` strips everything that is not `[a-z0-9]`:

```python
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", s.lower())
```

Use it for **every** comparison against a street name. Use the original spelling only for
display. If you write a new comparison anywhere in the codebase and reach for `==` on a street
name, that is a bug in waiting.

**One consequence to watch.** Because `norm()` strips spaces, alias-table keys must be
normalised through the same function rather than written with spaces by hand. Getting this
wrong silently unmatched `Korte Dennenburgdreef` in one run — the pipeline reported success
and quietly lost a street. There is now a `_alias` lookup built at import time; keep it.

### 2.2 OSM and the register disagree on spelling, and OSM is not always wrong

Five Kapellen streets are spelled differently in the two sources. Each entry in the `ALIAS`
table was verified by pulling the street's official address points and confirming they fall
within ~25 m of the candidate OSM way:

| register              | OSM                  | distance |
| --------------------- | -------------------- | -------: |
| Bosduiflaan           | Bosduinlaan          |     22 m |
| Dennenburgdreef       | Denneburgdreef       |     15 m |
| Korte Dennenburgdreef | Korte Denneburgdreef |     21 m |
| Koekoekdreef          | Koekoeksdreef        |     20 m |
| Parifartdreef         | Parifardreef         |        — |

**Verify before adding to this table; never guess from string similarity alone.** Kapellen has
both a `Krynlaan` and — just over the border in Brasschaat — a `Krijnlaan`. Those are two
different streets that a fuzzy matcher will happily merge. The address-point check is what
distinguishes a spelling variant from a genuine neighbour.

Border roads also carry two names on a single OSM way: `Ertbrandstraat - Puttestraat`,
`Grensstraat - Driehoevenseweg`, `Parijseweg / Parijse weg`. The `resolve()` function splits on
`-` and `/` and assigns the geometry to **every** matching official street, not just the
first. An earlier version took the first match and lost `Driehoevenseweg` entirely.

### 2.3 Municipal boundaries are not where the data ends

The Overpass area query returns any way with a node inside the boundary, so a neighbouring
town's street that merely grazes the border comes back too. Filtering is two-stage:

1. **Name filter** — only names in the official register survive. This removes most of it
   (Achterstraat, Begoniastraat, Molenstraat are all Stabroek/Putte streets).
2. **Geometry clip** — intersect with the boundary buffered by ~20 m (`poly.buffer(0.00025)`),
   then drop anything with under 5 m inside.

The 20 m buffer exists for a specific reason: on roads where the boundary runs down the middle,
the OSM centreline can sit a metre or two on the neighbour's side. Clipping to the raw polygon
deletes those streets. Do not reduce the buffer to "tighten" the data.

Four entries in the places layer sit **outside Kapellen on purpose** — Kasteel Ravenhof
(Stabroek), Kattekensberg (Brasschaat), Putsesteenweg (Kalmthout), and a note about a
Galgenveld street in Stabroek. They are searchable but must not render on a Kapellen map. Do
not "fix" them by nudging them inside the boundary.

---

## 3. Places that are not places

Four rows in the places layer break the assumption that one name equals one point on a map.
Handle them explicitly or they will produce nonsense.

**Tajje is a person.** "Tajje de Kotter" was the nickname of Matheus Janssens, whose 100th
birthday was celebrated on 9 July 1976 with a procession through the whole municipality. The
58 photos are of that parade — captions read "afhalen Akkerstraat", "optocht op de
Hoevensebaan", "optocht in het centrum". The coordinate given (Akkerstraat) is where he was
collected. Pinning 58 parade photos to one house number is wrong; this wants a **person** tag
or an **event** tag, not a location.

**Beukenhof and Mastbeekhof are the same building.** Christiaan Pallemansstraat 71, the
current town hall. Built 1827 by baron van Haeften as _Hof Van Haeften_ / _Mastbeekhof_;
renamed _Beukenhof_ by jonkheer Johan van Vredenburch in 1920. Onroerend Erfgoed files it as
"Villa Van Haeften" (id 13307). That is **four names for one address**, and the archive holds
54 photos under one and 2 under the other. Merge them or make one an alias — but if you merge,
keep both names searchable, because a photo captioned "Mastbeekhof" is pre-1920 and that dating
information is worth preserving. The Van Haeftenlaan and van Vredenburchlaan are named after
two of the owners.

**Oude Baan and IJzerenweglaan are renamed streets, not lost ones.** Oude Baan is the former
name of the **Rubensheide**. IJzerenweglaan was absorbed into the **Koningin Astridlaan** in a
1909 subdivision, along with a stretch that used to be called Hoogboomsteenweg. Same for
**Denneburgdreef**, which is just the register's `Dennenburgdreef` with one _n_. None of these
belong in a "disappeared streets" bucket — they want an `alias_of` relation to a live street,
so that searching the old name finds the current one.

**Hoogboomkruis is a crossroads, not a cross.** The junction of Hoogboomsteenweg and
Antwerpsesteenweg, called that in local speech. The name invites a wrong guess (a wayside
crucifix); the coordinate is confirmed by sitting 26 m from Hoogboomsteenweg nr. 2.

---

## 4. Sources, and what each one is good for

| source                                                              | use it for                                                                                                                               | caveat                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Vlaams Adressenregister** (`api.basisregisters.vlaanderen.be`)    | Official street list per NIS code; `adresmatch` turns an address into a building-precise point. Every A-grade coordinate came from here. | No key needed. Internally inconsistent spellings — see §2.1.                                                |
| **Inventaris Onroerend Erfgoed** (`inventaris.onroerenderfgoed.be`) | 287 heritage objects in Kapellen with street addresses. This is what cracked the castles.                                                | Paging params are `pagina` / `per_pagina`, not `page` / `per_page`. Total is in the `content-range` header. |
| **OpenStreetMap** via Overpass                                      | Street centrelines, POIs, boundaries, parks.                                                                                             | **ODbL — attribution is required if you publish the geometries.** Mirrors are unreliable; see below.        |
| **gzvka.be** / Heemkring Hoghescote                                 | Everything the official sources don't hold: cafés, demolished villas, nicknames, old street names. Nearly every B and C row rests on it. | **No open licence.** Use it to locate things; do not copy its descriptions into the repo.                   |
| **kapellen.be**                                                     | Municipal pages on individual buildings.                                                                                                 | —                                                                                                           |

### Overpass mirrors will fail

`overpass-api.de` and `overpass.kumi.systems` were unreachable from the build environment
entirely. The two that worked (`maps.mail.ru`, `overpass.openstreetmap.fr`) still threw 502s
and 504s intermittently — a successful run logs several failures before succeeding. The retry
loop in `overpass()` is not defensive padding; it is required.

One mirror (`overpass.osm.ch`) returns **HTTP 200 with an empty result set** for area queries
because its area index is broken. A naive client treats that as "no streets in this
municipality" and writes an empty file. The client checks for empty results and falls through
to the next mirror. Keep that check.

### A note on AI-generated search summaries

Google's AI Overview correctly identified Tajje de Kotter, and independent web search could not
confirm it — the claim only checked out after crawling gzvka.be directly and finding the page
`Matheus Janssens 100 jaar.htm`. Treat such summaries as leads worth chasing, never as
citations. Every one of them here was verified against a primary page before being written into
the data.

---

## 5. Extending to neighbouring municipalities

```bash
pip install requests shapely pyproj beautifulsoup4
python3 scripts/build_municipality.py 11044 11022 11008
python3 scripts/make_map.py out/11044_Stabroek_streets.geojson
```

NIS codes: Stabroek 11044, Kalmthout 11022, Brasschaat 11008, Antwerpen 11002.
One ring further: Essen 11016, Wuustwezel 11053.

Three things to expect:

1. **Antwerpen (11002) is a city, not a village.** That single Overpass query will be heavier
   than every other neighbour combined and will likely need splitting into tiles. Do not run it
   casually alongside the others.
2. **Each municipality needs its own alias audit.** The `ALIAS` table is Kapellen-specific.
   Run the build, look at the "no OSM centreline" list, and verify each candidate against
   address points before adding an entry.
3. **The places layer does not generalise at all.** It exists because Kapellen has an unusually
   good heemkring website. Neighbouring municipalities will need their own sources found from
   scratch, and may simply not have an equivalent.

`build_municipality.py` never silently drops a street: anything with neither an OSM centreline
nor address points is written to `<slug>_ungeocoded.csv`. Stabroek produced four such rows
(named footpaths). Always check that file — the street count should reconcile against the
register total.

---

## 6. Map UI: showing approximations honestly

`plaatsen.geojson` carries everything the map needs. **Do not render all 82 places the same
way.** Each feature has a `weergave` property that says exactly how to draw it:

| `weergave`         | count | how to draw it                                                                                                                       |
| ------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `punt`             |    58 | Normal marker, nothing else. Geocoded address or OSM object, no reservation.                                                         |
| `punt_met_twijfel` |     7 | Normal marker, **no red circle**, but the correction panel is available. An A or B point we still have a specific reservation about. |
| `benadering`       |    11 | Marker **plus a red circle** with radius `straal_m`, dashed border, and an exclamation badge on the pin.                             |
| `kandidaten`       |     5 | Two or more hollow, dashed markers — one per entry in the `kandidaten` array. **No circle.**                                         |
| `niet_geplaatst`   |     1 | `geometry` is `null`. Side panel only, never on the map.                                                                             |

24 places (615 photos) have `corrigeerbaar: true` — those get the callout and the button.

`punt_met_twijfel` exists because confidence and doubt are not the same axis. Duitse Wijk is
grade B — the street is certain from a written source — but the _point on that street_ is the
anchor of a web page rather than the centre of the district, and 49 photos ride on it. Drawing
a 600 m red circle would overstate the problem; hiding the reservation entirely would lose it.
Normal marker, quiet "Klopt dit?" affordance, full `twijfel` text when opened.

### Why `kandidaten` is a separate mode

Five places have two genuinely different possible locations rather than one fuzzy one. Domein
Middelbeek's two candidates are **2.3 km apart**; De Grens could be a street or a border
crossing. Drawing a circle big enough to contain both would cover half the municipality and
imply the true point is somewhere in the middle — which is exactly wrong, since it's at one end
or the other. Show both candidates and let the person pick. The `label` on each candidate
explains what it's based on.

### The callout

Every `corrigeerbaar` feature gets a panel with three things, in this order:

1. **What we think and how sure we are** — the radius in plain language.
2. **Why we're unsure** — the `twijfel` field, verbatim.
3. **The button.**

Suggested Dutch copy, matching the site's existing register:

> ⚠️ **Bij benadering geplaatst**
>
> Deze plek is afgeleid uit een tekstbeschrijving, niet uit een adres. De echte locatie ligt
> ergens binnen deze cirkel (± 600 m).
>
> _Waarom we twijfelen:_ {twijfel}
>
> `[ Corrigeer dit ]`

For `kandidaten`:

> ⚠️ **Twee mogelijke locaties**
>
> We weten niet welke van deze twee het is.
>
> _{kandidaat 1 label}_ · _{kandidaat 2 label}_
>
> `[ Dit is de juiste ]` per kandidaat, plus `[ Geen van beide ]`

For `niet_geplaatst`:

> **Nog niet gevonden**
>
> {twijfel}
>
> `[ Help ons deze plek vinden ]`

**Show the `twijfel` text — don't hide it behind a tooltip.** It is the single most useful thing
on the panel. A local who reads "the point comes from the street name Bunderbeeklaan, because
'Bunder' appears in both" knows instantly whether that reasoning is wrong, and can say so. A
generic "location approximate" tells them nothing and invites no correction. The `onderzoek`
field is aimed at researchers rather than passers-by, so it belongs in an admin view or an
expandable section, not the public callout.

### Tone

State the uncertainty plainly and move on. No apology, no hedging stack, no "we're sorry but".
The circle already communicates doubt visually; the words only need to say why and offer the
fix. Keep the button label a verb the person recognises — "Corrigeer dit" — and make sure it
produces the same wording in the confirmation ("Gecorrigeerd") so the vocabulary stays
consistent through the flow.

### What a correction must write back

A correction is new evidence, so it changes the record, not just the coordinate:

```json
{
	"lat": 51.3168,
	"lon": 4.4235,
	"zekerheid": "A",
	"straal_m": 25,
	"onzeker": false,
	"weergave": "punt",
	"corrigeerbaar": false,
	"twijfel": "",
	"toelichting": "Gecorrigeerd door {bron} op {datum}: clubhuis Korfbalclub Kapellen, op de plek van het kasteel.",
	"gecorrigeerd_door": "…",
	"gecorrigeerd_op": "2026-…"
}
```

Never let a point move without the grade and `toelichting` moving with it. A dragged pin that
still says grade C and still shows the old doubt text is worse than no correction at all,
because the next reader cannot tell which parts of the record are still true.

Keep `gecorrigeerd_door` and `gecorrigeerd_op` — these are the provenance that separates a
verified location from a machine guess, and without them the distinction is lost the moment
anyone regenerates the file.

### Ranking the queue

`prioriteit` holds the photo count for correctable rows, zero otherwise. Sorting by it puts the
most valuable questions first: Geuzenhoek (216), Ertbrand (62), Tajje (58), Duitse Wijk (49),
Kasteel De Sterre (34), Kasteel Bunderhof (32), Kasteel Beaulieu (28), De Grens (28).

Geuzenhoek tops the queue for a different reason than the rest: its _location_ is solid (two
independent sources agree), but 216 photos on a single pin suggests the archive means a stretch
of street, not a point. That is a question about geometry type, not accuracy — consider a
polyline. Don't let the photo count alone drive the UI here. Beaulieu is the cheapest win of the whole set — the
korfball clubhouse still stands on the castle's exact footprint, so one aerial photo settles it.

### Three rows that need special handling

- **Tajje** (`type: "persoon"`) — not a place. 58 photos of a 1976 parade. A "Corrigeer dit"
  button that only moves a pin cannot fix a category error; this needs a way to say
  _"dit is geen plaats"_.
- **Mastbeekhof** (`alias_van: "Kasteel Beukenhof"`) — same building, different era. Merge or
  alias, but keep both names searchable: a photo captioned "Mastbeekhof" is pre-1920, and that
  dating is worth keeping.
- **Kattekensberg, Kasteel Ravenhof, Putsesteenweg** (`buiten_kapellen: true`) — deliberately
  outside the municipality. Searchable, never rendered on a Kapellen map, and not to be
  "fixed" by nudging them inside the boundary.
