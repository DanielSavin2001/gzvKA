# Van fotomap naar doorzoekbaar archief

A plan for turning the gzvKA image collection into an archive you can search by street,
browse on a map, and read stories from — and a record of what is already true today.

Every number below was measured against the 2948 real photographs in this repository, not
estimated. You can reproduce all of them:

```bash
cd functions
npm install
npm run corpus:report          # what the archive yields with no AI at all
npm run corpus:report -- --samples
npm run gazetteer:build        # rebuild the place list, verified against the corpus
npm run map:labels             # street names recovered from the town map
npx jest                       # 165 tests, no credentials needed
```

---

## Where things stand

### What the filenames alone already give us

The volunteers who named these files followed a convention closely enough to parse:
`<description / place> - <donor> - <date>`, with `z.d.` for an unknown date and `z.n.` for
an anonymous donor. Reading it yields, across all 2948 images:

| | photographs | share |
| --- | ---: | ---: |
| a place matched in the gazetteer | 2371 | 80.4% |
| a **street or square** matched | 857 | 29.1% |
| a house number recovered | 110 | 3.7% |
| the donor recovered | 2043 | 69.3% |
| the donation date recovered | 1270 | 43.1% |
| **nothing matched** | **577** | **19.6%** |

477 of those 577 are the `Wedstrijden GZVKA/` subtree — photographs of prize draws and
sponsors rather than of places. That is not a gap to close; it is a part of the archive
that should be browsed by event, not by street.

The important number is 29.1%. **Roughly seven photographs in ten cannot be placed on a
street from the filename alone.** That is the work the AI pass exists to do, and it is why
it is worth paying for.

### What the archive does not have yet

**No photograph in the archive has a coordinate.** The gazetteer ships 121 places and
every single one has `geometry: null`, deliberately. Two consequences run through the whole
plan:

1. A map-first home page would be an empty rectangle today.
2. Even when enrichment is finished, ~39% of the collection will never get a street pin —
   class photographs, portraits, contest albums. A map cannot be the only way in.

So: **the street index is the primary way to browse, and the map is a second view onto
it.** That is the opposite of the instinct to lead with the map, and it is the right way
round for this collection.

### What the town map gave us for free

`varia-text/plan Kapellen.pdf` turned out not to be a scan but a vector map whose street
labels are live text. Reading it recovers **195 street names the archive does not know**,
114 of them cleanly. The gazetteer knows 43 streets today; Kapellen has roughly six times
that. Searching by street is only ever as good as the list of streets, so confirming those
candidates is the single cheapest large improvement available.

They are in `functions/src/data/map-label-candidates.json`, and nothing has been written
to the gazetteer from them — see *Rules we hold to* below.

---

## The plan

### Phase 1 — the foundation (done, in this branch)

- A single shared text normalizer, used identically by the indexing side and the query
  side, so `Klasfoto's`, `Café`, `IJzerenweglaan` and `z.d..jpg` fold the same way
  everywhere. (Closes the long-standing "normalize image titles" item.)
- A Kapellen gazetteer: 121 places, generated from a curated seed joined against the
  corpus, so every entry is backed by at least one real photograph.
- A matcher that survives the archive's real spelling: `Kalmhousesteenweg`,
  `Doprsstraat`, `Hoogboomsesteenweg`, `Kon. Astridlaan` all resolve, while
  `Mastenbos`/`Mastenhof` and `FC Capellen`/`Kapellen` stay apart.
- Street names recovered from the town map, staged for review.
- Seven bugs fixed along the way (see *Fixed on the way through*), three of them in
  the upload path a contributor actually uses.

### Phase 2 — make it searchable (next)

Search does **not** need Firestore queries or a search vendor. A complete prebuilt search
index for the whole archive is around 92 KB gzipped, which the browser downloads once and
then answers every keystroke from locally.

A correction to an earlier draft of this plan, which claimed that index would be *smaller
than a file the site already ships*: it would not. `converter.ts` filters the map data to
images with a real coordinate, and no image has one yet, so `mapData.geojson` is nearly
empty today rather than the 1.4 MB a full collection would be. The search index is a new
payload, not a smaller replacement. It is still the right call — sub-millisecond
keystrokes, ranking, fuzzy matching and offline use all stand on their own, and 92 KB
once per visitor is a fair price for them — but the comparison was wrong and is withdrawn.

