# Wat er nu met dit archief zou moeten gebeuren

Geschreven op 31 augustus 2026, na een doorlichting van de hele repository door vijf
onafhankelijke lezers en een die hun bevindingen tegen de code natrok. Elk cijfer hieronder is
zelf geteld, niet overgenomen.

**Waar het archief staat.** 4.504 foto's. Daarvan dragen er **3.890 (86,4 %) geen jaartal** en
hangen er **796 (17,7 %) aan geen enkele plaats**; 3.139 dragen een schenker, verdeeld over 298
namen. De gazetteer kent 131 plaatsen, 45 daarvan straten. De 396 tests draaien in acht
seconden en `svelte-check` geeft nul fouten. Dit is geen slecht gebouwde site — het is een
goede site met een paar gaten op de naden, en die naden zijn waar dit bestand over gaat.

Twee van de gaten zijn tijdens deze doorlichting al gedicht, omdat ze te scherp waren om te
laten liggen; ze staan onderaan onder *Al gedaan*. Wat hier staat is wat er nog ligt, op
volgorde van waarde gedeeld door moeite.

---

## 1. Bladeren op onderwerp — 796 foto's zijn alleen met gokken te vinden

**Wat er mis is.** 796 foto's matchen geen plaats, dus ze staan op geen enkele straatpagina en
niet op de kaart; 560 daarvan dragen ook geen jaartal, dus ze staan ook niet op de tijdlijn.
`docs/fotos-zonder-plaats.md` schrijft de oplossing in zijn eigen woorden — *"Wat ze wél nodig
hebben is een andere ingang: bladeren op onderwerp in plaats van op plaats"* — en die ingang
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
laatste jaar, dus *1966-1967* wordt getoond als 1967. Van de 259 klasfoto's dragen er 107 een
reeks in de naam. Bewaar de reeks — het veld is al tekst — en laat de tijdlijn ze aan het begin
ervan zetten.

**Moeite.** Een dag voor de routes, een tweede voor de klasfoto's.

---

## 2. Een pagina voor elke straat in Kapellen, niet alleen voor de 45 met foto's

**Wat er mis is.** Het meest voorkomende bezoek is iemand die zijn eigen straat intikt, en dat
mislukt meestal. Het archief kent 45 straten. Het officiële register dat al meegeleverd wordt —
`functions/src/data/streets/11023_Kapellen_streets.geojson` — kent er **313**, elk met
coördinaat en lengte. Er zijn er dus **280 zonder foto's, zonder pagina en zonder iets**.

Wie zo'n straat zoekt krijgt: *"Probeer een straatnaam, een deel van een naam, of een jaartal."*
Geen kaart, geen buurstraten, geen uitnodiging. De site spreekt zichzelf zelfs tegen: `/straten`
adverteert de index als lopend *"van de Antwerpsesteenweg tot de Zilverenhoeklaan"*, en de
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
`sitemap.xml`, elk met een deelkaart van 1200×630. Hun titels zijn namen van mensen: *"15000
leden - Annelies Vandenbroek - foto overhandiging"*. Dat is de eigen evenementenfotografie van
de vereniging uit 2014-2021 — levende privépersonen op recente privé-evenementen, op naam
vindbaar via Google. `docs/fotos-zonder-plaats.md` classificeert er 512 van als *"Waarschijnlijk
géén plaats"*.

`/verhaal/einduitslag` publiceerde de eindstand van de fietszoektocht van 2014 als een
genummerde lijst van ongeveer 140 inwoners met hun score. *Dat is inmiddels weggehaald* — zie
*Al gedaan* hieronder — maar in de lopende tekst van diezelfde pagina staan nog wel de namen van
de prijswinnaars van de sponsorvragen. Dat is een ander soort publicatie (de vereniging heeft
het zelf zo aangekondigd) en het is een beslissing van de heemkring, niet van een programmeur.

En: `/contact` belooft *"Staat u ergens op en wilt u dat een foto weggaat, zeg het dan — dat is
geen discussie."* **Er bestaat geen mechanisme dat die belofte kan waarmaken.** De index wordt
opgebouwd uit wat er op schijf staat, dus weghalen betekent vandaag: uit git verwijderen, waar
het in de geschiedenis blijft staan. `/beheer` heeft er geen bureau voor.

**Wat te bouwen.**

1. Een `functions/src/data/suppressed.json`, met foto-id, reden en datum, gelezen door de
   index- én de sitemapbouw. Neem de discipline van `photo-corrections.json` over: die faalt
   luidruchtig op een verouderde regel, en dat is precies wat je wil voor een verwijdering die
   stilletjes gestopt is met werken.
2. Een knop **"Ik sta hierop"** op de fotopagina, naast het bestaande dateringsformulier, en een
   bureau *Verzoeken* op `/beheer` naar het model van de jaartallenwachtrij. De wachtrij, de
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
Android op dorps-4G tikt iemand zijn straat in, drukt op *Zoek*, en de pagina verandert drie
seconden lang niet. Dat leest als kapot.

De helft van deze diagnose staat al in de code zelf, in `src/lib/photo-edits.ts`: *"a cold
function held the whole site behind a third party"* en *"The real fix is for the archive not to
wait on this at all: resolve on the generated index and lay the corrections over it when they
arrive."* Dat was toen de juiste afweging. Nu staat het tussen een bezoeker en een werkende
zoekbalk.

**Wat te bouwen.**

1. Geef `SearchResults` een laadtak: bij een niet-lege zoekterm en een leeg archief een regel
   tekst en een paar lege kaarten, zodat drukken op *Zoek* altijd iets doet. Een half uur.
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

