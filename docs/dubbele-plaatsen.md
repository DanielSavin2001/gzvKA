# Plaatsen die dezelfde foto's bevatten

Geschreven door `npm run plaatsen:dubbel`. Niet met de hand bijwerken: de volgende
run overschrijft dit bestand.

`npm run duplicates` zoekt dubbele *bestanden*. Dit zoekt dubbele *plaatsen*: twee
gazetteer-ingangen waar grotendeels dezelfde foto's onder hangen. Op de kaart zijn
dat twee bollen die hetzelfde laten zien, en een lezer kan niet weten welke hij moet
hebben.

| | |
| --- | ---: |
| Foto's | 4504 |
| Plaatsen met foto's | 131 |
| Eén plaats, twee namen | 5 |
| Nesting (klopt meestal) | 23 |

## Waarschijnlijk één plaats onder twee namen

Hier zit de kleinste vrijwel helemaal in de grootste **en** blijft er van de grootste
nauwelijks iets over als je de kleinste eraf haalt. Dat is geen nesting maar een
dubbele ingang. Kies er één, of hang de ene onder de andere met `parentId`.

| id | Grootste | Kleinste | Samen | Zit erin | Overlap |
| --- | --- | --- | ---: | ---: | ---: |
| `ertbrand` | Ertbrand (62) | Fort van Ertbrand (55) | 55 | 100% | 89% |
| `kalmthoutsesteenweg` | Kalmthoutsesteenweg (62) | Duitse Wijk (49) | 49 | 100% | 79% |
| `heidestraat` | Heidestraat (63) | Chr. Pallemansstraat (49) | 48 | 98% | 75% |
| `nieuwe-wijk` | Nieuwe Wijk (27) | Akkerstraat (21) | 19 | 90% | 66% |
| `nelson-mandelapark` | Nelson Mandelapark (18) | Kasteel San Salvador (17) | 17 | 100% | 94% |

## Nesting

De kleinste zit in de grootste, maar de grootste is veel meer dan de kleinste: een
kasteel in een wijk, een kapel aan een straat. Dat hoort zo. Het staat hier zodat
niemand zich hoeft af te vragen of het nagekeken is.

| id | Grootste | Kleinste | Samen | Zit erin | Overlap |
| --- | --- | --- | ---: | ---: | ---: |
| `hoogboom` | Hoogboom (349) | Hoogboomsteenweg (118) | 112 | 95% | 32% |
| `hoogboom` | Hoogboom (349) | Sint-Jozefkerk (51) | 50 | 98% | 14% |
| `putte-kapellen` | Putte-Kapellen (208) | De Grens (28) | 28 | 100% | 13% |
| `hoogboom` | Hoogboom (349) | Hoogboomkruis (20) | 19 | 95% | 5% |
| `kapellen` | Kapellen (336) | Fort van Kapellen (14) | 14 | 100% | 4% |
| `kapellenbos` | Kapellenbos (54) | Villa De Maretak (12) | 12 | 100% | 22% |
| `hoogboom` | Hoogboom (349) | Kasteel Haezeldonck (11) | 11 | 100% | 3% |
| `nieuwe-wijk` | Nieuwe Wijk (27) | Sint-Jozefkapel (12) | 11 | 92% | 39% |
| `putte-kapellen` | Putte-Kapellen (208) | Kasteel Ravenhof (11) | 11 | 100% | 5% |
| `duitse-wijk` | Duitse Wijk (49) | Home Kindervreugd (9) | 9 | 100% | 18% |
| `kalmthoutsesteenweg` | Kalmthoutsesteenweg (62) | Home Kindervreugd (9) | 9 | 100% | 15% |
| `rubensheide` | Rubensheide (31) | Villa Rozenhof (8) | 8 | 100% | 26% |
| `rubensheide` | Rubensheide (31) | Oude Baan (7) | 7 | 100% | 23% |
| `hoogboom` | Hoogboom (349) | Villa Des Hirondelles (5) | 5 | 100% | 1% |
| `hoogboom` | Hoogboom (349) | Lobelialaan (5) | 5 | 100% | 1% |
| `hoogboomsteenweg` | Hoogboomsteenweg (118) | Villa Des Hirondelles (5) | 5 | 100% | 4% |
| `kasteel-haezeldonck` | Kasteel Haezeldonck (11) | Lobelialaan (5) | 5 | 100% | 45% |
| `koningin-astridlaan` | Kon. Astridlaan (39) | IJzerenweglaan (5) | 5 | 100% | 13% |
| `kapellen` | Kapellen (336) | Poloplein (4) | 4 | 100% | 1% |
| `kasteel-op-den-wal` | Kasteel Op den Wal (41) | Meidoornlaan (4) | 4 | 100% | 10% |
| `antwerpsesteenweg` | Antwerpsesteenweg (131) | Dorpsplein (3) | 3 | 100% | 2% |
| `putte-kapellen` | Putte-Kapellen (208) | Louisastraat (3) | 3 | 100% | 1% |
| `putte-kapellen` | Putte-Kapellen (208) | Driehoek (3) | 3 | 100% | 1% |