So:

- Extend the existing `createGeoJsonJob` pubsub job to also emit a search index and a
  street index into Cloud Storage, alongside the GeoJSON it already writes.
- The browser loads it once and answers every keystroke locally: prefix matching, fuzzy
  matching, facet counts, "did you mean" — none of which Firestore can do.
- Keep a `searchImages` Cloud Function on the same query grammar for crawlers, deep links
  and anything uploaded since the last index build.
- New routes: `/zoeken`, `/straat/[slug]`, `/foto/[id]`.

One caution recorded from the measurements: do **not** index raw filenames. 27% of their
tokens are noise — copy indices and date fragments — so a visitor searching `11` would
match 229 photographs. Index the parsed place and description text instead.

### Phase 3 — the AI pass

For the ~70% of photographs whose street the filename does not give, have Claude read the
photograph itself: street plates, shop signs, house numbers, the era visible in the
clothing and the vehicles, and a Dutch description a resident would recognise.

Measured for this corpus (2948 images, median long edge 866 px): **roughly $60–100 in
total** using the Batch API, and under 5 cents for a single upload. That is a one-off cost
for a permanent improvement to a community archive.

The design is written up and its safety mechanisms are what make it usable in a heritage
archive rather than merely impressive:

- The model may only report a street it can **quote its evidence for**, and the quote is
  checked mechanically against either the text it transcribed from the photograph or the
  filename. An unverifiable citation drops the claim.
- The list of streets is injected as a closed vocabulary, so an off-list street cannot be
  emitted at all — only surfaced as "possibly a new street" for a human.
- The model is **never asked for a coordinate**, and there is no field for one. Map pins
  come from a separate deterministic join against an official address register.
- Nothing the AI produces is written to the photograph's record until it passes the
  reconciliation gate, and anything uncertain waits for a volunteer to approve it.
- The filename is passed as explicitly *untrusted* context, because it usually is.

### Phase 4 — the map (done, in this branch)

Daniel supplied the official street register for Kapellen and Stabroek: 444 street names
with their real OpenStreetMap centrelines. `npm run streets` joins it to the gazetteer by
exact name, which placed **39 of the 47 streets that have photographs** with no hand
placement at all. The map at `/kaart` opened empty before this; it now opens with the
archive on it.

The 8 it could not place are the interesting ones, listed in
`docs/streets-not-in-register.md`: Loopgravenpad (162 photographs), Oude Baan, Stationsplein,
IJzerenweglaan, Blokjesweg, Denneburgdreef, Kazerneplein, Putsesteenweg. A street the modern
register has never heard of is evidence that it was renamed or built over — which is part of
the answer to "did these streets exist back then". Denneburgdreef is a different case: the
register spells it *Dennenburgdreef*, so that one is likely a spelling difference rather than
a lost street.

Expanding the gazetteer to all 444 register names was measured and rejected: only 6 of them
appear in archive filenames at all, across 23 photographs. The gazetteer already covers what
the archive references, so the register's value here is geometry, not coverage.

### Phase 4 (original plan) — the map

- Fill coordinates from OpenStreetMap for the confirmed streets, via a checked-in Overpass
  query so it is reproducible and refreshable.
- The map becomes a second view onto the street index: streets that have photographs are
  drawn as clickable lines, photographs as clustered points, and a click opens the same
  street page the index links to.
- Corners work too — the archive already writes them (`Chr. Pallemansstraat-Heidestraat`)
  and the matcher already recognises them.

### Phase 5 — the texts (done, in this branch)

The 101 pages you extracted from gzvka.be are committed under `legacy-site/` and read by
`npm run stories`. That recovered **290,216 characters of writing across 441 sections**, and
joined **2,266 of the 3,838 photograph references** to files that are actually in this
repository — the join key is the filename, which was never changed between the old site and
the `history-images` folder.

What it produced:

- `/verhalen` — 85 pieces of local history, plus the association's own competition pages
  kept separately.
