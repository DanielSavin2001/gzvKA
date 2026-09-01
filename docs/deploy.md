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
terminal-icoon rechtsboven).

**Eerst het adres van het service-account opzoeken, niet invullen uit het hoofd.** Het is het
`client_email` uit de JSON-sleutel die in het secret staat. Dit haalt het op uit het project
zelf, en zegt het als het er niet precies één vindt in plaats van door te gaan met een naam die
niet bestaat:

```sh
gcloud config set project gzvka-12a9f

SA=$(gcloud iam service-accounts list --project gzvka-12a9f \
  --filter='email:github-action-*' --format='value(email)')

if [ -z "$SA" ] || [ "$(printf '%s\n' "$SA" | wc -l)" -ne 1 ]; then
  echo "Niet precies één github-action-account gevonden. Alle accounts:"
  gcloud iam service-accounts list --project gzvka-12a9f
else
  echo "Gevonden: $SA"
fi
```

Zegt dat één adres, dan de rollen toekennen:

```sh
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

Gaat dat mis met _"Service account github-action-XXXXXXXX@… does not exist"_, dan is `SA` nog de
letterlijke plaatshouder en is er niets gewijzigd - zoek het adres op met het blok hierboven en
draai de lus opnieuw. Herhalen is ongevaarlijk: een rol die er al staat, wordt gewoon opnieuw
gezet.

Controleren wat het account nu mag:

```sh
gcloud projects get-iam-policy gzvka-12a9f \
  --flatten='bindings[].members' \
  --filter="bindings.members:$SA" \
  --format='value(bindings.role)'
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

### De foutmelding die je krijgt als dit nog niet gebeurd is

Op 1 september 2026 liep de eerste volledige deploy hier vast, en de melding is nuttiger dan
bovenstaande lijst:

```
Error: Missing permissions required for functions deploy. You must have permission
iam.serviceAccounts.ActAs on service account gzvka-12a9f@appspot.gserviceaccount.com.
```

Dat is `iam.serviceAccountUser`, en de melding wijst het precies aan: de functies dráaien als
`gzvka-12a9f@appspot.gserviceaccount.com`, en het deploy-account moet dat account mogen
gebruiken. De lus hierboven geeft die rol op projectniveau, wat volstaat. Wil je hem krabben
tot alleen dat ene account, dan kan dat ook:

```sh
gcloud iam service-accounts add-iam-policy-binding \
  gzvka-12a9f@appspot.gserviceaccount.com \
  --member="serviceAccount:$SA" \
  --role=roles/iam.serviceAccountUser \
  --project gzvka-12a9f
```

**En let op wat er dan wél en niet gebeurd is:** de backend gaat eerst, dus als die faalt worden
_"Build the website"_ en _"Deploy the website"_ overgeslagen en staat de oude site er gewoon nog.
Dat is de bedoeling - zie de kop van de workflow - maar het betekent ook dat er na het geven van
de rollen niets vanzelf gebeurt. Draai de deploy opnieuw met de knop: **Actions → Deploy to
Firebase on merge → Run workflow**, met `everything`.

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
