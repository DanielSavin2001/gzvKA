/**
 * Whose decision this was.
 *
 * Every decision in this archive is stamped with who made it - a corrected title, a pin
 * dropped on a map, a photograph approved or refused, somebody's request to be taken off
 * the site. Until this file existed that stamp was the curator's email address, and it went
 * three places it should not have gone.
 *
 * The first is the site. `photoEdits`, `placePins` and `placeRecords` are public endpoints -
 * they have to be, they are the site's own content - and each one answered with the full
 * stored record. Every corrected photograph on gzvka.com was published alongside the private
 * address of the person who corrected it.
 *
 * The second is git. `npm run archive:pull` writes those same records into
 * `static/data/`, and the nightly workflow commits them. This repository is public.
 *
 * The third is the page itself: "Aangepast door boatingdruid315@outlook.be" tells a curator
 * nothing they wanted to know. They wanted a name.
 *
 * So a decision is stamped with a name from here on, and an address that is already stored
 * is turned into a name on the way out. The names live in the `admins` documents in
 * Firestore rather than in this file, for the same reason the list of curators does: an
 * address in a public repository is the thing being fixed, and adding a curator stays a row
 * rather than a deploy.
 *
 * The rule that matters, and the reason this is a module with tests rather than a line of
 * string handling: **an address never reaches a reader**. Not when the roster is missing,
 * not when it is stale, not when the curator has since been removed from it. An unknown
 * address becomes "Een beheerder", which says exactly as much as is known.
 */

/** What an unresolvable stamp reads as. Vague on purpose; an address would not be. */
export const UNNAMED_CURATOR = 'Een beheerder';

/** Email address, lower-cased, to the name that curator wants shown. */
export type CuratorRoster = Record<string, string>;

/**
 * Long enough for a real name with a particle or two, short enough that the field cannot
 * be used to write a paragraph into every decision the archive shows.
 */
const NAME_LIMIT = 80;

/**
 * A display name off a Firestore document or a Google token, or nothing.
 *
 * Trusted no further than the address was: this is read from a document a human typed into
 * the Firebase console, so a number, a stray object or an empty string are all possible and
 * all mean "no name given".
 */
export function readCuratorName(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim().replace(/\s+/g, ' ');
	return trimmed === '' ? undefined : trimmed.slice(0, NAME_LIMIT);
}

/**
 * Whether a stamp is an email address rather than a name.
 *
 * Deliberately loose. It decides whether a value may be printed, so it errs towards saying
 * yes: something with an `@` in it is treated as an address and withheld even if no mail
 * server would accept it. A name with an `@` in it is not a name anybody has.
 */
export function looksLikeAddress(value: string): boolean {
	return value.includes('@');
}

/**
 * What to show for a stored stamp.
 *
 * Handles all three states the database is in at once, which is why it takes the stamp
 * rather than the curator: records written before this change hold an address, records
 * written after it hold a name, and a record can hold neither if the write predates the
 * field.
 */
export function curatorLabel(stored: unknown, roster: CuratorRoster = {}): string {
	const value = typeof stored === 'string' ? stored.trim() : '';
	if (value === '') return UNNAMED_CURATOR;
	if (!looksLikeAddress(value)) return value;

	return roster[value.toLowerCase()] ?? UNNAMED_CURATOR;
}

/**
 * The name to stamp on a decision being made now.
 *
 * The `admins` document wins over Google's own display name, because the document is what
 * this archive's curators control: Google's is whatever the account happens to be called,
 * and changing it means changing a Google account. The Google name is a decent second
 * guess, so a curator who has not been given a name in Firestore is still recognisable
 * rather than anonymous from their first decision.
 */
export function curatorName(fromAdmins: unknown, fromGoogle?: unknown): string {
	return readCuratorName(fromAdmins) ?? readCuratorName(fromGoogle) ?? UNNAMED_CURATOR;
}
