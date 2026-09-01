/**
 * Which photographs in the archive are byte-for-byte the same picture.
 *
 * Nothing in this repository ever compared two images, and the corpus grew by merging an
 * older website into a newer one. So the archive holds the same photograph more than once,
 * under different ids, and pays for it in three places at once: a correction is attached to
 * an id, so somebody who dates one copy has not dated the other; every place count is
 * inflated by however many copies sit under it; and the headline "4.504 foto's" counts them.
 *
 * This only reports. It changes nothing, deletes nothing, and writes one file into `docs/`.
 * Merging two records is a judgement about which one is the real one and what its title
 * should be, and that belongs to somebody who knows the archive.
 *
 * A byte hash needs no decoding, so this is cheap - a couple of seconds over 4.504 files -
 * and deliberately NOT bolted onto the thumbnail build: that script skips a file whose
 * outputs are already current, so hanging a hash off it would produce a manifest covering
 * only whatever happened to be reconverted.
 *
 *   node scripts/find-duplicates.mjs        (or: npm run duplicates)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'src', 'lib', 'images', 'history-images');
const INDEX_FILE = path.join(REPO_ROOT, 'static', 'data', 'archive-index.json');
const REPORT_FILE = path.join(REPO_ROOT, 'docs', 'dubbele-fotos.md');

const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));

const byHash = new Map();
let missing = 0;

for (const photo of index.photos) {
	const file = path.join(CORPUS_DIR, photo.p);
	if (!existsSync(file)) {
		missing += 1;
		continue;
	}

	const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
	if (!byHash.has(hash)) byHash.set(hash, []);
	byHash.get(hash).push(photo);
}

const groups = [...byHash.entries()]
	.filter(([, photos]) => photos.length > 1)
	.map(([hash, photos]) => ({ hash, photos }))
	.sort((a, b) => b.photos.length - a.photos.length || a.photos[0].t.localeCompare(b.photos[0].t));

const inGroups = groups.reduce((total, group) => total + group.photos.length, 0);
const surplus = inGroups - groups.length;

const key = (photo) => (photo.st ?? []).slice().sort().join('+');
const disagreeOnPlace = groups.filter((g) => new Set(g.photos.map(key)).size > 1);
const disagreeOnYear = groups.filter((g) => new Set(g.photos.map((p) => p.y ?? '')).size > 1);
const acrossFolders = groups.filter((g) => new Set(g.photos.map((p) => p.s)).size > 1);

/**
 * The competition folder is a different problem and should not be counted as this one.
 *
 * Its biggest duplicate groups are a sponsor's logo appearing in six competition folders -
 * the same file six times because the same florist sponsored six competitions. That is not
 * a photograph of Kapellen held twice; merging those records would say something untrue
 * about the events. What is worth a curator's afternoon is the rest.
 */
const EVENTS = 'Wedstrijden GZVKA';
const insideEvents = groups.filter((g) => g.photos.every((p) => p.s === EVENTS));
const straddling = groups.filter(
	(g) => g.photos.some((p) => p.s === EVENTS) && !g.photos.every((p) => p.s === EVENTS)
);
const archiveOnly = groups.filter((g) => !g.photos.some((p) => p.s === EVENTS));
const surplusOf = (list) => list.reduce((total, g) => total + g.photos.length - 1, 0);

const lines = [];
const write = (line = '') => lines.push(line);

write('# Dezelfde foto, meer dan één keer');
write();
write(
	`Gegenereerd door \`npm run duplicates\` uit ${index.photos.length.toLocaleString(
		'nl-BE'
	)} records. ` +
		'Niets in dit bestand is met de hand geschreven, en het script verandert niets aan het archief.'
);
write();
write('## Wat er staat');
write();
write(`- **${groups.length} groepen** foto's die byte voor byte identiek zijn`);
write(`- samen **${inGroups} bestanden**, dus **${surplus} records te veel**`);
write(`- **${disagreeOnPlace.length} groepen** waarvan de kopieën het oneens zijn over de plaats`);
write(`- **${disagreeOnYear.length} groepen** waarvan de kopieën het oneens zijn over het jaartal`);
write(`- **${acrossFolders.length} groepen** liggen in meer dan één map`);
if (missing) write(`- ${missing} records zonder bronbestand (overgeslagen)`);
write();
write('## Niet alles hiervan is hetzelfde probleem');
write();
write(
	`De grootste groepen zitten volledig in *${EVENTS}* en zijn geen foto's van Kapellen: het ` +
		"zijn logo's van sponsors die bij zes wedstrijden hoorden, dus zes keer hetzelfde bestand. " +
		'Die samenvoegen zou iets onwaars zeggen over die wedstrijden.'
);
write();
write(`| | groepen | records te veel |`);
write(`|---|---:|---:|`);
write(
	`| volledig in *${EVENTS}* (meestal sponsorlogo's) | ${insideEvents.length} | ${surplusOf(
		insideEvents
	)} |`
);
write(`| half daar, half in het archief | ${straddling.length} | ${surplusOf(straddling)} |`);
write(
	`| **niets met die map te maken — dit is het echte werk** | **${
		archiveOnly.length
	}** | **${surplusOf(archiveOnly)}** |`
);
write();
write(
	`Die ${archiveOnly.length} zijn het patroon om naar te kijken: dezelfde historische foto, ` +
		'in twee thematische mappen gezet. `Hoevensebaan` en `Kasteel Blauwhof` houden er drie ' +
		'kopieën van dezelfde opname op na, `Hoogboom Hoogboomsteenweg` en `Kerken en kapellen` ook.'
);
write();
write('## Waarom dit geld kost');
write();
write(
	'Een correctie hangt aan een id. Wie bij de ene kopie 1957 voorstelt, heeft de andere niet ' +
		'gedateerd — en het jaartallenbureau vraagt een beheerder twee keer hetzelfde. Elke ' +
		'plaatsteller is met hetzelfde aantal opgeblazen, en de kop op de startpagina telt de ' +
		'kopieën mee.'
);
write();
write(
	`De ${disagreeOnPlace.length} groepen die het oneens zijn over de plaats zijn het duurst: ` +
		'dezelfde foto staat dan op twee straatpagina’s en telt twee keer mee op de kaart.'
);
write();
write('## De groepen');
write();
write(
	'Per groep: het aantal kopieën, en daaronder elke kopie met zijn map, zijn jaartal en zijn ' +
		'plaatsen. Waar die van elkaar verschillen staat er een `!` bij — dat is de regel waar een ' +
		'mens naar moet kijken.'
);
write();

for (const group of groups) {
	const places = new Set(group.photos.map(key));
	const years = new Set(group.photos.map((photo) => photo.y ?? ''));
	const flags = [places.size > 1 ? 'plaats' : null, years.size > 1 ? 'jaartal' : null].filter(
		Boolean
	);

	write(
		`### ${group.photos.length}× — ${group.photos[0].t}` +
			(flags.length ? `  — **! oneens over ${flags.join(' en ')}**` : '')
	);
	write();
	for (const photo of group.photos) {
		write(
			`- \`${photo.id}\`  · map: *${photo.s}*  · jaartal: ${photo.y ?? '—'}` +
				`  · plaats: ${(photo.st ?? []).join(', ') || '—'}`
		);
	}
	write();
}

writeFileSync(REPORT_FILE, lines.join('\n') + '\n');

console.log(
	`${groups.length} groepen, ${inGroups} bestanden, ${surplus} records te veel. ` +
		`Geschreven naar ${path.relative(REPO_ROOT, REPORT_FILE)}.`
);