- `/verhaal/<slug>` — one story, with its photographs in the places the old page put them,
  each linking through to the archive entry.
- **94 places** now carry what was written about them, shown above the photographs on
  `/straat/<slug>`. The matcher works on headings rather than on running prose, so a story
  only lands on a street's page when that street is actually named in the heading above it,
  or when at least three of the section's photographs are filed under it.
- A photograph that appeared in a story now shows the passage it came from, on `/foto/<id>`.

Two things fell out of the corpus that were not planned for. Vicky Staal's memoir heads
every piece with the place and year it is set in — "Nieuwe Wijk, 1983", "Irishof, 1986-1987"
— so those 100 pieces are self-indexed by place and date, and the dating is now carried
through. And the build reports **1,572 photographs that the live site shows and this
repository does not have** (`docs/legacy-missing-photos.txt`); that list is the clearest
measure of what is still only on the old server.

Nothing is paraphrased or generated. Every sentence on the site appears verbatim in the
page named in that story's footer, which is why the source HTML is committed rather than
only the extracted JSON.

#### Still to migrate


The historical writing does not all live on gzvka.be. `varia-text/` in this repository
already holds migratable material, and it is the better place to start because it needs no
network access at all:

- `PANCRAS - Rudi Staute.docx` — now largely redundant: the same serialised history came
  through from `legacy-site/Pancras.htm` and is live at `/verhaal/pancras`. Worth a read
  only to see whether the document carries parts the website never published.
- Press clippings with a machine-readable provenance header (`<publication> – <date> – <url>`).
- The Fietszoektocht 2014 material, which joins to photographs *deterministically*: the
  question number is in the filename (`FZ Louwke Poep 2.jpg`) and the brochure supplies the
  question. No AI needed. A cross-check already turned up one off-by-one, which is the
  argument for the review step below.
- The `.xlsx` standings files are lists of 146–154 named private individuals. **Do not
  import them.**

No scraper was needed for gzvka.be in the end: you saved the pages yourself, which is
better than fetching them — the corpus is frozen, committed, and re-readable offline.

Historical text is usually about a *place*, not about one photograph, which is how it is
modelled: a story linked to places, carrying its source page, its author's signature where
the page had one, and the year where the page named one. This is a heritage archive and
provenance is part of the record.

---

## Corrections made by hand

Two street names were wrong, both found by Daniel looking at the site and both confirmed
against the register and the old website before being changed:

- **Nieuwstraat → Lucien Bevernagestraat.** The old site's own heading reads "LUCIEN
  BEVERNAGESTRAAT (Nieuwstraat)", and the modern register has a Nieuwstraat only in
  *Stabroek*. The gazetteer's bare `nieuwstraat` entry — seeded from a single corpus
  occurrence and marked "confirm against OSM", never confirmed — was putting a Kapellen
  photograph on a street in the next municipality.
- **Rubensheide is a street, not an area.** "De Rubensheide - vroeger Oude Baan - is gelegen
  ten zuiden van de spoorlijn 12" (`legacy-site/Rubensheide.htm`), and the register lists it
  as a Kapellen street. Filed as an `area` it took no house number, so every number on that
  page — 55, 120, 132, 134, 136, 142 — was being discarded.

Per-photograph corrections now have a home in
`functions/src/data/photo-corrections.json`, applied by `npm run archive:index`. The build
refuses a correction that names an unknown place or a photograph that is not in the corpus,
because a correction that silently does nothing is worse than one that fails loudly.

---

## Rules we hold to

These are the ones worth stating out loud, because breaking any of them damages the
archive quietly and permanently.

**No invented coordinates.** Every gazetteer entry ships with no geometry at all. Real
coordinates come only from OpenStreetMap or a deliberate click on a map. A latitude typed
from memory puts a photograph on the wrong street forever, and nobody notices for years.

The mechanism matters as much as the rule: a curator records a coordinate in
`functions/src/gazetteer/seed.ts`, which the generator carries through, and `resolveGeometry`
prefers it over anything fetched from OpenStreetMap. Recording it in the *generated* JSON
instead would look like it worked and then be silently deleted by the next
`npm run gazetteer:build` - which is exactly what the first version of this did, until a
test was written for it.

