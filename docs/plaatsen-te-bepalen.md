# Plaatsen die nog op de kaart moeten

Gegenereerd door `node scripts/list-unplaced.mjs`. Niet met de hand aanpassen.

Van de 130 plaatsen met foto's staan er **120** op
de kaart en **10 nog niet**, samen goed voor **212 foto's**.

Het stratenregister heeft elke straat die het kent al geplaatst. Kastelen, bossen,
cafés, kapellen en wijken staan daar niet in, en niets in deze repository kan uitzoeken
waar die liggen: een bestandsnaam bevat geen coördinaten, en deze omgeving mag alleen
GitHub, npm en de Anthropic-API bereiken. OpenStreetMap, Nominatim, Wikipedia en de
Vlaamse geodiensten zijn hier niet bereikbaar - dat is een instelling van de omgeving,
geen keuze.

## Wat we nodig hebben

Per plaats is één van deze genoeg, van precies naar ruw:

1. **Coördinaten** (`51.3125, 4.4295`) - het beste, gaat er meteen in.
2. **Adres** (`Kapelsestraat 45`) - we zetten het dan op die straat.
3. **Omschrijving** (`hoek van X en Y`, `achter het station`) - dan een ruwe plaats.
4. **"Weet ik niet"** - ook een antwoord; dan blijft het van de kaart en verzinnen we niets.

Fijn afstellen kan achteraf op `/?beheer` door op de kaart te klikken.

---

## Wijken en gehuchten

2 plaatsen, 67 foto's. Een ruw middelpunt volstaat hier.

| Foto's | Plaats | Ook bekend als | Wat het archief al zegt | **Ligging (vul aan)** |
| ---: | --- | --- | --- | --- |
| 37 | **Het Klein Bos** | Klein Bos | One photograph is filed under Gemeentepark Beaulieu, so the two may adjoin. Worth confirming before placing. |  |
| 30 | **Ertbrandbos** |  |  |  |

## Kastelen en domeinen

4 plaatsen, 103 foto's. De meeste staan er nog; sommige zijn genoemd naar hun straat.

| Foto's | Plaats | Ook bekend als | Wat het archief al zegt | **Ligging (vul aan)** |
| ---: | --- | --- | --- | --- |
| 59 | **Kasteel Oude Gracht** | Oude Gracht | Filenames place it in Hoogboom ("Hoogboom - Kasteel Oude Gracht"). The corpus also photographs its boothuis, brug and vijver separately. |  |
| 35 | **Kasteel Pannenhuys** | Pannenhuis | District not established by any filename. The alias "Pannenhuis" is the other spelling seen in the corpus. |  |
| 6 | **Kasteel Larikshof** | Villa Larikshof, Larikshof | The folder calls it a kasteel, every filename inside calls it a villa. |  |
| 3 | **Kasteel Ekenhof** | Ekenhof | Fuzzy matching is off: "Ekenhof" is within edit distance of the existing Kasteel Beukenhof, so a fuzzy hit could file a photograph of one under the other. All three filenames spell it exactly, so exact matching loses nothing. |  |

## Gebouwen, cafés, kerken en kapellen

3 plaatsen, 28 foto's. Juist de verdwenen gebouwen zijn het belangrijkst.

| Foto's | Plaats | Ook bekend als | Wat het archief al zegt | **Ligging (vul aan)** |
| ---: | --- | --- | --- | --- |
| 13 | **Villa Eikenhoeve** | Eikenhoeve | Filenames give the address: Hoogboomsteenweg 77 (one says 79), Hoogboom, with an entrance on Jagersdreef. That is enough to place it from the street register rather than by guesswork. |  |
| 9 | **Café De Vrede** | De Vrede | Appears across four different folders, which is what marks it as a real establishment rather than a folder name. Photographed for the Tajje procession of 1976. |  |
| 6 | **Villa Palmaro** | Palmaro | One of the six is a voorontwerp - a design drawing - so the villa may never have been built as drawn. |  |

## Straten

1 plaatsen, 14 foto's. Staan niet in het huidige stratenregister; wellicht hernoemd of verdwenen.

| Foto's | Plaats | Ook bekend als | Wat het archief al zegt | **Ligging (vul aan)** |
| ---: | --- | --- | --- | --- |
| 14 | **Essenhoutstraat** |  | Not in the imported street register, so its geometry has to come from a map click. The photographs are of the Erfgoedcentrum in Hoeve Van Paesschen and of the Smoldersklok. |  |
