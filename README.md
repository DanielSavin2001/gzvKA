# Ge zijt van Kapellen als ge ...

![Readme.jpg](src%2Flib%2Fimages%2FReadme.jpg)

## Running it locally

You need [Node.js](https://nodejs.org/) 18 or newer. Nothing else - no Firebase account, no
credentials, no network.

```bash
npm install          # the website
npm run thumbs       # make web-sized copies of the photos (a few minutes, once)
npm run start        # http://localhost:5173
```

That is the whole archive: all 4504 photographs, searchable, browsable by street, with the
writing from the old website beside them. The photo index and the stories are generated from
the images and pages in this repository and committed, so it works on a fresh clone with
nothing configured.

`npm run thumbs` converts the originals into web-sized copies under
`static/foto/` (about 440 MB, not committed). It is safe to re-run - it skips anything
already converted. Without it the pages work but the images are missing.

**Open `localhost:5173`, not `127.0.0.1:5173`.** The Cloud Functions only accept requests
from `localhost` (see `functions/src/utils/cors-helper.ts`), so the upload zone silently
fails on the other spelling.

### The parts that need Firebase

The upload zone and the older subject pages talk to Cloud Functions. For those, copy
`.env.example` to `.env` and fill in `VITE_BASE_URL_GF`. Everything else works without it.

### Regenerating the data

```bash
npm run archive:index   # rebuild the photo index after adding or renaming photos
npm run stories         # rebuild the stories after editing legacy-site/ (run the index first)
npm run streets         # rebuild street positions from the official register
npm run sitemap         # rebuild sitemap.xml and robots.txt (run last: it reads the two above)
```

`sitemap.xml` is committed rather than built in CI, because it is derived entirely from
files that are themselves committed. Run it after anything that changes the number of
photographs, places or stories, or search engines keep being handed last month's list.

```bash
cd functions
npm install
npx jest                     # 321 tests, no credentials needed
npm run gazetteer:build      # rebuild the Kapellen place list
npm run corpus:report        # what the filenames alone yield
npm run map:labels           # street names recovered from the town map PDF
```

## Project Overview

Welcome to the **"Ge zijt van Kapellen als ge ..."** project, an initiative dedicated to preserving and showcasing the rich history and culture of the beautiful town of Kapellen, Belgium. This project originated from a passionate community group and aims to revitalize the existing website, transforming it into an intuitive, responsive, and innovative archive that captures the essence of Kapellen.

### Background

The original website served as a simple image repository, housing a diverse collection of photographs related to Kapellen, including people, streets, schools, hairdressers, and other interesting subjects. However, the current website is outdated, unintuitive, and not responsive, making it challenging for users to navigate and explore the content.

### Project Goals

Our primary objective is to upgrade the website into a quick-accessible archive that is both user-friendly and responsive. We aim to create an engaging platform that allows the community of Kapellen to explore and relive their town's history, fostering a sense of pride and nostalgia.

## Features and Enhancements

- **Intuitive Navigation**: Simplify the navigation to enhance user experience.
- **Responsive Design**: Ensure the website is fully responsive across all devices.
- **Innovative Elements**: Incorporate interactive features to make the browsing experience engaging and informative.

## To-Do List

The project can be followed on the following project overview: [https://github.com/users/DanielSavin2001/projects/4](https://github.com/users/DanielSavin2001/projects/4)

### 1. Finish Index Page

- [ ] **Poem of the Day**: Display a "gedicht van de dag" section to highlight local poetry.
- [x] **Interactive Map**: Integrate a Leaflet map to allow users to explore major groups of pictures, including streets, schools, and other significant locations.
- [ ] **Introductory Text**: Add a welcoming introductory text to set the context for new visitors.

### 2. Create First Detail Page

- [ ] **Load Specific Pictures**: Display pictures relevant to the selected detail page.
- [ ] **Interactive Map**: Consider adding another interactive map specific to the detail page's content.
- [ ] **Page Title**: Include a clear title for the current page to enhance navigation.

### 3. Storage Solution

- [x] **Evaluate Storage Options**: Determine whether to transfer the existing pictures to Amazon S3 or Google Cloud Storage for better scalability and accessibility. => Google Storage for image storing & Firestore as db for metadata and other textual content.

### 4. Citizen Contribution

- [x] **GitHub Projects**: Add a GitHub project to track all issues & PR's, here it would be possible to suggest new features/improvements.
- [x] **Upload zone**: There should be an 'Upload zone' for citizens of Kapellen, so that they can upload new images, suggest where they belong and give extra information related to the images. Or even upload stories, poems and much more ...

### 5. Image Search Engine

- [x] **Normalize image titles**: All the accents, upper/lower cases, and special characters should be removed. => `sharedModels/text.ts`, shared by the frontend and the functions so indexing and querying fold text identically.
- [x] **Image metadata & URL in db**: The image URL will be stored together with all the metadata related to it (Original title, Normalized title, WGS84 coordinates, Tags, ...).
- [ ] **Image is searchable**: At last, the image should be searchable based on normalized title, coordinates, tags and much more...

### 6. Place, street and AI enrichment

- [x] **Kapellen gazetteer**: 121 places generated from a curated seed joined against the 2948-image corpus, so every entry is backed by a real photograph. Coordinates are deliberately empty until they come from OpenStreetMap. => `functions/src/data/kapellen-gazetteer.json`
- [x] **Match photographs to places from their filenames**: tolerates the archive's real spelling (`Kalmhousesteenweg`, `Doprsstraat`, `Kon. Astridlaan`) while refusing the false positives (an inflatable "Springkasteel" is not a castle, `FC Capellen` is not the municipality). Measured: 80.4% of images get a place, 29.1% a street. => `npm run corpus:report` in `functions/`
- [x] **Recover Kapellen's street names from the town map**: `varia-text/plan Kapellen.pdf` is a vector map with live text; 195 street names the archive did not know are staged for human review. => `npm run map:labels`
- [ ] **AI reads the photograph**: street plates, shop signs, house numbers and a Dutch description, for the ~70% of images the filename cannot place.
- [ ] **Coordinates from OpenStreetMap**, so streets can be drawn on the map.
- [ ] **Migrate the historical texts**, starting with the material already in `varia-text/`.

**The full plan, with the measurements behind it, is in [docs/PLAN.md](docs/PLAN.md).**

## How to Contribute

We welcome contributions from the community! Whether you're a developer, designer, or someone with a deep love for Kapellen, your input and support are invaluable. Here are a few ways you can help:

- **Development**: Assist with coding and technical implementation.
- **Design**: Help improve the website's aesthetics and user interface.
- **Content**: Provide additional photos, stories, and historical information about Kapellen.

## Contact Us

If you have any questions or would like to contribute to the project, please reach out to us at [daniel.savin@ds-innovation.dev](mailto:daniel.savin@ds-innovation.dev).

Thank you for your support in preserving the rich history and culture of Kapellen!

## The writing from the old site

The archive was never only photographs. The old gzvka.be carried about 290,000 characters
about them - the history of each castle and church, who kept which café, and a long memoir
of growing up in the Nieuwe Wijk in the eighties - and none of that is recoverable from a
filename.

All 101 pages of the old site are committed under `legacy-site/`, exactly as they were
saved. `npm run stories` reads them and produces:

| File                               | What it is                                                    |
| ---------------------------------- | ------------------------------------------------------------- |
| `static/data/stories.json`         | which stories exist, and which place each belongs to          |
| `static/data/story-photos.json`    | photograph &rarr; story, so a photo page can show its passage |
| `static/data/verhalen/<slug>.json` | one story's full text, fetched only when opened               |

The join to the photographs is the filename: the old pages reference a picture as
`Cafe De Pancras - Marc Brans - 10.04.2014.jpg` and the archive stores that same file under
`Café Pancras/`, so 2,266 of the 3,838 references land on a photograph that is actually
here. Nothing is paraphrased or generated - every sentence on `/verhalen` appears verbatim
in the page named in that story's footer.

The 1,572 references that do not resolve are photographs that exist on the live gzvka.be but
were never added to `src/lib/images/history-images/`. They are listed in
`docs/legacy-missing-photos.txt`, which is the clearest measure of what is still only on the
old server.

## Where the places are

Every street on the map is positioned from the official street register in
`functions/src/data/streets/` — the real centreline of all 444 streets in Kapellen and
Stabroek, with their names. `npm run streets` joins that to the gazetteer by exact name and
writes `static/data/street-geometry.json`, which is what the map draws.

Two rules hold:

- **A coordinate a person placed always wins.** `static/data/place-coordinates.json` is
  never written by a script. The "Straten plaatsen" tool on `/kaart` is still how a castle
  or a wijk gets a position, since the register only knows streets.
- **A name is matched exactly or not at all.** No fuzzy matching against the register: a
  street pinned to the wrong road stays wrong for years without anyone noticing. 28 street
  names exist in both municipalities — Dorpsstraat, Kerkstraat, Antwerpsesteenweg — and
  Kapellen's copy always wins, because merging them put Kapellen's Dorpsstraat halfway to
  Hoevenen.

`docs/streets-not-in-register.md` lists the gazetteer streets today's register has never
heard of. That is the archive's own evidence about which street names are historical.

### The streets with no photographs

The same run writes `static/data/street-register.json`: the 277 streets the register knows
and the archive has never photographed, each with its name, its point and its length. They
get a page at `/straat/<slug>` like any other place — the street on the map, the nearest
places that do hold photographs, and an invitation to send one in, which carries the street
through to `/upload?straat=<slug>`. Without it, four out of five people typing their own
street name got "Geen foto's gevonden. Probeer een straatnaam".

They are deliberately **not** in `sitemap.xml`. They are for the person who types their own
street, not for a crawler to spend its budget on 277 pages without a photograph between
them; `/straten`, which lists them all, is in the sitemap.

## Correcting a photograph

Everything the archive knows about a photograph is worked out from its filename, which is
right about four in five and quietly wrong about the rest. `functions/src/data/photo-corrections.json`
is the one place a person overrules that:

```json
"station-en-omgeving-station-en-nieuwstraat-heemkring-hoghescote-25-01-2018": {
  "places": ["rubensheide"],
  "houseNumber": 144,
  "note": "why this is the right answer",
  "by": "Daniel Savin",
  "on": "2026-08-29"
}
```

The photograph's id is in its URL. `places` replaces what the matcher found rather than
adding to it; `houseNumber`, `year` and `title` override those fields. Re-run
`npm run archive:index` to apply.

Two things the build refuses rather than ignores: a correction naming a place that is not in
the gazetteer, and a correction naming a photograph that is not in the corpus. Either would
mean somebody recorded a fact and the archive silently dropped it, which is worse than a
build failure.

## Folding in the rest of the website

The repository originally held 2,948 photographs; the live gzvka.be showed 1,556 more that
had never been added to it. Those arrived as a flat download in
`src/lib/Legacy-website-images/` and were merged by:

```bash
node scripts/merge-legacy-images.mjs           # report what it would do
node scripts/merge-legacy-images.mjs --apply   # do it
```

It decides where each photograph goes from **the page of the old site that shows it** —
`legacy-site/` holds all 101 pages, so a photograph's subject folder is evidence rather than
a guess. Where a page's photographs are already filed, its folder is learned from them;
where a page had none, a folder named after that page is created. 17 subjects came into the
archive that way, among them Kasteel Oude Gracht, Klein Bos, Kapellenbos and Ertbrandbos.

Anything no page references is **left in the download folder and reported** rather than
filed on a guess. After the merge, 99.9% of the old site's photograph references resolve to
a file in this repository, up from 59%.

Twenty of the downloaded names arrived as UTF-8 read as Latin-1 — `CafÃ© De Vrede`,
`75 jaar BelgiÃ«` — and are repaired on the way in. Left alone they would never have matched
the page that references them.

## Formats

```bash
node scripts/fix-image-formats.mjs --apply
```

57 files were named for one format and held another. They displayed correctly only because
the thumbnail build reads magic bytes rather than trusting the name — but every other tool
trusts the name. GIFs are re-encoded to PNG, which is lossless for a palette image and means
the archive holds no GIFs; everything else is renamed, leaving the bytes untouched, because
re-encoding a PNG to JPEG to satisfy its filename would throw away quality to fix a name.

A photograph's id ignores its extension, so none of this changes a URL.

## Contributing a photograph, and curating what arrives

Anyone can send a photograph in at `/upload` — no account, nothing required but the picture
itself. Asking a seventy-year-old to register before they can contribute a photograph of
their own street is how an archive stays empty. Nothing appears on the site until a curator
has looked at it, which is the other half of the same decision.

A contributor is asked for a title, a year and a description **per photograph**, and for a
name, an email and a general remark once for the batch. What they suggest is never published
as it stands: it prefills the curator's form and is shown verbatim beside it, and only what
the curator saves reaches the site.

Curators work at `/beheer`: sign in with Google, then approve, reject, retitle, describe,
place on a street, set a house number, a year and a donor. Approving publishes immediately —
the photo is served from Cloud Storage and `src/lib/published.ts` merges it into the archive
in the browser, so it is in the search, on its street's page, on the map and on its donor's
page without a rebuild.

The archive it merges into is still the committed index, so the photograph joins the site
before it joins the repository. Fold it in properly by adding the file to
`src/lib/images/history-images/` and re-running `npm run archive:index`; until somebody does,
it lives only in Cloud Storage and Firestore.

**When you fold one in, send its submission back to the queue** — the "Terug naar de
wachtrij" button on `/beheer`. `publishedPhotos` returns every approved submission for as
long as it is approved, so a photograph that is now in the index as well would otherwise
appear twice: two cards on its street's page, two search hits, and a place count one too
high.

Two things an uploaded photograph does not get, and both are worth knowing before a wide
appeal for photographs: **no thumbnail is generated for it**, so the grid serves the
original — a 20 MB scan stays 20 MB — and its link-preview card is that same original rather
than the 1200x630 the sharing sites want. The fix is a resize on approval (the Firebase
Resize Images extension writes the three suffixes beside the original); until then, a handful
of uploads is fine and a hundred is not.

`/beheer` also holds the map desk: every place the archive knows, with where it sits and
where that position came from, and a click to pin it. A pin is stored in Firestore and wins
over `static/data/place-coordinates.json`, so it moves the map at once; the desk's export
button writes the merged set back out as that file, which is how a pin becomes durable.

### What has to be set up once

None of this can be done from the repository; it needs the Firebase console. The order
matters — each step below is blocked by the one above it.

1. **Register a web app.** Project settings → _Your apps_ → the `</>` icon. A Firebase
   project starts with no apps at all, and until one exists there is **no API key and no
   auth domain**, so there is nothing to put in step 6 and sign-in cannot work. Name it
   anything; do _not_ tick "Firebase Hosting" (hosting is already configured here).

2. **Move to the Blaze plan.** Cloud Functions cannot be deployed on Spark — deployment
   goes through Cloud Build and Artifact Registry, which Spark does not include — and on
   projects created since late 2024 the default Cloud Storage bucket needs Blaze too.
   Without it, `/upload` has nowhere to send a photograph and `/beheer` has nothing to
   read. Blaze is pay-as-you-go on top of a free tier this archive sits well inside
   (2M function calls and 5 GB of storage a month), but it does want a card, so set a
   budget alert while you are there. **Authentication itself is free on Spark** — only
   the functions and the bucket force the upgrade.

3. **Enable Google sign-in.** Authentication → Sign-in method → Google → Enable. Two
   fields in that panel block _Save_ until they are filled:

   - **Public-facing name** defaults to something like `project-590536267591`. This is
     the name Google shows on the consent screen — "Sign in to …" — so make it
     `gzvKA fotoarchief`.
   - **Support email** must be picked from the dropdown; it is empty by default and is
     what the red _"Please select an email address"_ is complaining about.

   The web client ID and secret fill themselves in once you save.

4. **Authorise the domains you will sign in from.** Authentication → Settings →
   Authorized domains. `gzvka-12a9f.web.app` and `gzvka-12a9f.firebaseapp.com` are added
   for you, but `gzvka.com` is not, and neither is a PR preview channel like
   `gzvka-12a9f--pr40-….web.app`. There is no wildcard: a domain that is not on this list
   fails the sign-in popup with `auth/unauthorized-domain`.

5. **Add yourself as a curator.** Firestore → create a collection `admins` → add a
   document whose **ID is your email address, lower-cased** (the contents do not matter;
   `{ }` is fine). Adding another curator later is one more document.

6. **Publish the rules, the indexes and the functions**, all of which are in this
   repository:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage:rules
   firebase deploy --only functions
   ```

   `firestore:indexes` is not optional. Both curator queues filter on `status` and order by
   `submittedAt`, and Firestore refuses that pair without a composite index for it. Leave it
   out and `/beheer` answers 500.

   **An index takes a few minutes to build, and the query keeps failing until it is done.**
   A successful deploy is not the same as a usable index: Firestore builds them in the
   background and answers `FAILED_PRECONDITION: ... That index is currently building and
cannot be used yet` in the meantime. Firestore &rarr; Indexes in the console shows
   _Building_ and then _Enabled_; nothing else needs doing.

   ### A note on the Node version

   `functions/package.json` pins `engines.node` to `"22"`, and that is the runtime Firebase
   deploys to rather than a requirement on your machine. Installing with a newer Node prints
   an `EBADENGINE` warning and is harmless. Do not widen it to a range: Firebase reads this
   field to choose a runtime, and it wants one version. Node 18 was decommissioned on
   2025-10-30 and its deploys are refused outright; 20 rather than 22 only moves the same
   problem, since Node 20 reached end of life in April 2026.

7. **Set the client values**, in `.env` locally and as repository secrets under the same
   names for the deploy. Both hosting workflows pass all four through to the build.

   | Name                        | Value for this project                                | Where it comes from                        |
   | --------------------------- | ----------------------------------------------------- | ------------------------------------------ |
   | `VITE_FIREBASE_PROJECT_ID`  | `gzvka-12a9f`                                         | Project settings → General                 |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `gzvka-12a9f.firebaseapp.com`                         | always `<project>.firebaseapp.com`         |
   | `VITE_FIREBASE_API_KEY`     | `AIza…`                                               | the web app from step 1 — **nowhere else** |
   | `VITE_BASE_URL_GF`          | `https://us-central1-gzvka-12a9f.cloudfunctions.net/` | **keep the trailing slash**                |

   Only the API key needs looking up, and only a registered web app has one: Project
   settings → General → Your apps → the app → _SDK setup and configuration_ → _Config_.
   None of the four is a secret — Firebase publishes all of them in every client app, and
   an API key here identifies the project rather than authorising anything. They are
   repository secrets only so the project can be pointed elsewhere without a commit.

Without step 7 the page says so instead of failing in a confusing way.

### How the security actually works

The check that matters is on the server, in `functions/src/services/admin-auth.ts`. It
verifies the Google ID token's signature, audience and expiry, requires the address to be
one Google itself verified, and only then looks it up in `admins`. Hiding a button in the
interface protects nothing; this is what does.

Both `firestore.rules` and `storage.rules` deny browsers everything, with one exception:
`archief/` in Cloud Storage is publicly readable, because that is where approved
photographs live and they are meant to be seen. Pending submissions are not readable by
anyone — a curator views them through a signed URL that expires in an hour.

**Not verified end to end.** There are no Firebase credentials in the environment this was
written in, so the sign-in, the token check, the queue and the storage moves have not been
run against a real project. The logic that can be tested without Firebase is
(24 tests in `functions/src/services/submission.test.ts`, covering validation, the state
machine, the field allowlist and the rule that a contributor's email never reaches the
website). Please try one photograph through the whole path before announcing it.
