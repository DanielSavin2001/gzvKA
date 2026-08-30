# Toen & nu

De schuifbalk staat klaar. De koppels niet, en dat is met opzet.

## Waarom er nog niets in staat

Het effect van een "toen & nu" komt volledig van één ding: de twee foto's moeten
**dezelfde blik** zijn. Iemand gaat staan waar de fotograaf van toen stond, en neemt de
foto opnieuw. Dezelfde hoek, dezelfde hoogte, dezelfde kant van de straat.

Het archief heeft zo'n koppel niet. Wat het wel heeft:

- **Kasteel Irishof** in 1909 vanuit de tuin, en in 2013 vanaf de straat. Hetzelfde
  gebouw, een andere foto. Over elkaar geschoven ziet dat er niet uit als tijd die
  voorbijgaat.
- **De kaartenreeks** (1712, 1777, 1841, 1846, 1892) en de luchtfoto's (1979, 2012,
  2013, 2015). Allemaal Kapellen, maar met een ander kader: de gele speld staat in elke
  kaart op een andere plek in beeld, dus het zijn andere uitsnedes van dezelfde
  gemeente.

Die toch koppelen zou precies het verband verzinnen waar deze pagina op steunt. Dus staat
de lijst leeg en vraagt de pagina om wat ze nodig heeft.

## Een koppel toevoegen

Zoek de twee foto's op de site op en neem hun id uit de URL (`/foto/<id>`). Zet ze in
`static/data/toen-en-nu.json`:

```json
{
	"version": 1,
	"pairs": [
		{
			"then": "dorpsstraat-en-geuzenhoek-doprsstraat-1960-wedyfoto",
			"now": "dorpsstraat-en-geuzenhoek-dorpsstraat-2019",
			"note": "De tram is weg, de gevel links staat er nog."
		}
	]
}
```

`note` mag weg. Een koppel waarvan één van beide foto's niet meer in het archief zit
wordt overgeslagen in plaats van half getekend.

## Waar de "nu"-foto vandaan komt

Uit het archief zelf, dus ook een ingestuurde foto. Wie vandaag met een telefoon naar de
Dorpsstraat gaat en de foto van 1960 nadoet, stuurt hem in via `/upload`; zodra hij is
goedgekeurd staat hij in het archief en kan hij hier gekoppeld worden.
