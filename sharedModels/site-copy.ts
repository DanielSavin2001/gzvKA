/**
 * The words on the site, and which of them a curator may rewrite.
 *
 * Everything a visitor reads that is not a photograph's own title or description used to be
 * written into a Svelte component and changeable only by a commit and a deploy - which means
 * only by a developer. For an archive run by two volunteers that is a real limit, and it has
 * already cost something: the timeline has been telling readers its newest photographs are
 * "tot vorig jaar" for seven years, because nobody who noticed could fix it.
 *
 * So each standing sentence gets an id and lives here. The page renders the stored text when
 * there is one and the text below when there is not, so:
 *
 *   - a fresh clone with no Firebase project reads exactly as it always did;
 *   - the prerendered HTML - which is what a search engine and a cold load get - still
 *     carries real words rather than an empty shell;
 *   - and a curator's rewrite appears on the live site without a deploy, the same way a
 *     corrected photograph caption already does.
 *
 * ## What is here and what is not
 *
 * Only standing prose: headings, introductions, explanations, the notes under a form. Not
 * button labels, not field names, not error messages - those change when the feature changes,
 * and a curator rewording "Opslaan" mid-flow is a way to break a page rather than to improve
 * one. Not anything with markup in it either: a sentence carrying a link or a `<code>` span
 * stays in the component, because a text box is the wrong shape for it and pasting HTML into
 * one is how a content system starts producing broken pages.
 *
 * The fallback below is the whole of the text as it shipped. Keeping it here rather than in
 * the component is what lets the curator's page show "this is what it said originally" next
 * to the box, and what makes reverting one sentence a button rather than an archaeology
 * expedition.
 */

/** Which kind of thing a slot is, which decides how long it may be and how it is edited. */
export type CopyKind = 'heading' | 'text';

export interface CopySlot {
	/**
	 * Stable id, `<page>.<what>` - "index" for the home page, whose path has no name in it.
	 *
	 * Never reused for different words: it is a database key, and reusing one would silently
	 * retitle a sentence somewhere else the next time a curator saved.
	 */
	id: string;
	/** The route it appears on, for grouping on the curator's page. */
	page: string;
	/** What the curator's page calls it. */
	label: string;
	kind: CopyKind;
	/** The words as the site shipped them, and the answer whenever nothing is stored. */
	fallback: string;
}

/**
 * How long a curator's text may be.
 *
 * A heading that wraps to four lines breaks the page it is on, and an introduction longer
 * than this is an article - which is what the stories are for. Generous rather than tight:
 * the point is to stop an accident, not to police the writing.
 */
export const COPY_LIMITS: Record<CopyKind, number> = { heading: 160, text: 2000 };

/**
 * Every rewritable sentence on the site.
 *
 * The punctuation here is the punctuation the components rendered, character for character:
 * a straight apostrophe where they had one, a real em dash where they wrote `&mdash;`, real
 * curly quotes where they wrote `&ldquo;`. That is checked rather than assumed - the
 * conversion was verified by diffing the prerendered text of every page before and after,
 * and it was this that the diff caught. Typography is a separate decision from who may edit
 * the words, and making both at once would have hidden one inside the other.
 *
 * Grouped by page and in reading order, because that is the order the curator's page shows
 * them in and the order somebody checking their work will read them.
 */
