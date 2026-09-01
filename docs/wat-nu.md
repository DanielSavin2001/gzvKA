# Wat er nu met dit archief zou moeten gebeuren

Geschreven op 31 augustus 2026, na een doorlichting van de hele repository door vijf
onafhankelijke lezers en een die hun bevindingen tegen de code natrok. Elk cijfer hieronder is
zelf geteld, niet overgenomen.

**Waar het archief staat.** 4.504 foto's. Daarvan dragen er **3.890 (86,4 %) geen jaartal** en
hangen er **793 (17,6 %) aan geen enkele plaats**; 3.139 dragen een schenker, verdeeld over 298
namen. De gazetteer kent 131 plaatsen, 45 daarvan straten. De 485 tests draaien in tien
seconden en `svelte-check` geeft nul fouten. Dit is geen slecht gebouwde site — het is een
goede site met een paar gaten op de naden, en die naden zijn waar dit bestand over gaat.

> **Nagerekend op 1 september 2026.** Zes lezers hebben elk punt hieronder tegen de code
> gelegd. Wat er veranderd is: 796 zonder plaats was 793 en 560 zonder plaats én jaartal was
> 557; het waren 396 tests en het zijn er 485; punt 6 is gedaan en punt 7 ook. Elk getal dat
> hier nog staat is opnieuw geteld, niet overgeschreven.

Twee van de gaten zijn tijdens deze doorlichting al gedicht, omdat ze te scherp waren om te
laten liggen; ze staan onderaan onder _Al gedaan_. Wat hier staat is wat er nog ligt, op
volgorde van waarde gedeeld door moeite.

---

## 1. ~~Bladeren op onderwerp — 793 foto's zijn alleen met gokken te vinden~~ — HALF GEDAAN

**Wat er mis is.** 793 foto's matchen geen plaats, dus ze staan op geen enkele straatpagina en
niet op de kaart; 557 daarvan dragen ook geen jaartal, dus ze staan ook niet op de tijdlijn.
`docs/fotos-zonder-plaats.md` schrijft de oplossing in zijn eigen woorden — _"Wat ze wél nodig
hebben is een andere ingang: bladeren op onderwerp in plaats van op plaats"_ — en die ingang
bestaat niet.

De helft ervan is al gebouwd en ligt ongebruikt. `archive-index.json` levert al een `subjects`-
lijst van 79 onderwerpen met slug en aantal. Elke foto draagt zijn map in `s`. De fotopagina
begrijpt al `?lijst=onderwerp:<naam>` en loopt zo'n lijst met de pijltjes af. **Maar niets op
de site maakt ooit zo'n link**, en `subjects` wordt alleen door `/beheer` gelezen. Er is geen
`/onderwerp`-route.

De grootste blokken zijn precies wat een oudere inwoner zoekt: 555 Wedstrijden (zie punt 3) en
**204 klasfoto's**. Die klasfoto's zijn de rijkste gestructureerde gegevens in het hele corpus
en er wordt niets mee gedaan: `Broederschool St. Jozef - 1ste leerjaar - 1969-1970 - meester
Dirckx` draagt school, leerjaar én meester.

**Wat te bouwen.** `/onderwerpen` en `/onderwerp/[slug]`, precies zoals `/straten` en
`/straat/[slug]` — routes en een raster, geen nieuwe gegevens, volledig vooraf te renderen. Zet
"Onderwerpen" in de navigatie en maak de regel "Onderwerp" op de fotopagina een link. Geef de
klasfoto's een eigen behandeling: school, leerjaar en meester als drie velden uit de
bestandsnaam, gegroepeerd per school en gesorteerd op schooljaar.

**Eén waarheidsfoutje in dezelfde beweging:** de jaarparser plakt een reeks dicht op het
laatste jaar, dus _1966-1967_ wordt getoond als 1967. Van de 259 klasfoto's dragen er 107 een
reeks in de naam. Bewaar de reeks — het veld is al tekst — en laat de tijdlijn ze aan het begin
ervan zetten.

**Moeite.** Een dag voor de routes, een tweede voor de klasfoto's.

