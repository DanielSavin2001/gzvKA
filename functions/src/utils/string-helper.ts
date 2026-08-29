import {logger} from "firebase-functions";

/**
 * Checks if a given string is null, undefined, or an empty string (including whitespace only).
 *
 * @param str - The string to check. Can be a string, null, or undefined.
 * @returns True if the string is null, undefined, or empty (including strings with only whitespace); otherwise, false.
 */
export function isNullOrEmpty(str: string | null | undefined): boolean {
    return str === null || str === undefined || str.trim() === '';
}

/**
 * Checks if a given string is **NOT** null, undefined, or an empty string (including whitespace only).
 *
 * @param str - The string to check. Can be a string, null, or undefined.
 * @returns True if the string is **NOT** null, undefined, or empty (including strings with only whitespace); otherwise, false.
 */
export function isNotNullOrEmpty(str: string | null | undefined): boolean {
    return !isNullOrEmpty(str);
}

/**
 * Extracts and categorizes dates from a given string based on specified ranges.
 * The function identifies years between 1800 and 3000 and categorizes them into
 * `dateOfAcquisition` and `yearOfImage` based on certain conditions.
 *
 * - If only one valid year is found:
 *   - If the year is 2014 or later, it is assigned to `dateOfAcquisition`.
 *   - In either case, the year is also assigned to `yearOfImage`.
 *
 * - If two valid years are found:
 *   - The earlier year is assigned to `yearOfImage`.
 *   - The later year is assigned to `dateOfAcquisition`.
 *
 * - If more than two valid years are found, a warning is logged for manual review.
 *
 * @param text - The string to search for numbers in. The text should contain year values
 *               between 1800 and 3000.
 * @returns An object containing:
 *   - `dateOfAcquisition`: The year determined to be the date of acquisition, or an empty string if not applicable.
 *   - `yearOfImage`: The year determined to be the year of the image, or an empty string if not applicable.
 */
export function extractDatesFromText(text: string): { dateOfAcquisition: string; yearOfImage: string } {
    // Regular expression to find numbers between 1800 and 3000
    const regex = /(18[0-9]{2}|19[0-9]{2}|20[0-9]{2}|3000)/g;

    // Find all matches
    const matches = text.match(regex);

    let dateOfAcquisition = "";
    let yearOfImage = "";

    if (matches == null) return {dateOfAcquisition, yearOfImage};

    switch (matches.length) {
        case 1:
            const singleMatchYear = parseInt(matches[0], 10);
            if (singleMatchYear >= 2014)
                dateOfAcquisition = matches[0];
            else
                yearOfImage = matches[0];
            break;
        case 2:
            const firstMatchYear = parseInt(matches[0], 10);
            const secondMatchYear = parseInt(matches[1], 10);
            if (firstMatchYear > secondMatchYear) {
                dateOfAcquisition = matches[0];
                yearOfImage = matches[1];
            } else {
                yearOfImage = matches[0];
                dateOfAcquisition = matches[1];
            }
            break;
        default:
            logger.warn(`Encountered a special case, manual intervention may be needed for ${text}`);
    }

    return {dateOfAcquisition, yearOfImage};
}

/**
 * Extracts the file extension from a given filename.
 * @param filename - The filename from which to extract the extension.
 * @returns The file extension, including the dot, or an empty string if no extension is found.
 */
export function getFileExtension(filename: string): string {
    // Regular expression to capture the file extension
    const match = filename.match(/\.(\w+)$/);
    return match ? `.${match[1]}` : '';
}

/**
 * Removes the file extension from a given filename.
 * @param filename - The filename from which to remove the extension.
 * @returns The filename without the extension.
 */
export function removeFileExtension(filename: string): string {
    // Regular expression to capture everything before the last dot
    const match = filename.match(/^(.*)\.(\w+)$/);
    return match ? match[1] : filename;
}

/**
 * Matches a canonical Cloud Storage URI: `gs://{bucket}/{object-path}`.
 */