## 6. 396 tests draaien nergens, en drie van de vier Firebase-producten worden met de hand uitgerold

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
Dat is configuratie, geen code. En `swagger-jsdoc` staat in de *dependencies* van de functions,
wordt bij elke uitrol meegestuurd, en wordt nergens gebruikt.

**Wat te bouwen.** Eén `verify`-job waar beide workflows van afhangen: `actions/setup-node@v4`
met npm-cache, dan `npm run check`, `npm --prefix functions test`, en een verouderingscontrole —
`npm run archive:index && git diff --exit-code static/data`. Die laatste kan vandaag al: de
generator reproduceert het gecommitte bestand byte voor byte. Zet er een `concurrency`-blok bij,
en een tweede job die `firebase deploy --only functions,firestore:rules,firestore:indexes,storage:rules`
draait wanneer die bestanden wijzigen. Gooi `swagger-jsdoc` weg. Zet `dependabot.yml` aan — dat
laatste is het stuk dat u overleeft.

**Moeite.** Een halve dag voor de poort, een halve voor de lintconfiguratie.

---

## 7. De leesbaarheidsronde die dit publiek echt nodig heeft, en het ene dat de site niet kan

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
cookiebanner als die nog staat, en de foto ingeperst op `h-[58vh]` — een *schermhoogte*, wat op
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
zodra dat er is: hash de bytes al bij het insturen en toon *"Het archief heeft deze foto al"*
naast een wachtende inzending die matcht — precies wat een brede Facebook-oproep betrouwbaar
oplevert.

**Moeite.** Een halve dag voor het rapport, een dag voor het samenvoegen.

---

# Al gedaan

Twee gaten waren te scherp om te laten liggen en zijn tijdens deze doorlichting gedicht.

**De titeltrimmer at bijschriften op.** Hij liet een laatste segment vallen dat op een
persoonsnaam lijkt — twee woorden met hoofdletters, geen van beide straatvormig — en dat is ook
de vorm van *Garage Meyvis*, *Hotel-Cafe De Zwaan*, *St. Jozefkapel* en *Familie
Bourlet-Luyckx*. 360 foto's werden getoond als een kale straatnaam, met het enige weggehaald wat
de foto over zichzelf zei. En omdat de zoekindex uit de titel werd gebouwd en niet uit de
bestandsnaam, waren die woorden ook onvindbaar: **894 foto's droegen een woord dat nergens meer
te zoeken was**. Wie de garage zocht waar zijn vader werkte, kreeg te horen dat het archief zo'n
foto niet had, terwijl het er een had. De trimmer knipt nu alleen nog een naam weg die het corpus
zelf als schenker kent, en de zoekfunctie leest ook het pad. Nul foto's dragen nog een
onbereikbaar woord, en een test houdt dat zo.

**Een goedgekeurde foto bereikte de website nooit.** `publishedPhotos` was geschreven, uitgerold
en gedocumenteerd als *"what the website merges into the archive"* — en niets in `src/` riep het
ooit aan. Een inwoner stuurde een foto in, een curator besteedde er vijf minuten aan, het bestand
verhuisde naar de publieke map, en de foto verscheen nergens: niet in de zoekfunctie, niet op de
straatpagina, niet op de kaart, niet op de schenkerspagina; zijn eigen URL toonde *"Deze foto
kennen we niet"*. De uploadpagina beloofde een paar dagen en de README beloofde onmiddellijke
publicatie, en allebei beschreven ze een eindpunt dat niemand aanriep. `loadArchive` haalt het nu
op naast de correcties en plakt het eraan.

**En de eindstand van de fietszoektocht van 2014 staat niet meer op de site.** `docs/PLAN.md`
schreef de regel zelf: *"The .xlsx standings files are lists of 146-154 named private
individuals. Do not import them."* Dezelfde lijst kwam alsnog binnen via de opgeslagen webpagina
en werd gepubliceerd — 140 namen met hun score, in de sitemap, op naam vindbaar. 407 regels zijn
er nu uit; de tekst over het evenement is gebleven, want die is goed.

---

# Bewust niet voorgesteld

Dingen die aantrekkelijk lijken en die hier niet thuishoren, met de reden erbij.

**Een volledige rechten- en licentietaxonomie.** De tegenstrijdigheid is echt: de voettekst zegt
*"© gzvKA · Alle rechten voorbehouden"* terwijl `LICENSE` een MIT-licentie op naam van één
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
id's van de inzending al terug en de uploadpagina gooit ze weg. Bewaar ze, toon *"bewaar deze
link"* per foto, en zet er een publieke `submissionStatus` naast die alleen `{status, url?}`
teruggeeft.

**Hervatbare uploads met een voortgangsbalk.** De faalgevallen zijn echt (een heel album in één
verzoek, ruwe platformfouten onder een Nederlandse kop, geen deelsucces). Maar dit optimaliseert
een pad dat tot vorige week nergens heen leidde. Zet nu `countRequest` op `submitPhoto` — één
regel, de begrenzer bestaat al — en kom hierop terug als een echt album ooit mislukt.

**De 1400 px detailafbeeldingen meesturen.** Beide workflows bouwen alleen `thumb` en `social`,
dus de detailweergave valt terug op de thumbnail. Dat is **geen vergissing**: het commentaar in
de workflow noemt de afweging (78 + 280 MB tegen 693 MB, en hosting bewaart elke versie) en de
terugval is bewust. Wat wél de moeite is, is de *prijs* van die terugval: `firebase.json` stuurt
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
