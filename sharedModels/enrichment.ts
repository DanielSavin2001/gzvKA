/**
 * Types for the AI enrichment pipeline.
 *
 * Kept in `sharedModels/` because both sides need them: the Cloud Functions produce the
 * records, and the SvelteKit frontend renders the results and the volunteer review queue.
 *
 * Two principles are encoded in these types rather than left to convention, because this
 * is a heritage archive and a confidently wrong street silently corrupts the record:
 *
 *  1. **AI output is never the canonical record.** It lands in a sibling
 *     `imageEnrichments/{imageId}` document and only reaches `images/{imageId}` after the
 *     reconciliation gate, and for anything uncertain, after a volunteer approves it.
 *  2. **Every asserted place carries its evidence and its provenance.** A street is only
 *     ever accompanied by the literal string it was read from and by a {@link FieldSource}
 *     saying who decided it, so a reviewer can always check the claim rather than trust it.
 *
 * Note that there is deliberately **no coordinate field anywhere in the AI output**.
 * The model is never asked for, and can never emit, a latitude or longitude. Map pins are
 * produced by a separate deterministic join against an official address register, which is
 * the structural guarantee against fabricated locations on the map of Kapellen.
 */

/** How confident an assertion is. Ordered from weakest to strongest. */
export type Confidence = 'low' | 'medium' | 'high' | 'certain';

/** Ranks a {@link Confidence} so thresholds can be expressed as comparisons. */
export const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = {
	low: 0,
	medium: 1,
	high: 2,
	certain: 3
};

/** Who decided the value of a field on the canonical image document. */
export type FieldSource = 'filename' | 'folder' | 'ai' | 'human' | 'existing';

/** Lifecycle of one image's enrichment record. */
export type EnrichmentStatus =
	/** Queued, not yet sent to the model. Every pre-existing image starts here. */
	| 'pending'
	/** Claimed by a worker, with a lease that expires so a crashed run is reclaimable. */
	| 'in_progress'
	/** The model answered and the answer was reconciled cleanly. */
	| 'enriched'
	/** Reconciliation found something a volunteer has to decide. */
	| 'needs_review'
	/** A volunteer accepted it. Only this state may write to `images/{id}`. */
	| 'approved'
	/** A volunteer rejected it. The AI record is kept for provenance, never applied. */
	| 'rejected'
	/** Not enrichable: a refusal, a corrupt scan, an unsupported format. */
	| 'skipped'
	/** Repeated hard errors. Surfaced to maintainers as an operations item. */
	| 'failed';

/** Why a record was routed to a human instead of being auto-approved. */
export type ReviewReason =
	| 'illegible_scan'
	| 'conflicting_street_evidence'
	| 'no_location_evidence'
	| 'filename_contradicts_image'
	| 'ambiguous_between_streets'
	| 'possible_not_kapellen'
	| 'damaged_or_cropped'
	/** The model cited a quote that does not occur in the image text or the filename. */
	| 'ungrounded_evidence'
	/** The model named a street that is not in the gazetteer - possibly a new one. */
	| 'unknown_street'
	/** Deterministic filename street and AI street disagree. */
	| 'street_conflict'
	/** Filename year and the visual era estimate are far apart. */
	| 'era_conflict';

/** Why a street candidate was discarded during reconciliation. */
export type DropReason =
	| 'evidence_not_in_filename'
	| 'evidence_not_in_detected_text'
	| 'evidence_missing_quote'
	| 'confidence_too_low'
	| 'house_number_not_legible';

/** What kind of photograph this is. Drives how it is presented and filtered. */
export type ImageType =
	| 'street_scene'
	| 'building_exterior'
	| 'building_interior'
	| 'portrait_group'
	| 'class_photo'
	| 'postcard'
	| 'aerial_photo'
	| 'map_or_plan'
	| 'document_or_press'
	| 'event'
	| 'landscape'
	| 'object'
	| 'other';

/** Approximate band of how many people are visible. Never an exact count. */
export type PeopleCount = 'none' | 'one' | 'few' | 'group' | 'crowd';

/** What a transcribed piece of text is. */
export type DetectedTextKind =
	| 'street_plate'
	| 'house_number'
	| 'shop_sign'
	| 'vehicle_marking'
	| 'postcard_caption'
	| 'photographer_stamp'
	| 'poster_or_notice'
	| 'handwriting'
	| 'monument_inscription'
	| 'other';

/** How readable a transcription was. A `guess` may never support a street claim. */
export type Legibility = 'clear' | 'partial' | 'guess';

/** Where a street claim came from. Architectural style is deliberately not an option. */
export type StreetEvidenceSource =
	| 'image_text'
	| 'image_landmark'
	| 'filename'
	| 'folder'
	| 'combination';

/** One literal piece of text transcribed from the photograph itself. */
export interface DetectedText {
	/** Transcribed verbatim from the image. Never copied out of the filename. */
	text: string;
	kind: DetectedTextKind;
	legibility: Legibility;
}

/** One proposed location for the photograph. */
export interface StreetCandidate {
	/** The street as read. Free text, so a genuinely new street can still surface. */
	street: string;
	/** An id from the supplied gazetteer, or null when the street is not on the list. */
	gazetteerId: string | null;
	/** Only when the digits are physically legible, or literally present in the filename. */
	houseNumber: string | null;
	source: StreetEvidenceSource;
	/**
	 * Dutch justification quoting, between double quotes, the literal string relied on.
	 * Checked mechanically against the detected text and the filename by
	 * `assertEvidenceGrounded`; an unverifiable quote drops the candidate.
	 */
	evidence: string;
	confidence: Confidence;
}

