/**
 * Bringing the curators' work back into git.
 *
 * Everything anybody has curated since the site went live is in Firestore and nowhere else.
 * There is no export, no backup script, and nothing in either workflow that touches it.
 * `static/data/place-coordinates.json` calls itself the durable record of every coordinate a
 * person placed by hand, and the file is empty: every pin ever placed exists only in the
 * database. And because the site fails soft on purpose, an emptied project would render as a
 * perfectly healthy archive running on the generated index. Nobody would notice for weeks.
 *
 * This reads the three public overlays and writes three committed files:
 *
 *   static/data/place-coordinates.json   the pins, folded into the file that already
 *                                        promises to be their durable record
 *   static/data/photo-edits.json         corrections to photographs
 *   static/data/place-records.json       places a curator created or corrected
 *
 * Run it with credentials for the project:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run archive:pull
 *
 * Then commit whatever changed. The nightly workflow in
 * `.github/workflows/pull-curator-work.yml` does exactly that and opens a pull request, so
 * the diff becomes the readable account of what the curators changed - a pull request rather
 * than a push, because nobody should find out that the archive changed by reading `main`.
 *
 * ## What this deliberately does not export
 *
 * Only the three collections the site already serves to anybody who asks. `photo-facts`,
 * `submissions` and `removal-requests` carry names, email addresses and free text written by
 * members of the public - including somebody's reason for not wanting to be in a photograph.
 * This repository is public. Those need a private Firestore export, not a commit, and the
 * reasoning is written out in `sharedModels/archive-export.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CoordinatesFile } from '../../sharedModels/archive-export';
import {
	coordinatesFile,
	coordinatesWithoutPins,
	differs,
	photoEditsFile,
	placeRecordsFile
} from '../../sharedModels/archive-export';
import * as photoEdits from '../src/services/photoEditService';
import * as placePins from '../src/services/placePinService';
import * as placeRecords from '../src/services/placeRecordService';

function findRepoRoot(start: string): string {
	let current = start;
	for (;;) {
		if (fs.existsSync(path.join(current, 'svelte.config.js'))) return current;
		const parent = path.dirname(current);
		if (parent === current) throw new Error('Could not find the repository root.');
		current = parent;
	}
}

const REPO_ROOT = findRepoRoot(__dirname);
const DATA_DIR = path.join(REPO_ROOT, 'static', 'data');

const COORDINATES_FILE = path.join(DATA_DIR, 'place-coordinates.json');
const PHOTO_EDITS_FILE = path.join(DATA_DIR, 'photo-edits.json');
const PLACE_RECORDS_FILE = path.join(DATA_DIR, 'place-records.json');

function readIfPresent(file: string): string | null {
	return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/**
 * Writes only when the contents actually change.
 *
 * A pull that finds nothing new must leave the working tree untouched, or the nightly
 * workflow opens a pull request every night that says nothing.
 */
function write(file: string, contents: string): boolean {
	const before = readIfPresent(file);
	if (!differs(before, contents)) return false;

	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, contents, 'utf8');
	return true;
}

async function main(): Promise<void> {
	// Read all three before writing any: a half-written pull is worse than none, and these
	// are three views of one moment.
	const [pins, edits, records] = await Promise.all([
		placePins.all(),
		photoEdits.all(),
		placeRecords.all()
	]);

	const existingCoordinates = JSON.parse(
		readIfPresent(COORDINATES_FILE) ?? '{"places":{}}'
	) as Partial<CoordinatesFile>;

	const written = [
		['place-coordinates.json', write(COORDINATES_FILE, coordinatesFile(existingCoordinates, pins))],
		['photo-edits.json', write(PHOTO_EDITS_FILE, photoEditsFile(edits))],
		['place-records.json', write(PLACE_RECORDS_FILE, placeRecordsFile(records))]
	] as const;

	console.log('Archive pull');
	console.log('='.repeat(52));
	console.log(`Place pins              ${Object.keys(pins).length}`);
	console.log(`Photo edits             ${Object.keys(edits).length}`);
	console.log(`Place records           ${Object.keys(records).length}`);
	console.log('');

	for (const [name, changed] of written) {
		console.log(`${changed ? 'wrote  ' : 'same   '} static/data/${name}`);
	}

	// Never removed here, only named. Either somebody added the coordinate by hand - the
	// file's own comment invites that - or a curator took a pin off a place and the file is
	// now holding it there against their decision. Only a person can tell those apart.
	const orphans = coordinatesWithoutPins(existingCoordinates, pins);
	if (orphans.length > 0) {
		console.log('');
		console.log(`${orphans.length} coordinate(s) in the file that no live pin backs:`);
		for (const placeId of orphans) console.log(`  ${placeId}`);
		console.log('Either placed by hand, or a pin somebody removed. Check before deleting.');
	}

	if (!written.some(([, changed]) => changed)) {
		console.log('\nNothing changed.');
	}
}

main().catch((error) => {
	// Exit non-zero and say what happened: this runs unattended every night, and a pull that
	// fails quietly is indistinguishable from a database with nothing in it.
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
