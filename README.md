# Ge zijt van Kapellen als ge ...

![Readme.jpg](src%2Flib%2Fimages%2FReadme.jpg)

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