**No invented names.** The gazetteer is generated, and the generator reports any alias that
occurs nowhere in the archive. That check has already caught four.

**Not everything that ends in -hof is a street.** Kapellen's castles and estates —
Irishof, Mastenhof, Blauwhof, Bunderhof — are marked as estates, so a photograph is never
attributed to a road that does not exist, and `Gemeentepark 3` is read as the third
photograph rather than as house number 3.

**Nothing a machine guessed becomes a fact without a person agreeing.** That applies to the
AI's street readings, to the names pulled off the town map, and to any text matched to a
photograph.

**A missing value stays visibly missing.** Better an empty field than a plausible wrong one.

---

## The gap between the repository and the live archive

Worth settling before anything else, because it changes what "enrich the archive" means:
**nothing in this repository ever writes the 2948 photographs to Firestore or Cloud
Storage.** The only write path is the interactive upload endpoint, one contribution at a
time. The images live in git; the live site reads Firestore.

So either the live archive was populated by hand through the upload page, or the two are
out of step. Either way, running the AI pass "over the archive" needs an ingest step first,
walking the corpus and creating a record per photograph with its source path — which is
also the natural moment to write the street, donor and date this branch can already extract.

That step is not written yet, deliberately: it depends on which of the two is true, and
that is your answer to give.

---

## Fixed on the way through

Seven bugs surfaced while building and verifying the above.

**Uploaded images could never be displayed.** `imageService` writes an
`https://storage.googleapis.com/...` URL on upload, but `extractImagePath` only parsed
`gs://` URIs and threw on exactly that shape — and `retrieveImage` calls it for every
request. It now resolves all four URL shapes present in the archive. An existing test had
asserted that the uploader's own format must throw, so the bug was pinned in place; that
test is replaced.

**Both dates were discarded whenever a filename held three years.** That is the class
photographs, which carry a school year range *and* a donation date, and are among the best
documented files in the collection. Where an unambiguous `dd.mm.yyyy` donation date is
present, both fields are now filled; where the years really are ambiguous, nothing is
asserted, exactly as before.

**`.gitIgnore` was never read by git.** The capital `I` means it is ignored on
case-sensitive filesystems, so `node_modules/`, `build/` and `functions/lib/` were not
actually being ignored outside Windows.

**Jest ran every test twice.** `tsc` emits compiled tests into `lib/`, where jest picked
them up as a second copy of each suite — doubling the reported count and letting a stale
build report green after the TypeScript source had broken.

**Uploads were answered before they were stored.** `handleImages` started the parse and
returned; the code that writes to Firestore and Cloud Storage ran afterwards on an event,
and the request answered `200` in the meantime. On Cloud Functions an instance may be
frozen once it has responded, so a contribution could be lost while the contributor was
told it had worked. The request now waits for the photograph to be durable.

**Every uploaded image was stored with no content type at all.** `FileDataFields` declared
`mimetype`; busboy spells it `mimeType`. Because the busboy callback was annotated with
that interface, the mismatch type-checked happily while the value was always `undefined`.

**Filenames misreport the format.** 55 of the 2948 photographs carry an extension that
disagrees with their bytes — 28 GIFs named `.png`, 26 PNGs named `.jpg`. Uploads now take
their type from the file's magic bytes.

---

## Open questions for you

1. **Are the 2948 photographs in this repository actually in the live Firestore archive?**
   This decides whether the next step is an ingest run or a reconciliation. See above.
2. **The 114 street names from the town map** — worth an evening confirming them? It is
   the cheapest big win available, and it is the difference between searching 43 streets
   and searching the whole municipality.
3. **The AI budget.** ~$60–100 once, for the whole archive. Comfortable?
4. **Who reviews?** The pipeline routes anything uncertain to a volunteer. How many people
   will realistically do that, and how much should auto-approve?
5. **The `Wedstrijden GZVKA/` subtree** (477 photographs) — browse it by event rather than
   by place, and leave it out of the street index entirely?
6. **`.github/workflows/main.yml`** deploys to GitHub Pages from `./dist`, which this
   project never produces — the real deploy is the Firebase workflow next to it. Delete it?
