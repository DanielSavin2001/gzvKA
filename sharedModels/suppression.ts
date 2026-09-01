/**
 * Photographs that must not be published, decided once and honoured everywhere.
 *
 * `/contact` promises: "Staat u op een foto en wilt u dat ze weggaat? Dan gaat ze weg." The
 * removal desk keeps that promise the same day - a curator accepts a request, a `hidden`
 * edit lands in the runtime overlay, and the photograph disappears from the site within the
 * minute. That is the right first move and it is not the whole promise: the generated index
 * still carries the record, `sitemap.xml` still lists its page, and the next `npm run
 * archive:index` would put it back if the overlay were ever lost.
 *
 * This file is the second move. A path listed here never enters the index at all, so it is
 * absent from the search, the place pages, the sitemap and the prerendered HTML - not
 * filtered out afterwards, but never written.
 *
 * ## Keyed by the path, not by the photograph id
 *
 * `photo-corrections.json` keys by id, because a correction is about a record. A suppression
 * is about a file, and the file is what must not be published. The id is derived from the
 * path and is almost always stable, but "almost" is doing real work there: when two paths
 * slugify to the same thing the second gets a `-2`, so adding an unrelated photograph could
 * in principle shift a suppressed photograph's id and quietly un-suppress it. A path cannot
 * drift out from under itself that way.
 *
 * This lives in `sharedModels/` so the jest suite in `functions/` can reach it, for the same
 * reason `approximation.ts` gives: a rule about what may not be published is exactly the
 * kind of thing that must have a test.
 */

/** Why a photograph is not published. */
export type SuppressionReason =
	/** Somebody on the photograph asked for it to go. */
	| 'verzoek'
	/** A rights holder objected. */
	| 'rechten'
	/** Withdrawn on the archive's own reading of it. */
	| 'privacy'
	/** It should never have been in the corpus - a scan of a document, a duplicate, a slip. */
	| 'fout';

const REASONS: SuppressionReason[] = ['verzoek', 'rechten', 'privacy', 'fout'];

/** One withdrawn photograph. */
export interface Suppression {
	reason: SuppressionReason;
	/** Who decided, so it can be asked about. */
	by: string;
	/** ISO date of the decision. */
	on: string;
	/**
	 * Anything worth recording, in the archive's own words.
	 *
	 * Never what the person said about themselves. A request to be taken off a photograph
	 * carries a reason that is nobody else's business, and this file is committed to a
	 * public repository.
	 */
	note?: string;
}

export interface SuppressionFile {
	version: number;
	suppressed: Record<string, Suppression>;
}

/**
 * The suppressions, or a clear error.
 *
 * Deliberately strict. Every other reader in this repository is fail-soft, because a missing
 * story or an unparseable coordinate should never take the site down. This one is the
 * opposite: a malformed entry that is quietly skipped republishes a photograph somebody
 * asked to have removed, and nobody finds out until they see it again.
 */
export function readSuppressions(input: unknown): Record<string, Suppression> {
	if (input == null) return {};

	const file = input as Partial<SuppressionFile>;
	const raw = file.suppressed;
	if (raw == null) return {};

	if (typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('suppressed.json: "suppressed" must be an object keyed by corpus path.');
	}

	const suppressions: Record<string, Suppression> = {};

	for (const [photoPath, value] of Object.entries(raw as Record<string, unknown>)) {
		const entry = value as Partial<Suppression>;

		if (typeof entry?.reason !== 'string' || !REASONS.includes(entry.reason)) {
			throw new Error(
				`suppressed.json: "${photoPath}" needs a reason, one of ${REASONS.join(', ')}.`
			);
		}
		if (typeof entry.by !== 'string' || entry.by.trim() === '') {
			throw new Error(`suppressed.json: "${photoPath}" needs "by" - who decided this.`);
		}
		if (typeof entry.on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.on)) {
			throw new Error(`suppressed.json: "${photoPath}" needs "on" as a date, like 2026-09-01.`);
		}

		suppressions[photoPath] = {
			reason: entry.reason,
			by: entry.by.trim(),
			on: entry.on,
			...(typeof entry.note === 'string' && entry.note.trim() !== ''
				? { note: entry.note.trim() }
				: {})
		};
	}

	return suppressions;
}

/**
 * Suppressions naming a file the corpus does not have.
 *
 * A suppression that matches nothing is the failure this file exists to prevent, wearing a
 * disguise: the record says the photograph is withdrawn, the index says otherwise, and the
 * only sign is a line in a JSON file that nobody reads. The builder refuses to write an
 * index while any of these exist.
 */
export function staleSuppressions(
	suppressions: Record<string, Suppression>,
	corpusPaths: Iterable<string>
): string[] {
	const present = new Set(corpusPaths);
	return Object.keys(suppressions)
		.filter((photoPath) => !present.has(photoPath))
		.sort();
}
