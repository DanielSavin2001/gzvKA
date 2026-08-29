/**
 * Identifies an image by its actual bytes rather than by what its filename claims.
 *
 * This is not a theoretical concern in this archive. Of the 2948 photographs, 55 carry an
 * extension that disagrees with their content: 28 GIFs named `.png`, 26 PNGs named `.jpg`,
 * and one JPEG named `.png`. Volunteers renamed files over more than a decade and the
 * extension went along for the ride. Browsers mostly cope, but a stored `contentType` of
 * `image/png` on a GIF is simply wrong metadata, and an image API asked to read a photo
 * will reject a declared media type that does not match the bytes.
 *
 * Pure module: no Firebase, no config, testable offline.
 */

/** A recognised image format. */
export interface ImageFormat {
	/** The canonical extension, including the leading dot. */
	extension: '.jpg' | '.png' | '.gif' | '.webp' | '.bmp' | '.tif';
	/** The IANA media type, suitable for a `contentType` or an API `media_type`. */
	mimeType: string;
}

const JPEG: ImageFormat = { extension: '.jpg', mimeType: 'image/jpeg' };
const PNG: ImageFormat = { extension: '.png', mimeType: 'image/png' };
const GIF: ImageFormat = { extension: '.gif', mimeType: 'image/gif' };
const WEBP: ImageFormat = { extension: '.webp', mimeType: 'image/webp' };
const BMP: ImageFormat = { extension: '.bmp', mimeType: 'image/bmp' };
const TIFF: ImageFormat = { extension: '.tif', mimeType: 'image/tiff' };

/** True when `buffer` starts with the given byte sequence. */
function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
	if (buffer.length < offset + bytes.length) return false;

	return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Reads the format of an image from its leading bytes.
 *
 * @returns The format, or null when the bytes match no image format we recognise - in
 * which case the caller should fall back to what it was told rather than guess.
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
	if (buffer.length < 4) return null;

	// JPEG: FF D8 FF
	if (startsWith(buffer, [0xff, 0xd8, 0xff])) return JPEG;

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;

	// GIF: "GIF87a" or "GIF89a"
	if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return GIF;

	// WebP: "RIFF" .... "WEBP"
	if (
		startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return WEBP;
	}

	// BMP: "BM"
	if (startsWith(buffer, [0x42, 0x4d])) return BMP;

	// TIFF: little-endian "II*\0" or big-endian "MM\0*"
	if (
		startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
		startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
	) {
		return TIFF;
	}

	return null;
}

/**
 * Decides the extension and content type to store an uploaded image under.
 *
 * The bytes win where they are recognised, because they are the only trustworthy source.
 * Where they are not, the values the client supplied are kept rather than replaced by a
 * guess, so an unusual but valid format is stored as-is instead of being mislabelled.
 */
export function resolveStoredFormat(
	buffer: Buffer,
	declaredMimeType: string | undefined,
	declaredExtension: string
): { extension: string; mimeType: string; correctedFromDeclared: boolean } {
	const detected = detectImageFormat(buffer);

	if (detected === null) {
		return {
			extension: declaredExtension,
			mimeType:
				declaredMimeType && declaredMimeType.trim() !== ''
					? declaredMimeType
					: 'application/octet-stream',
			correctedFromDeclared: false
		};
	}

	const correctedFromDeclared =
		declaredMimeType !== detected.mimeType ||
		declaredExtension.toLowerCase() !== detected.extension;

	return {
		extension: detected.extension,
		mimeType: detected.mimeType,
		correctedFromDeclared
	};
}
