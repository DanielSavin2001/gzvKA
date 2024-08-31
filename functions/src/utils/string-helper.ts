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
            if (singleMatchYear >= 2014) {
                dateOfAcquisition = matches[0];
            }
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