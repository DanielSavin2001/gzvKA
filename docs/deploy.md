# Deployen

Alles wat dit project is - de website, de twintig functies, de Firestore-regels, de indexen
en de storage-regels - gaat live via GitHub Actions. Er is geen stap waarvoor je een laptop
met de Firebase CLI nodig hebt.

## Hoe het gaat

**Vanzelf, bij elke merge naar `main`.** De workflow draait de tests, controleert de types,
deployt daarna de _backend_ en pas als die gelukt is de _website_.

Die volgorde is niet willekeurig. De website en de functies die ze aanroept zitten in
dezelfde commit. Deploy je alleen de website, dan staat er een pagina live die een endpoint
aanroept dat niemand gedeployed heeft - precies wat er gebeurde toen de beheerpagina een dag
lang een 500 gaf. Andersom kan niets kapot: gaat de backend mis, dan blijft de oude site
staan, en die praat met de backend waartegen ze gebouwd is.

**Met de hand, zonder laptop.** In de GitHub-app of op github.com:

> **Actions** → **Deploy to Firebase on merge** → **Run workflow**

Daar kies je wat er weg moet:

| Keuze        | Wat er gedeployed wordt                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `everything` | Backend en website. Hetzelfde als een merge.                                                  |
| `backend`    | Alleen de functies, regels en indexen. Slaat het bouwen van de foto's over, dus veel sneller. |
| `hosting`    | Alleen de website.                                                                            |

De tests en de typecontrole draaien altijd, wat je ook kiest.

## Wat er misgaat als de sleutel te weinig mag

De workflow gebruikt één secret, `FIREBASE_SERVICE_ACCOUNT_GZVKA_12A9F`. Dat is de JSON-sleutel
van een service-account, en die had lang genoeg rechten voor hosting alleen. Functies, regels
en indexen vragen meer.

Krijg je in de logs iets als _"Request had insufficient authentication scopes"_, _"Permission
denied"_ of _"missing required permission"_, dan is dit het. De foutmelding noemt zelf de
permissie die ontbreekt - die is het betrouwbaarst, betrouwbaarder dan onderstaande lijst.

Rollen die het nodig heeft, te geven in Cloud Shell (`console.cloud.google.com`, het
terminal-icoon rechtsboven). Vervang `SA` door het `client_email` uit de JSON-sleutel -
meestal `github-action-…@gzvka-12a9f.iam.gserviceaccount.com`:

```sh
gcloud config set project gzvka-12a9f

SA=github-action-XXXXXXXX@gzvka-12a9f.iam.gserviceaccount.com

for ROLE in \
  roles/firebase.developAdmin \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/cloudfunctions.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer \
  roles/cloudbuild.builds.editor \
  roles/serviceusage.serviceUsageConsumer
do
  gcloud projects add-iam-policy-binding gzvka-12a9f \
    --member="serviceAccount:$SA" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done
```

Waarom deze:

- **firebase.developAdmin**, **firebasehosting.admin**, **firebaserules.admin** - de website en
  de regels van Firestore en Storage.
- **datastore.indexAdmin** - de indexen uit `firestore.indexes.json`.
- **cloudfunctions.admin** - de twintig functies aanmaken, bijwerken en verwijderen.
- **iam.serviceAccountUser** - een functie draait _als_ `gzvka-12a9f@appspot.gserviceaccount.com`,
  en iets namens een ander account laten draaien is een recht apart.
- **artifactregistry.writer** en **cloudbuild.builds.editor** - een functie deployen is een
  build; die zet een image in Artifact Registry.
- **serviceUsageConsumer** - de API's aanroepen die daarbij horen.

Dit hoeft één keer. Daarna is deployen een merge, of een knop in de app.

## Wat er nog steeds met de hand moet

Niets aan het deployen. Wel dit, en het is goed om te weten dat het bestaat:

De gegevensbestanden onder `static/data/` worden _gegenereerd_, niet met de hand geschreven,
maar ze worden wel gecommit. Verandert er iets aan de bronbestanden of aan de gazetteer, dan
draai je lokaal in deze volgorde en commit je het resultaat:

```sh
npm run archive:index
npm run stories
npm run streets
npm run plaatsen
npm run sitemap
```

De workflow doet dit expres niet. Een deploy die zijn eigen invoergegevens herschrijft, maakt
van elke deploy een gegevenswijziging die niemand heeft nagekeken - en de plaatsen in dit
archief zijn precies het soort gegeven dat stilletjes fout kan gaan en jaren fout blijft.