export const COPY_SLOTS: CopySlot[] = [
	{
		id: 'index.title',
		page: '/',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Het fotoarchief van Kapellen'
	},
	{
		id: 'index.straten-kop',
		page: '/',
		label: 'Kop: straten',
		kind: 'heading',
		fallback: 'Straten van Kapellen'
	},
	{
		id: 'index.gebieden-kop',
		page: '/',
		label: 'Kop: kastelen en wijken',
		kind: 'heading',
		fallback: 'Kastelen, wijken en gehuchten'
	},
	{
		id: 'tijdlijn.title',
		page: '/tijdlijn',
		label: 'Titel',
		kind: 'heading',
		fallback: 'De tijdlijn van Kapellen'
	},
	{
		id: 'tijdlijn.intro',
		page: '/tijdlijn',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'Van de topografische kaart van 1841 tot vorig jaar. Klik een balk om naar dat decennium te springen.'
	},
	{
		id: 'contact.title',
		page: '/contact',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Contact'
	},
	{
		id: 'contact.intro',
		page: '/contact',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'Het meeste wat mensen ons willen zeggen, gaat over \u00e9\u00e9n van deze twee dingen. Voor allebei hoeft u niets aan te maken en niemand te mailen.'
	},
	{
		id: 'contact.foto-kop',
		page: '/contact',
		label: 'Kop: ik heb een foto',
		kind: 'heading',
		fallback: 'Ik heb een foto'
	},
	{
		id: 'contact.foto',
		page: '/contact',
		label: 'Ik heb een foto',
		kind: 'text',
		fallback:
			'Van uw straat, uw school, het caf\u00e9 op de hoek. U hoeft geen account te maken en niets in te vullen behalve de foto zelf. Iemand van het archief bekijkt ze voor ze online komt.'
	},
	{
		id: 'contact.fout-kop',
		page: '/contact',
		label: 'Kop: er staat iets fout',
		kind: 'heading',
		fallback: 'Er staat iets fout'
	},
	{
		id: 'contact.fout',
		page: '/contact',
		label: 'Er staat iets fout',
		kind: 'text',
		fallback:
			'Een plek op de verkeerde spot, een naam die niet klopt. Waar we het zelf niet zeker weten staat op de kaart een rode cirkel met de reden erbij, en een knop om het recht te zetten.'
	},
	{
		id: 'privacy.title',
		page: '/privacy',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Privacy en cookies'
	},
	{
		id: 'privacy.bezoekcijfers-kop',
		page: '/privacy',
		label: 'Kop: bezoekcijfers',
		kind: 'heading',
		fallback: 'Bezoekcijfers'
	},
	{
		id: 'privacy.bezoekcijfers',
		page: '/privacy',
		label: 'Bezoekcijfers',
		kind: 'text',
		fallback:
			'We tellen graag hoeveel mensen het archief bezoeken en welke foto\u0027s gezocht worden, zodat we weten waar we aan verder moeten werken. Dat gebeurt met Google Analytics.'
	},
	{
		id: 'privacy.gemeten',
		page: '/privacy',
		label: 'Wat er gemeten wordt',
		kind: 'text',
		fallback:
			'Wat er gemeten wordt als u ja zegt: welke pagina\u0027s bezocht worden, uit welk land of welke streek ongeveer, en op wat voor toestel. Geen naam, geen account, en niets dat we aan een persoon kunnen koppelen.'
	},
	{
		id: 'verhalen.title',
		page: '/verhalen',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Verhalen uit Kapellen'
	},
	{
		id: 'verhalen.intro',
		page: '/verhalen',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'Bij de foto\u0027s hoort een verhaal. Deze teksten stonden op de oude website en zijn hier bewaard: de geschiedenis van de kastelen, de caf\u00e9s en de straten, en de herinneringen van wie er opgroeide.'
	},
	{
		id: 'verhalen.leeg',
		page: '/verhalen',
		label: 'Als er nog niets is',
		kind: 'text',
		fallback: 'Er zijn nog geen verhalen.'
	},
	{
		id: 'onderwerpen.title',
		page: '/onderwerpen',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Onderwerpen'
	},
	{
		id: 'onderwerpen.intro',
		page: '/onderwerpen',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'Niet elke foto hoort bij een straat. Een klasfoto hoort bij een school, een processie bij een feest. Dit is de ingang voor alles wat op de kaart niet te vinden is.'
	},
	{
		id: 'straten.title',
		page: '/straten',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Straten en pleinen van Kapellen'
	},
	{
		id: 'straten.intro',
		page: '/straten',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'Elke straat en elk plein waar het archief foto\u0027s van heeft, met hoeveel er zijn.'
	},
	{
		id: 'straten.alle-kop',
		page: '/straten',
		label: 'Kop: alle straten',
		kind: 'heading',
		fallback: 'Alle straten op een rij'
	},
	{
		id: 'straten.ontbreken-kop',
		page: '/straten',
		label: 'Kop: straten zonder foto',
		kind: 'heading',
		fallback: 'Straten waar we nog niets van hebben'
	},
	{
		id: 'kastelen.title',
		page: '/kastelen',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Kastelen, forten en domeinen'
	},
	{
		id: 'kastelen.intro',
		page: '/kastelen',
		label: 'Inleiding',
		kind: 'text',
		fallback: 'De kastelen, forten en landgoederen van Kapellen en omgeving.'
	},
	{
		id: 'kastelen.alle-kop',
		page: '/kastelen',
		label: 'Kop: alle kastelen',
		kind: 'heading',
		fallback: 'Alle kastelen op een rij'
	},
	{
		id: 'wijken.title',
		page: '/wijken',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Wijken, gebouwen en parken'
	},
	{
		id: 'wijken.intro',
		page: '/wijken',
		label: 'Inleiding',
		kind: 'text',
		fallback: 'Wijken en gehuchten, kerken en scholen, caf\u00e9s, bossen en parken.'
	},
	{
		id: 'wijken.alle-kop',
		page: '/wijken',
		label: 'Kop: alle plaatsen',
		kind: 'heading',
		fallback: 'Alle plaatsen op een rij'
	},
	{
		id: 'over-ons.title',
		page: '/over-ons',
		label: 'Titel',
		kind: 'heading',
		fallback: 'Over dit archief'
	},
	{
		id: 'over-ons.intro',
		page: '/over-ons',
		label: 'Inleiding',
		kind: 'text',
		fallback:
			'\u201cGe zijt van Kapellen als ge \u2026\u201d begon als een verzameling foto\u0027s van Kapellen: mensen, straten, scholen, caf\u00e9s, kapellen en kastelen. Wat er stond was waardevol, maar het was een opslagplaats meer dan een archief \u2014 moeilijk doorzoekbaar, en niet te gebruiken op een telefoon.'
	},
	{
		id: 'over-ons.teksten-kop',
		page: '/over-ons',
		label: 'Kop: de teksten',
		kind: 'heading',
		fallback: 'De teksten'
	},
	{
		id: 'over-ons.teksten',
		page: '/over-ons',
		label: 'De teksten',
		kind: 'text',
		fallback:
			'Het archief was nooit alleen foto\u0027s. De oude website droeg ongeveer 290.000 tekens aan verhalen mee: de geschiedenis van elk kasteel en elke kerk, wie welk caf\u00e9 hield, en een lange herinnering aan opgroeien in de Nieuwe Wijk in de jaren tachtig. Alle 101 pagina\u0027s zijn bewaard en staan nu naast de foto\u0027s waar ze over gaan.'
	},
	{
		id: 'over-ons.kaart-kop',
		page: '/over-ons',
		label: 'Kop: de kaart',
		kind: 'heading',
		fallback: 'De kaart'
	},
	{
		id: 'over-ons.kaart-register',
		page: '/over-ons',
		label: 'De kaart: waar de plaatsen vandaan komen',
		kind: 'text',
		fallback:
			'Straten komen uit het offici\u00eble adressenregister. De rest \u2014 kastelen, gehuchten, verdwenen villa\u0027s, caf\u00e9s die er niet meer zijn \u2014 staat in geen enkel register en is met de hand opgezocht.'
	},
	{
		id: 'over-ons.kaart-twijfel',
		page: '/over-ons',
		label: 'De kaart: wat we niet zeker weten',
		kind: 'text',
		fallback:
			'Van die plekken weten we sommige precies en andere bij benadering, en dat verschil is op de kaart te zien: waar we het niet zeker weten staat een rode cirkel, en erbij staat waarom we twijfelen. Weet u het beter, dan kunt u het ter plekke rechtzetten. Dat is geen beleefdheid \u2014 de mensen die weten waar kasteel Beaulieu stond, wonen in Kapellen en niet in deze database.'
	},
	{
		id: 'over-ons.meedoen-kop',
		page: '/over-ons',
		label: 'Kop: meedoen',
		kind: 'heading',
		fallback: 'Meedoen'
	},
	{
		id: 'over-ons.bronnen-kop',
		page: '/over-ons',
		label: 'Kop: bronnen',
		kind: 'heading',
		fallback: 'Bronnen'
	},
	{
		id: 'over-ons.bron-archief',
		page: '/over-ons',
		label: 'Bron: het archief zelf',
		kind: 'text',
		fallback:
			'De foto\u0027s en teksten van gzvka.be, bijeengebracht door de gemeenschap van Kapellen.'
	},
	{
		id: 'over-ons.bron-straten',
		page: '/over-ons',
		label: 'Bron: straten',
		kind: 'text',
		fallback: 'Straatgeometrie uit het Vlaams Adressenregister.'
	},
	{
		id: 'over-ons.bron-erfgoed',
		page: '/over-ons',
		label: 'Bron: gebouwen',
		kind: 'text',
		fallback: 'Gebouwen en monumenten uit de Inventaris Onroerend Erfgoed.'
	},
	{
		id: 'over-ons.bron-kaart',
		page: '/over-ons',
		label: 'Bron: kaartachtergrond',
		kind: 'text',
		fallback: 'Kaartachtergrond \u00a9 OpenStreetMap-bijdragers (ODbL).'
	}
];