> **Routes gedaan op 1 september 2026. De klasfoto-behandeling niet.**
>
> `/onderwerpen` en `/onderwerp/[slug]` staan er, in het menu en in de sitemap, en de regel
> "Onderwerp" op elke fotopagina is nu een link. De pijltjes lopen de map af: op een klasfoto
> staat "Foto 1 van 259" in plaats van de straat van die foto.
>
> **Niet alle 79 mappen krijgen een pagina, en dat is de belangrijkste beslissing hier.**
> 42 van de 79 slugs zijn óók een plaats-id: `hoevensebaan` is een map van 104 foto's én een
> straat met 128. Twee pagina's, dezelfde naam, twee verschillende getallen — en de kleinste
> heeft geen kaart, geen huisnummers en geen verhalen. In alle 42 gevallen is de
> plaatspagina een superset, dus die is altijd de betere. Blijven over: 37 mappen, 2.705
> foto's, en daar zitten **alle twaalf mappen met plaatsloze foto's** in.
>
> Daarvan is er één achtergehouden: `wedstrijden-gzvka` (555 foto's). Een bladerbare index
> van 555 namen van levende personen is precies waar punt 3 hieronder over gaat, en dat is
> een beslissing van de heemkring. De regel staat in `sharedModels/subject-pages.ts` en het
> weghalen is één regel. Er zijn nu dus 36 pagina's met 2.150 foto's, waarvan er 281 op geen
> enkele kaart staan.
>
> Wat er van dit punt níét gedaan is: de klasfoto's als school + leerjaar + meester
> uitsplitsen. Dat is echt werk — 216 van de 259 zijn met een aliastabel aan een school te
> koppelen, maar zes vallen erbuiten omdat de dubbelmarkering een underscore is
> (`Klasfoto - Irishof_2`) of omdat de schoolnaam als persoonsnaam wordt opgegeten
> (`KTA Technisch Atheneum`).
>
> En de jaartalreeksen: de _lezers_ zijn gerepareerd (zie de commit over `startYear`), maar
> de parser plakt een reeks nog steeds op het laatste jaar. Dat veranderen verplaatst 15
> foto's over een decenniumgrens — negen `1969-1970`-klasfoto's van de jaren 70 naar de
> jaren 60 — en dat is een zichtbare gegevenswijziging die een beslissing verdient.

---

## 2. Een pagina voor elke straat in Kapellen, niet alleen voor de 45 met foto's

**Wat er mis is.** Het meest voorkomende bezoek is iemand die zijn eigen straat intikt, en dat
mislukt meestal. Het archief kent 45 straten. Het officiële register dat al meegeleverd wordt —
`functions/src/data/streets/11023_Kapellen_streets.geojson` — kent er **313**, elk met
coördinaat en lengte. Er zijn er dus **280 zonder foto's, zonder pagina en zonder iets**.

Wie zo'n straat zoekt krijgt: _"Probeer een straatnaam, een deel van een naam, of een jaartal."_
Geen kaart, geen buurstraten, geen uitnodiging. De site spreekt zichzelf zelfs tegen: `/straten`
adverteert de index als lopend _"van de Antwerpsesteenweg tot de Zilverenhoeklaan"_, en de
Zilverenhoeklaan heeft geen pagina.

**Wat te bouwen.** Genereer `static/data/street-register.json` uit de geojson (313 regels, ~20
KB) naast de bestaande stap. Dan: een derde tak op `/straat/[slug]` voor een straat die het
register kent en het archief niet — de naam, zijn plek op de kaart, de vijf dichtstbijzijnde
straten die wél foto's hebben, en één uitnodiging naar `/upload` met de straat al ingevuld. Laat
de zoeksuggesties op het register terugvallen. En zet op `/straten` een tweede lijst met de
straten die nog geen foto hebben — dat is meteen de werklijst voor de vrijwilligers.

Alles vooraf te renderen, dus het kost niets tijdens een bezoek. Wie de Berkenlaan zocht,
vertrekt tenminste met de Hoevensebaan gezien.

**Moeite.** Een dag.

---

## 3. Wat het archief over levende mensen publiceert

**Wat er mis is.** Drie dingen, alle drie nagetrokken.

De map `Wedstrijden GZVKA` bevat **555 foto's**, alle vooraf gerenderd, alle 556 keer in
`sitemap.xml`, elk met een deelkaart van 1200×630. Hun titels zijn namen van mensen: _"15000
leden - Annelies Vandenbroek - foto overhandiging"_. Dat is de eigen evenementenfotografie van
de vereniging uit 2014-2021 — levende privépersonen op recente privé-evenementen, op naam
vindbaar via Google. `docs/fotos-zonder-plaats.md` classificeert er 512 van als _"Waarschijnlijk
géén plaats"_.

`/verhaal/einduitslag` publiceerde de eindstand van de fietszoektocht van 2014 als een
genummerde lijst van ongeveer 140 inwoners met hun score. _Dat is inmiddels weggehaald_ — zie
_Al gedaan_ hieronder — maar in de lopende tekst van diezelfde pagina staan nog wel de namen van
de prijswinnaars van de sponsorvragen. Dat is een ander soort publicatie (de vereniging heeft
het zelf zo aangekondigd) en het is een beslissing van de heemkring, niet van een programmeur.

En: `/contact` belooft _"Staat u ergens op en wilt u dat een foto weggaat, zeg het dan — dat is
geen discussie."_ **Er bestaat geen mechanisme dat die belofte kan waarmaken.** De index wordt
opgebouwd uit wat er op schijf staat, dus weghalen betekent vandaag: uit git verwijderen, waar
het in de geschiedenis blijft staan. `/beheer` heeft er geen bureau voor.

**Wat te bouwen.**

1. Een `functions/src/data/suppressed.json`, met foto-id, reden en datum, gelezen door de
   index- én de sitemapbouw. Neem de discipline van `photo-corrections.json` over: die faalt
   luidruchtig op een verouderde regel, en dat is precies wat je wil voor een verwijdering die
   stilletjes gestopt is met werken.
2. Een knop **"Ik sta hierop"** op de fotopagina, naast het bestaande dateringsformulier, en een
   bureau _Verzoeken_ op `/beheer` naar het model van de jaartallenwachtrij. De wachtrij, de
   snelheidsbegrenzing en de beoordelings-UI bestaan alle drie al.
3. Beslis dan wat er met die 555 wedstrijdfoto's moet gebeuren: een aparte `/vereniging`-sectie
   buiten de sitemap, of laten staan. Dat is een keuze, geen bug — maar hij is nog niet gemaakt.

**Moeite.** Twee dagen. Stap 1 en 2 zijn het echte werk; stap 3 is een gesprek.

---

## 4. De zoekbalk zwijgt tot een Cloud Function antwoordt

**Wat er mis is.** `loadArchive` haalt de gegenereerde index op en wacht dan op de
correctielaag en de goedgekeurde inzendingen voordat iemand iets ziet — twee verzoeken naar
functies die koud kunnen staan, met een grens van drie seconden. En `SearchResults` heeft geen
enkele tak voor "nog aan het laden": bij een leeg archief rendert het niets. Op een oude
Android op dorps-4G tikt iemand zijn straat in, drukt op _Zoek_, en de pagina verandert drie
seconden lang niet. Dat leest als kapot.

De helft van deze diagnose staat al in de code zelf, in `src/lib/photo-edits.ts`: _"a cold
function held the whole site behind a third party"_ en _"The real fix is for the archive not to
wait on this at all: resolve on the generated index and lay the corrections over it when they
arrive."_ Dat was toen de juiste afweging. Nu staat het tussen een bezoeker en een werkende
zoekbalk.

**Wat te bouwen.**

1. Geef `SearchResults` een laadtak: bij een niet-lege zoekterm en een leeg archief een regel
   tekst en een paar lege kaarten, zodat drukken op _Zoek_ altijd iets doet. Een half uur.
2. Splits `loadArchive` in twee antwoorden: meteen op de gegenereerde index, en de overlay via
   een store zodra ze binnen is. De aanroepers zijn er vijf en die verwerken allemaal al dat
   `archive` verandert. De vooraf gerenderde HTML draagt de gecorrigeerde titels al, dus voor
   een eerste weergave en voor een zoekmachine verandert er niets.
3. Twee regels in `firebase.json`: zet `/api/photoEdits`, `/api/placePins` en
   `/api/publishedPhotos` **boven** de `**`-regel en laat de client daarheen wijzen. Dan staan
   ze achter het CDN, waar hun `s-maxage` eindelijk iets doet, en zijn ze same-origin.
4. `MAX_EDITS` staat op 5.000 tegen 4.504 foto's — 90 % vol, en voorbij die grens verdwijnen
   correcties in willekeurige volgorde zonder foutmelding. Verhoog of pagineer, en sorteer.

**Moeite.** Een dag voor alle vier.

> **Nagemeten op 1 september 2026, en de diagnose hierboven klopt niet.**
>
> Stap 1 — `SearchResults` een laadtak geven — is geprobeerd, gemeten en teruggedraaid,
> omdat die tak nooit te zien is. Met de index kunstmatig zes seconden vastgehouden in een
> echte browser: de zoekbalk staat na zes seconden nog steeds leeg, `document` is niet
> gehydrateerd, en `onMount` is dus nooit gelopen. Er is geen moment waarop de pagina wél
> leeft en het archief nog niet binnen is.
>
> De oorzaak is niet `SearchResults` maar `src/routes/+page.js`: `load` wacht op
> `archiveSummary(fetch)`, en die haalt via `loadArchive` het volledige indexbestand van
> 1,1 MB op. SvelteKit draait een universele `load` opnieuw in de browser bij hydratatie en
> rendert de pagina pas als die klaar is. De bezoeker ziet ondertussen de vooraf gerenderde
> HTML — een zoekbalk die er werkt uitziet en niets doet. Twaalf vooraf gerenderde routes
> doen dit.
>
> De echte oplossing is dus stap 2, en groter dan hierboven staat: de gegevens die in de
> HTML moeten staan horen in een `+page.server.js` (die wordt geserialiseerd en niet
> opnieuw gedraaid), niet in een universele `load`. `/straat/[slug]` doet dat al voor zijn
> `entries()`, met `node:fs`. Let op de modulecache in `loadArchive`: die zorgt dat de index
> precies één keer opgehaald wordt tijdens het hele vooraf renderen, en dat is de reden dat
> `build/index.html` hem inline draagt en de andere 4.700 pagina's niet.
>
> Wat er verder van dit punt nagerekend is: `loadArchive` wacht inmiddels op **drie**
> overlays, niet twee (`loadPlaceRecords` is erbij gekomen). `MAX_EDITS` staat op 5.000 en
> de query heeft geen `orderBy`, dus Firestore sorteert impliciet op `__name__` — voorbij de
> grens verdwijnen de alfabetisch laatste foto-id's, wat voorspelbaar is en nog steeds stil.
> En een `/foto/**`-regel die 404 teruggeeft is in `firebase.json` niet te schrijven:
> rewrites hebben geen statuscode en redirects doen alleen 3xx.

---

## 5. Haal het werk van de curatoren terug naar git

**Wat er mis is.** Alles wat een curator sinds de lancering gedaan heeft, staat in Firestore en
nergens anders. Er is geen export: geen `firestore:export`, geen `gcloud firestore`, geen
back-upscript, niets in de workflows. Zeven collecties dragen het (`submissions`, `corrections`,
`photo-edits`, `photo-facts`, `place-pins`, `admins`, `throttle`) plus twee Storage-mappen.

Twee dingen maken dit erger dan een gewone ontbrekende back-up. Ten eerste noemt
`static/data/place-coordinates.json` zichzelf de blijvende neerslag — en het bestand is leeg.
Elke pin die een curator ooit gezet heeft, bestaat alleen in Firestore. (De export-knop die er nu
bij het kaartbureau staat, is de weg terug — maar iemand moet hem indrukken en het bestand
committen.) Ten tweede **faalt de site met opzet zacht**: een leeggelopen project rendert als
een volstrekt gezonde site die op de gegenereerde index draait. Niemand zou het weken merken.

Eén ding is níét in gevaar, en dat is de moeite waard om te weten: het onderzoekswerk aan de
plaatsen staat in `place-approximations.json`, 91 plaatsen met hun klasse en twijfeltekst,
gewoon gecommit.

**Wat te bouwen.** `npm run archive:pull` in `functions/`, een zusje van de bestaande
datascripts die de Admin SDK al gebruiken. Het schrijft vier gecommitte bestanden:
`photo-edits.json`, de `place-coordinates.json` die het commentaar al belooft,
`photo-facts.json`, en een lijst van goedgekeurde inzendingen. Daarna een nachtelijke GitHub
Action die het draait met het bestaande service-account-secret en **een pull request opent als de
bestanden verschillen** — een PR, geen push, zodat de diff het leesbare verslag wordt van wat de
curatoren veranderd hebben. Laat `loadPhotoEdits`, `loadPlacePins` en `loadPublished` dan
starten vanuit het gecommitte bestand en de live-oproep als verversing behandelen; dat haalt
meteen de stille-lege-fout weg.

De echte opbrengst zit voorbij de veiligheid: met de overlays gecommit levert `npm install &&
npm run thumbs && npm run build` op elke machine de volledige site op, zonder Firebase-project.
Dat is het eerlijke antwoord op "wat als de beheerder ermee stopt".

**Moeite.** Anderhalve dag.

---

## 6. ~~396 tests draaien nergens, en drie van de vier Firebase-producten worden met de hand uitgerold~~ — GEDAAN

**Wat er mis is.** Beide workflows doen hetzelfde: uitchecken, secrets zetten, `npm ci`,
`npm run thumbs`, `npm run build`, uitrollen. **Er wordt niets geverifieerd.** Ondertussen
staan er drie groene poorten klaar die niemand doorloopt: `npx jest` in `functions/` is 22 suites
en 396 tests in acht seconden, en `npm run check` geeft nul fouten. Een wijziging die de
inzendingenstroom, de plaatsmatcher of de indexbouw breekt, mergt groen en rolt uit.

Los daarvan: `firebase.json` declareert vier producten — hosting, functions, firestore (regels
én indexen), storage — en **drie ervan worden door niets uitgerold**. De README zegt zelf vetgedrukt
dat `firestore:indexes` niet optioneel is en dat `/beheer` zonder die indexen 500 antwoordt. Die
storing is nu één vergeten commando ver, en de voorkant verbergt hem: een ontbrekende index wordt
een 500, die de overlay stil inslikt tot een lege verzameling.

`npm run lint` kan nog niet aangezet worden: `.eslintrc.cjs` gebruikt het gearchiveerde
`eslint-plugin-svelte3` zonder TypeScript-parser, dus eslint struikelt al op de eerste import.
Dat is configuratie, geen code. En `swagger-jsdoc` staat in de _dependencies_ van de functions,
wordt bij elke uitrol meegestuurd, en wordt nergens gebruikt.

**Wat te bouwen.** Eén `verify`-job waar beide workflows van afhangen: `actions/setup-node@v4`
met npm-cache, dan `npm run check`, `npm --prefix functions test`, en een verouderingscontrole —
`npm run archive:index && git diff --exit-code static/data`. Die laatste kan vandaag al: de
generator reproduceert het gecommitte bestand byte voor byte. Zet er een `concurrency`-blok bij,
en een tweede job die `firebase deploy --only functions,firestore:rules,firestore:indexes,storage:rules`
draait wanneer die bestanden wijzigen. Gooi `swagger-jsdoc` weg. Zet `dependabot.yml` aan — dat
laatste is het stuk dat u overleeft.

**Moeite.** Een halve dag voor de poort, een halve voor de lintconfiguratie.

> **Gedaan op 1 september 2026.** Beide workflows draaien nu eerst `npm test --prefix
functions`, dan `svelte-kit sync && svelte-check` en dan `npm run build --prefix functions`;
> de merge-workflow rolt daarna `functions,firestore,storage` uit en pas dáárna hosting, in
> die volgorde omdat de omgekeerde volgorde een pagina live zet die een endpoint aanroept dat
> niemand uitgerold heeft. Er is ook een `workflow_dispatch` met de keuze
> `everything` / `backend` / `hosting`, zodat opnieuw uitrollen een knop in de GitHub-app is
> in plaats van een laptop. Zie `docs/deploy.md` — dat beschrijft ook de IAM-rollen die de
> sleutel nodig heeft.
>
> Wat er van dit punt níét gedaan is: de verouderingscontrole (`npm run archive:index && git
diff --exit-code static/data`), de lintconfiguratie, `swagger-jsdoc` weggooien en
> `dependabot.yml`. De verouderingscontrole is het waardevolste stuk dat nog ligt: CI
> regenereert `static/data` en `sitemap.xml` niet, dus een gecommit indexbestand kan
> achterlopen op de bron zonder dat iets dat merkt.

---

## 7. ~~De leesbaarheidsronde die dit publiek echt nodig heeft, en het ene dat de site niet kan~~ — GEDAAN

**Wat er mis is.** Kleine dingen die allemaal bij dezelfde zeventigjarige uitkomen.

Het contrast klopt net niet, en dat is nagerekend: `text-gray-500` (#6b7280) op de papierkleur
#f7f4ec meet **4,40:1** — onder de norm van 4,5. Dezelfde kleur op wit haalt 4,83; de warme
ondergrond heeft dit veroorzaakt. `text-gray-600` haalt 6,88. Het staat in 24 componenten buiten
`/beheer` en het draagt juist wat deze bezoeker nodig heeft: het aantal foto's naast elke straat,
de teller "Foto 12 van 216", de onderwerpsregel onder elke kaart. Donkere modus is in orde.

Daarnaast: de decennialabels op de tijdlijn staan op `text-[10px]` — de belangrijkste navigatie
door de tijd, op tien pixels. `app.html` zet een viewport zonder `initial-scale=1`. De rijen in
de plaatslijst zijn ongeveer 36 px hoog, en dat is op een telefoon de hoofdingang van het archief.
En er is wel een `<main>`, maar geen skip-link en geen `id` erop, dus het element dat bestaat om
de kop over te slaan, is niet over te slaan.

En het ene dat de site helemaal niet kan: **afdrukken.** Er is precies één `@media print`-regel
en die zet de papierkorrel uit. Een fotopagina afdrukken levert vandaag de plakkende kop met drie
uitklapmenu's, de kruimelbalk, de knoppen Bewaren en Delen, het dateringsformulier, de
cookiebanner als die nog staat, en de foto ingeperst op `h-[58vh]` — een _schermhoogte_, wat op
papier een fractie van het blad is. Voor een heemkring waarvan de leden afdrukken meebrengen naar
de vergadering en opsturen naar een zus in Canada, is dat een echt gemis.

**Wat te bouwen.** Eén ronde: `text-gray-500` → `text-gray-600` waar het op de paginakleur staat;
tijdlijnlabels naar `text-xs`; `initial-scale=1`; een skip-link met `id="inhoud"` op `<main>`;
lijstrijen naar 44 px. Dan één afdrukstijlblad: kop, voet, cookiebanner, kruimels, knoppen en
formulier verbergen; de foto uit zijn schermhoogte laten; titel, plaats, jaartal, schenker en
beschrijving eronder zetten; de URL eraan plakken met een `::after`. En een knop **Afdrukken**
naast Bewaren en Delen, want niemand vindt het printmenu op een telefoon. Zet er een
contrasttest bij, zodat een volgende kleurwijziging dit niet stil terugbreekt.

**Moeite.** Een dag voor beide helften.

> **Gedaan op 1 september 2026, met drie correcties op wat hierboven staat.**
>
> De contrastcijfers klopten, maar de lijst niet. Buiten `/beheer` staan 50 regels
> `text-gray-500`, niet "24 componenten": 26 daarvan staan op de papierkleur en zijn
> aangepast, 24 staan op een witte of grijze kaart en halen 4,63 tot 4,83 — die zijn met
> opzet blijven staan, want ze blind meenemen haalt de hiërarchie tussen titel en bijschrift
> weg. Het voorbeeld dat hierboven genoemd wordt, "de onderwerpsregel onder elke kaart", is
> juist een van die 24: `PhotoCard` heeft `bg-white`.
>
> Wat hierboven ontbrak en het ergste was: de voettekst zette twee regels — "Met dank aan" en
> de copyrightregel — in `text-gray-400 dark:text-gray-500`. Dat is **2,54:1 in de lichte
> modus en 3,67:1 in de donkere**, het slechtste contrast op de hele site, en in beide
> thema's tegelijk. "Donkere modus is in orde" gold dus niet.
>
> En er zijn twee regels van tien pixels op de tijdlijn, niet één: het decenniumlabel én de
> teller erboven.
>
> Verder: `initial-scale=1`, een skip-link naar `<main id="inhoud" tabindex="-1">` (die
> `tabindex` is nodig, anders verspringt de focus in Safari niet), lijstrijen op precies
> 44 px, en een afdrukblad voor de fotopagina met een knop **Afdrukken** ernaast. Nagekeken in
> een echte browser met `emulateMedia('print')`: kop, kruimelpad, knoppen, dateringsformulier,
> voettekst, pijlen en de miniaturen ernaast verdwijnen allemaal, de foto komt uit zijn
> `64vh`-kader, en de URL komt onder de titel te staan.
>
> `sharedModels/contrast.ts` rekent het uit en `functions/src/data/contrast.test.ts` houdt het
> vast — inclusief één regel die over alle ondergronden van deze site waar is en dus over de
> echte bestanden te controleren valt: geen `text-gray-400` in de lichte modus, want die faalt
> op papier (2,31), op wit (2,54) en op paper-base (2,41).

---

## 8. 314 groepen identieke foto's

**Wat er mis is.** Niets in deze repository vergelijkt ooit twee afbeeldingen. Een md5 over alle
4.504 bestanden geeft **314 hashes die meer dan één keer voorkomen, over 656 bestanden** — 342
records die een kopie zijn van een record dat er al staat.

De prijs wordt al betaald. Correcties hangen aan een id, dus iemand die 1957 voorstelt bij de ene
kopie repareert de andere niet, en het dateringsbureau vraagt een curator twee keer hetzelfde
jaartal. Elke plaatsteller is met datzelfde aantal opgeblazen, en de kop "4.504 foto's" telt 342
kopieën mee.

Eén structureel geval is zichtbaar zonder enige hash: **`mastenbos` en `loopgravenpad` zijn
dezelfde 173 foto's**, allebei volledig uit de map "Mastenbos en Loopgravenpad". Elk van die
foto's wordt dubbel geteld en dubbel op de kaart gezet.

**Wat te bouwen.** Een `npm run duplicates` die meelift op de bestaande thumbnailronde — die
decodeert elk bestand toch al — en per bestand een sha256 en een perceptuele hash schrijft.
Rapport in de vorm van `docs/fotos-zonder-plaats.md`, met per groep de tegenstrijdige jaartallen
en plaatsen. Daarna een `merge`-regel in `photo-corrections.json` die één id als de echte
aanwijst en de andere als alias; de bouw laat de alias weg en `/foto/<alias>` stuurt door. En
zodra dat er is: hash de bytes al bij het insturen en toon _"Het archief heeft deze foto al"_
naast een wachtende inzending die matcht — precies wat een brede Facebook-oproep betrouwbaar
oplevert.

**Moeite.** Een halve dag voor het rapport, een dag voor het samenvoegen.

> **Rapport gedaan op 1 september 2026. Eén helft van dit punt klopt, de andere niet.**
>
> `npm run duplicates` bestaat en schrijft `docs/dubbele-fotos.md`. De telling hierboven is
> exact: **314 groepen over 656 bestanden, 342 records te veel**. Wat het rapport eraan
> toevoegt is welk deel daarvan de moeite waard is. De grootste groepen zitten volledig in
> _Wedstrijden GZVKA_ en zijn sponsorlogo's — hetzelfde bestand bij zes wedstrijden, geen
> foto van Kapellen die twee keer bestaat. Dat is 54 groepen. Het echte werk zijn de **251
> groepen die niets met die map te maken hebben**, waarvan er **119 het oneens zijn over de
> plaats**: dezelfde opname op twee straatpagina's, twee keer geteld op de kaart.
>
> **Maar het mastenbos-verhaal hierboven klopt niet, en het is goed dat er niets aan
> veranderd is.** Er zijn geen 173 dubbele bestanden: het zijn 173 verschillende foto's,
> waarvan er één record elk twee plaats-id's draagt. En dat is waarschijnlijk terecht.
> Alle 173 bestandsnamen bevatten _allebei_ de woorden, en het onderzoek in dit archief zegt
> het zelf, bij `loopgravenpad`: _"Bestaat wél, als wandelpad (highway=path) door het
> Mastenbos."_ Een pad dat door een bos loopt ligt in dat bos. De twee spelden staan 870 m
> uit elkaar omdat de ene het zwaartepunt van het bos is en de andere een punt op het pad —
> niet omdat het twee plaatsen zijn waar een foto tussen moet kiezen.
>
> Hetzelfde geldt voor _Dorpsstraat en Geuzenhoek_: 215 foto's, allemaal met beide id's, en
> de twee punten liggen **231 m** uit elkaar — binnen de twijfelcirkel van 250 m die het
> onderzoek zelf om de Geuzenhoek legt.
>
> Wat er dan wél aan de hand is, is smaller en is een vraag voor de heemkring, geen bug:
> beide plaatspagina's tonen alle 215 respectievelijk 173 foto's, dus de teller zegt "215
> foto's van de Dorpsstraat" waar een deel ervan van het Geuzenhoek-eind is. Of dat erg is,
> weet alleen iemand die Kapellen kent.
>
> Zeven mappen geven meer dan één plaats aan al hun foto's. Vijf ervan zijn onbetwist juist
> — _Fort van Ertbrand_ → `ertbrand + fort-van-ertbrand`, _Kasteel San Salvador - Nelson
> Mandelapark_, _Villa De Maretak - Kapellenbos_. Een regel die op "twee of meer plaatsen"
> zou afgaan, haalt die dus ook onderuit.

---

# Al gedaan

Twee gaten waren te scherp om te laten liggen en zijn tijdens deze doorlichting gedicht.

**De titeltrimmer at bijschriften op.** Hij liet een laatste segment vallen dat op een
persoonsnaam lijkt — twee woorden met hoofdletters, geen van beide straatvormig — en dat is ook
de vorm van _Garage Meyvis_, _Hotel-Cafe De Zwaan_, _St. Jozefkapel_ en _Familie
Bourlet-Luyckx_. 360 foto's werden getoond als een kale straatnaam, met het enige weggehaald wat
de foto over zichzelf zei. En omdat de zoekindex uit de titel werd gebouwd en niet uit de
bestandsnaam, waren die woorden ook onvindbaar: **894 foto's droegen een woord dat nergens meer
te zoeken was**. Wie de garage zocht waar zijn vader werkte, kreeg te horen dat het archief zo'n
foto niet had, terwijl het er een had.

De trimmer knipt nu alleen nog een naam weg die het corpus zelf als schenker kent — een naam
waaronder niemand ooit een foto schonk is een bijschrift. Daaronder zat nog een oudere fout:
als een bestandsnaam _z.n._ zegt (schenker onbekend) nam de parser het segment ervóór alsnog
als schenker en gooide het daarna weg, omdat diezelfde functie al had vastgesteld dat de
schenker onbekend is — zo verloor _Nieuwe Wijk - St. Jozefkapel - zn - zd_ de kapel uit zijn
titel én uit alles wat daaruit volgt.

Voor wat de trimmer terecht weglaat draagt elke foto nu een veld `k`: de woorden uit het pad
die geen enkel ander veld draagt, mét de datum van schenking, de bestandsextensie en alle
kale getallen eruit. Dat laatste is niet vrijblijvend — de eerste versie indexeerde gewoon
het hele pad, en toen antwoordde _"2015"_ met de 602 foto's die dát jaar geschonken waren in
plaats van de 36 die erin genomen zijn. Nul foto's dragen nog een onbereikbaar woord, en twee
tests houden allebei de helften vast.

**Een goedgekeurde foto bereikte de website nooit.** `publishedPhotos` was geschreven, uitgerold
en gedocumenteerd als _"what the website merges into the archive"_ — en niets in `src/` riep het
ooit aan. Een inwoner stuurde een foto in, een curator besteedde er vijf minuten aan, het bestand
verhuisde naar de publieke map, en de foto verscheen nergens: niet in de zoekfunctie, niet op de
straatpagina, niet op de kaart, niet op de schenkerspagina; zijn eigen URL toonde _"Deze foto
kennen we niet"_. De uploadpagina beloofde een paar dagen en de README beloofde onmiddellijke
publicatie, en allebei beschreven ze een eindpunt dat niemand aanriep. `loadArchive` haalt het nu
op naast de correcties en plakt het eraan.

**En de eindstand van de fietszoektocht van 2014 staat niet meer op de site.** `docs/PLAN.md`
schreef de regel zelf: _"The .xlsx standings files are lists of 146-154 named private
individuals. Do not import them."_ Dezelfde lijst kwam alsnog binnen via de opgeslagen webpagina
en werd gepubliceerd — 140 namen met hun score, in de sitemap, op naam vindbaar. 407 regels zijn
er nu uit; de tekst over het evenement is gebleven, want die is goed.

---

# Bewust niet voorgesteld

Dingen die aantrekkelijk lijken en die hier niet thuishoren, met de reden erbij.

**Een volledige rechten- en licentietaxonomie.** De tegenstrijdigheid is echt: de voettekst zegt
_"© gzvKA · Alle rechten voorbehouden"_ terwijl `LICENSE` een MIT-licentie op naam van één
persoon is en alle 4.504 foto's in diezelfde repository staan; 69 bestanden crediteren Hoelen, 58
Onroerend Erfgoed. Maar een gesloten rechtenvocabulaire per foto is een catalogiseerproject
waarover de heemkring moet beslissen, en het zou op 4.504 records leeg blijven staan. **Doe de
versie van tien minuten:** een `LICENSE-PHOTOS.md` die de fotomap uit de MIT-licentie haalt, en
een voettekstregel waar u achter kunt staan. Laat de taxonomie tot iemand beslist heeft wat ze
moet zeggen.

**Blijvende inventarisnummers (`KAP-00001`).** De onderliggende fout bestaat: foto-ids worden op
80 tekens afgekapt, en 44 afgekapte namen botsen over 205 foto's, uit elkaar gehouden door een
volgnummer in sorteervolgorde. Een nieuw bestand dat eerder sorteert, hernummert dus stilletjes
bestaande URL's. Maar een inventarisschema invoeren is een grote verandering aan identiteit voor
een klein, sluimerend risico. **Neem de goedkope helft:** maak van dat volgnummer een korte hash
van de inhoud, dan hangt een botsing nooit meer van de sorteervolgorde af. Tien regels.

**Bulkbewerking in `/beheer`.** De analyse klopt — er is geen batch-id en de wachtrij is één
volledig formulier per foto — maar het volume dat dat rechtvaardigt bestaat nog niet, juist omdát
goedgekeurde foto's tot vandaag nergens uitkwamen. Bouw dit wanneer de wachtrij echt pijn doet.

**E-mail in beide richtingen.** Werkelijk afwezig, en de diagnose klopt: een inzender hoort
nooit iets terug en een curator hoort nooit dat er iets binnen is. Maar het vraagt een extensie,
een besluit over wie er mailt en een schema. **Eén plak is bijna gratis:** de functie geeft de
id's van de inzending al terug en de uploadpagina gooit ze weg. Bewaar ze, toon _"bewaar deze
link"_ per foto, en zet er een publieke `submissionStatus` naast die alleen `{status, url?}`
teruggeeft.

**Hervatbare uploads met een voortgangsbalk.** De faalgevallen zijn echt (een heel album in één
verzoek, ruwe platformfouten onder een Nederlandse kop, geen deelsucces). Maar dit optimaliseert
een pad dat tot vorige week nergens heen leidde. Zet nu `countRequest` op `submitPhoto` — één
regel, de begrenzer bestaat al — en kom hierop terug als een echt album ooit mislukt.

**De 1400 px detailafbeeldingen meesturen.** Beide workflows bouwen alleen `thumb` en `social`,
dus de detailweergave valt terug op de thumbnail. Dat is **geen vergissing**: het commentaar in
de workflow noemt de afweging (78 + 280 MB tegen 693 MB, en hosting bewaart elke versie) en de
terugval is bewust. Wat wél de moeite is, is de _prijs_ van die terugval: `firebase.json` stuurt
`**` naar `/200.html`, dus een ontbrekende variant geeft **200 OK met 2.895 bytes HTML** die de
browser downloadt, niet kan decoderen, en dan pas opnieuw probeert — twee verzoeken per bekeken
foto, onzichtbaar in elk logboek omdat het een 200 is. Geef `/foto/**` een eigen regel die 404
teruggeeft.

**De sprong naar SvelteKit 2 en Svelte 5.** De achterstand groeit, maar dit is meerdaags werk
waarvan het enige vangnet de 396 tests en `svelte-check` zijn — en die draaien vandaag geen van
beide in CI. Doe punt 6 eerst. Dan wordt dit een beheersbaar weekend in plaats van een sprong.

**Een bewaarplan, herscannen, en deponeren bij meemoo of de provincie.** De meting eronder is
ontnuchterend en klopt: het corpus is webafgeleide, geen scans, en een derde ervan is van de oude
gzvka.be gedownload. De vraag wie hier de bewaarder van is — een persoonlijk GitHub-account, 1,4
GB `.git` — is een echte. Maar bijna niets ervan is programmeerwerk, en de stukken die dat wél
zijn (een `docs/manifest.sha256`, een integriteitscontrole) horen bij punt 8. **Schrijf de
eerlijke versie van twee alinea's** wanneer u daaraan begint: waar de enige kopie staat, wat de
resolutie werkelijk is, wat er verloren zou gaan — en laat de heemkring dán beslissen.

**Een Dublin Core- of OAI-PMH-export.** Juiste conclusie, verkeerde decennium. Er is nog niets
dat het kan consumeren, en de metadata die geëxporteerd zou worden is precies de metadata die de
punten 1, 3 en 8 gaan veranderen.
