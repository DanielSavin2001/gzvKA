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

That is the whole archive: all 2948 photographs, searchable, browsable by street, with the
writing from the old website beside them. The photo index and the stories are generated from
the images and pages in this repository and committed, so it works on a fresh clone with
nothing configured.

`npm run thumbs` converts the 937 MB of originals into web-sized copies under
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
```

```bash
cd functions
npm install
npx jest                     # 204 tests, no credentials needed
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