const GS_URI_PATTERN = /^gs:\/\/([^\/]+)\/(.+)$/;

/**
 * Matches the Cloud Storage HTTP(S) endpoints: `https://storage.googleapis.com/{bucket}/{object-path}`
 * and its `storage.cloud.google.com` equivalent. This is the shape that
 * {@link file://./../services/imageService.ts} writes for every newly uploaded image.
 */
const HTTP_ENDPOINT_PATTERN = /^https?:\/\/(?:storage\.googleapis\.com|storage\.cloud\.google\.com)\/(.+)$/;

/**
 * Matches a Firebase Storage download URL, in which the object path is percent-encoded
 * into a single segment: `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}`.
 */
const FIREBASE_DOWNLOAD_PATTERN =
    /^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\/(.+)$/;

/**
 * Percent-decodes a storage object path, tolerating a malformed escape sequence rather
 * than throwing - a badly encoded legacy record should still resolve to something we can
 * look up, instead of taking down the whole image request.
 */
function decodeObjectPath(objectPath: string): string {
    try {
        return decodeURIComponent(objectPath);
    } catch {
        return objectPath;
    }
}

/**
 * Extracts the path of an image within the Cloud Storage bucket from a stored `imgURL`.
 *
 * The archive has accumulated several URL shapes over its lifetime and all of them have to
 * keep resolving, because each one is what some existing Firestore document holds:
 *
 *   - `gs://{bucket}/{path}` - the canonical URI, used by the older records that were
 *     migrated from the original site.
 *   - `https://storage.googleapis.com/{bucket}/{path}` - what `imageService` writes today
 *     for every image uploaded through the upload zone.
 *   - `https://storage.googleapis.com/gs://{bucket}/{path}` - a malformed hybrid that this
 *     function's original documentation described, so it is accepted defensively.
 *   - `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}` - the Firebase
 *     download URL, whose object path is percent-encoded into one segment.
 *
 * Any query string or fragment is discarded, and the returned path is percent-decoded so it
 * can be handed straight to `bucket.file(...)`.
 *
 * @param {string} imgURL - The stored URL of the image.
 * @returns {string} - The object path within the bucket, e.g. `images/3PxzTlVqjxGbWOdDOmfg.jpg`.
 *
 * @throws {Error} 'The parameter imgURL can not be empty.' if `imgURL` is null, undefined or blank.
 * @throws {Error} 'Invalid imgURL format.' if the URL matches none of the shapes above, or
 * matches one of them but carries no object path after the bucket.
 */
export function extractImagePath(imgURL: string): string {
    if (isNullOrEmpty(imgURL)) throw new Error('The parameter imgURL can not be empty.');

    // A query string or fragment is addressing metadata (`?alt=media`, `?generation=...`),
    // never part of the object name.
    const url = imgURL.trim().split('#')[0].split('?')[0];

    const firebaseMatch = url.match(FIREBASE_DOWNLOAD_PATTERN);
    if (firebaseMatch) return decodeObjectPath(firebaseMatch[2]);

    const gsMatch = url.match(GS_URI_PATTERN);
    if (gsMatch) return decodeObjectPath(gsMatch[2]);

    const httpMatch = url.match(HTTP_ENDPOINT_PATTERN);
    if (httpMatch) {
        // Tolerate the `https://storage.googleapis.com/gs://{bucket}/{path}` hybrid by
        // folding it back onto the plain `{bucket}/{path}` case.
        const bucketAndPath = httpMatch[1].replace(/^gs:\/\//, '');
        const separatorIndex = bucketAndPath.indexOf('/');

        // No separator means a bucket with no object after it, which addresses nothing.
        if (separatorIndex === -1) throw new Error('Invalid imgURL format.');

        const objectPath = bucketAndPath.slice(separatorIndex + 1);
        if (isNullOrEmpty(objectPath)) throw new Error('Invalid imgURL format.');

        return decodeObjectPath(objectPath);
    }

    throw new Error('Invalid imgURL format.');
}
