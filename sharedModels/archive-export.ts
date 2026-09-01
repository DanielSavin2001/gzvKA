/**
 * Turning what the curators did back into files that live in git.
 *
 * Everything a curator has done since the site went live is in Firestore and nowhere else.
 * There is no export, no backup script, and nothing in the workflows that touches it. Two
 * things make that worse than an ordinary missing backup. `static/data/place-coordinates.json`
 * calls itself the durable record of every coordinate a person placed by hand - and the file
 * is empty, so every pin ever placed exists only in the database. And the site fails soft on
 * purpose: an emptied project renders as a perfectly healthy archive running on the generated
 * index, so nobody would notice for weeks.
 *
 * `npm run archive:pull` in `functions/` reads the live collections and writes these files.
 * The formatting rules here exist so that the diff is the readable account of what the
 * curators changed: sorted keys, tab indentation, one trailing newline. A pull that finds
 * nothing new produces a byte-identical file and therefore no pull request.
 *
 * ## What is exported and what is not
 *
 * Only what the site already serves to anybody who asks: the photo-edit overlay, the place
 * pins and the place records each have a public, unauthenticated endpoint, so committing
 * them changes nothing about who can read them.
 *
 * The queues are not exported and must not be: `photo-facts`, `submissions` and
 * `removal-requests` carry names, email addresses and free text written by members of the
 * public - including, in the removal queue, somebody's reason for not wanting to be in a
 * photograph. This repository is public. A backup that leaks those is a worse failure than
 * the one it fixes; they need a private Firestore export, not a commit.
 *
 * Lives here rather than beside the script so the jest suite can reach it, the same reason
 * `approximation.ts` gives.
 */

import type { PhotoEdit } from './photo-edit';
import type { PlacePin } from './place-pin';
import type { PlaceRecord } from './place-record';
import type { PlacedCoordinate } from './locate';

export const EXPORT_VERSION = 1;

/** The same record with its keys in order, so a diff shows changes and not reshuffling. */
export function sortedByKey<T>(record: Record<string, T>): Record<string, T> {
	const sorted: Record<string, T> = {};
	for (const key of Object.keys(record).sort()) sorted[key] = record[key];
	return sorted;
}

/**
 * How every file this writes is serialised.
 *
 * Tabs and a trailing newline because that is what the committed data files already use, and
 * a rewrite that only changes whitespace is a diff nobody can read.
 */
export function stableJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

/** What `static/data/place-coordinates.json` holds. */
export interface CoordinatesFile {
	_comment?: string;
	_format?: string;
	places: Record<string, PlacedCoordinate>;
}

/**
 * The coordinates file with the live pins folded in.
 *
 * A union rather than a replacement, and the live pin wins. The file may hold entries a
 * person wrote by hand - its own comment invites that - and a pull must never quietly delete
 * somebody's work just because the database has not heard of it.
 *
 * The comment and the format line are carried across rather than rewritten: they are the
 * only instructions anybody opening the file gets.
 */
export function coordinatesFile(
	existing: Partial<CoordinatesFile>,
	pins: Record<string, PlacePin>
): string {
	const places: Record<string, PlacedCoordinate> = { ...(existing.places ?? {}) };

	for (const [placeId, pin] of Object.entries(pins)) {
		places[placeId] = { lat: pin.lat, lng: pin.lng, by: pin.by, on: pin.on };
	}

	return stableJson({
		...(existing._comment ? { _comment: existing._comment } : {}),
		...(existing._format ? { _format: existing._format } : {}),
		places: sortedByKey(places)
	});
}

/**
 * Entries in the committed file that no live pin backs.
 *
 * Reported rather than removed. Either somebody added the coordinate by hand - in which case
 * deleting it would be vandalism - or a curator took a pin off a place, in which case the
 * file is now holding it in place against their decision. Only a person can tell those
 * apart, so the pull says which ids are in that position and leaves them alone.
 */
export function coordinatesWithoutPins(
	existing: Partial<CoordinatesFile>,
	pins: Record<string, PlacePin>
): string[] {
	return Object.keys(existing.places ?? {})
		.filter((placeId) => !(placeId in pins))
		.sort();
}

/** What `static/data/photo-edits.json` holds: the overlay, exactly as the endpoint serves it. */
export function photoEditsFile(edits: Record<string, PhotoEdit>): string {
	return stableJson({
		version: EXPORT_VERSION,
		_comment:
			'Corrections curators made to photographs, pulled out of Firestore by ' +
			'`npm run archive:pull`. The live overlay is what the site uses; this is the copy ' +
			'that survives the database and what a fresh clone runs on. Do not edit by hand: ' +
			'the next pull overwrites it with whatever the overlay says.',
		edits: sortedByKey(edits)
	});
}

/** What `static/data/place-records.json` holds: places a curator made or corrected. */
export function placeRecordsFile(places: Record<string, PlaceRecord>): string {
	return stableJson({
		version: EXPORT_VERSION,
		_comment:
			'Places a curator created or corrected, pulled out of Firestore by ' +
			'`npm run archive:pull`. The next `npm run archive:index` can fold these into the ' +
			'gazetteer, after which they are a no-op here. Do not edit by hand.',
		places: sortedByKey(places)
	});
}

/** Whether a pull actually found anything, so a workflow can skip opening a pull request. */
export function differs(before: string | null, after: string): boolean {
	return before !== after;
}