/** When the photograph was taken, estimated from what is visible in it. */
export interface EraEstimate {
	/** e.g. "1930s". Null when there is no visual cue at all. */
	decade: string | null;
	rangeStart: number | null;
	rangeEnd: number | null;
	/** Dutch. Names the visible cues: clothing, vehicles, paving, print style. */
	basisNl: string;
	confidence: Confidence;
}

/** The complete structured record returned by the model for one photograph. */
export interface VisionEnrichment {
	imageType: ImageType;
	showsPeople: boolean;
	peopleCount: PeopleCount;
	/** Filled before streetCandidates: transcribe first, infer second. */
	detectedText: DetectedText[];
	/** May be empty. An empty list is a correct and expected answer. */
	streetCandidates: StreetCandidate[];
	eraEstimate: EraEstimate;
	titleNl: string;
	descriptionNl: string;
	tags: string[];
	overallConfidence: Confidence;
	needsHumanReview: boolean;
	reviewReasons: ReviewReason[];
}

/**
 * Everything the deterministic layer worked out from the file path alone, before any
 * model is involved. Passed to the model as explicitly untrusted context, and used by
 * reconciliation as the authority for records facts such as the donor and the donation date.
 */
export interface DeterministicHints {
	/** The top-level subject folder, e.g. "Kalmhousesteenweg - Duitse Wijk". */
	subjectFolderName: string;
	/** Full folder chain for nested albums. */
	subjectFolderPath: string[];
	/** The filename exactly as on disk, with the extension stripped. */
	rawFileName: string;
	/** The filename split on " - " and trimmed. */
	fileNameSegments: string[];
	descriptionSegment: string | null;
	/** The donor who gave the photo to the archive - never a person in the photograph. */
	contributorSegment: string | null;
	/** False when the filename says z.n. / zn (zonder naam - anonymous). */
	contributorKnown: boolean;
	/** False when the filename says z.d. / zd (zonder datum - no date). */
	dateKnown: boolean;
	/** dd.mm.yyyy the archive received it, from the filename. */
	dateOfAcquisition: string | null;
	yearOfImageFromFileName: string | null;
	/** A duplicate marker such as "_5", " 2" or "(9)". */
	indexSuffix: string | null;
	/** Prefixes such as "OWNP" or "SP" whose meaning is not recorded and must not be guessed. */
	unknownPrefixes: string[];
	gazetteerHits: GazetteerHit[];
}

/** A gazetteer entry matched against a filename or folder name. */
export interface GazetteerHit {
	id: string;
	name: string;
	/** The literal token in the filename or folder that matched. */
	matchedToken: string;
	via: 'filename' | 'folder';
	/** True for an exact alias hit, false when it was reached by fuzzy matching. */
	exact: boolean;
}

/**
 * The gazetteer types live in `./gazetteer`, which owns the place vocabulary, its
 * provenance rules and its matching contract. Re-exported here so that consumers of the
 * enrichment pipeline get a single import surface.
 */
export type {
	District,
	GazetteerEntry,
	PlaceKind,
	PlaceGeometry,
	PlaceMatch,
	CornerMatch
} from './gazetteer';

/** Token usage and cost for one enrichment call, recorded so spend stays auditable. */
export interface EnrichmentUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	estimatedCostUsd: number;
}

/** The outcome of reconciling AI output against the deterministic facts. */
export interface ReconciliationResult {
	/** The fields that would be written to `images/{id}`, once approved. */
	patch: EnrichmentPatch;
	nextStatus: Extract<EnrichmentStatus, 'enriched' | 'needs_review'>;
	reviewReasons: ReviewReason[];
	droppedCandidates: Array<{ candidate: StreetCandidate; why: DropReason }>;
	/** Which source won for each field in the patch. */
	fieldSources: Record<string, FieldSource>;
}

/** The additive fields enrichment contributes to an image document. */
export interface EnrichmentPatch {
	streetName?: string;
	/** Normalized form of streetName, for searching. */
	streetNormalized?: string;
	streetGazetteerId?: string | null;
	houseNumber?: string;
	tags?: string[];
	/** AI description, kept separate so it never overwrites a human or migrated text. */
	aiDescriptionNl?: string;
	aiTitleNl?: string;
	/** Only set when the filename yielded no year; never overwrites yearOfImage. */
	yearOfImageEstimated?: string;
}

/** The sibling document holding everything about one image's enrichment. */
export interface EnrichmentDocFS {
	status: EnrichmentStatus;
	statusUpdatedAt: string;
	/** When an `in_progress` claim expires and the image may be reclaimed. */
	leaseExpiresAt: string | null;
	attempts: number;
	lastError: string | null;
	/** sha256 of the stored image bytes - part of the idempotency key. */
	contentHash: string;
	promptVersion: string;
	schemaVersion: string;
	model: string;
	pass: 1 | 2;
	usage: EnrichmentUsage | null;
	/** Raw model output, never mutated, kept for provenance. */
	ai: VisionEnrichment | null;
	hints: DeterministicHints | null;
	reconciled: ReconciliationResult | null;
	review: {
		reviewedBy: string;
		reviewedAt: string;
		decision: 'approved' | 'rejected';
		corrections: string | null;
	} | null;
}