const BY_ID = new Map(COPY_SLOTS.map((slot) => [slot.id, slot]));

/** The slot with this id, or undefined for an id nothing on the site renders. */
export function slotFor(id: string): CopySlot | undefined {
	return BY_ID.get(id);
}

/** Every page that has rewritable words, in the order the curator's desk lists them. */
export function copyPages(): string[] {
	return [...new Set(COPY_SLOTS.map((slot) => slot.page))];
}

/**
 * One piece of text as a curator typed it, or undefined if it is not usable.
 *
 * Trimmed, collapsed and capped, and refused outright for an id the site does not render -
 * an unknown id is either a typo or a client writing whatever it likes into a public
 * document, and neither should end up stored. Refused too when it is only whitespace, or
 * when it is identical to the shipped words: storing "the same as the default" is a record
 * that means nothing and a row that has to be reasoned about for ever afterwards.
 */
export function readCopyText(id: string, value: unknown): string | undefined {
	const slot = slotFor(id);
	if (!slot) return undefined;
	if (typeof value !== 'string') return undefined;

	// Newlines survive in a text block - a curator writing two paragraphs means two
	// paragraphs - but runs of spaces and stray tabs do not.
	const cleaned =
		slot.kind === 'heading'
			? value.replace(/\s+/g, ' ').trim()
			: value
					.replace(/[ \t]+/g, ' ')
					.replace(/\n{3,}/g, '\n\n')
					.trim();

	if (cleaned === '') return undefined;
	if (cleaned === slot.fallback) return undefined;

	return cleaned.slice(0, COPY_LIMITS[slot.kind]);
}

/** What the site fetches: every rewritten sentence, keyed by slot id. */
export interface CopyFile {
	version: number;
	copy: Record<string, string>;
}

/**
 * A whole payload read off the wire, with anything unusable dropped.
 *
 * Dropped rather than refused: one unknown id in a stored document must not cost the reader
 * every other sentence on the page. This is the same fail-soft rule the photo-edit and
 * place-record overlays follow, for the same reason.
 */
export function readCopyFile(input: unknown): Record<string, string> {
	if (!input || typeof input !== 'object') return {};

	const raw = (input as Partial<CopyFile>).copy;
	if (!raw || typeof raw !== 'object') return {};

	const copy: Record<string, string> = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		const text = readCopyText(id, value);
		if (text !== undefined) copy[id] = text;
	}

	return copy;
}

/**
 * The words to render for a slot: what the curator wrote, or what the site shipped with.
 *
 * Takes the overrides rather than reading them, so it is a pure function of its arguments
 * and the page can call it during server rendering, during hydration and after the overlay
 * arrives without three different code paths.
 */
export function say(overrides: Record<string, string>, id: string): string {
	const stored = overrides[id];
	if (typeof stored === 'string' && stored.trim() !== '') return stored;

	return slotFor(id)?.fallback ?? '';
}
