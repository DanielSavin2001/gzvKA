import type { MapMarker, SubjectFS } from '../../sharedModels/interfaces';

/**
 * Calls to the Firebase backend.
 *
 * Only the write path needs this: uploading a photograph, creating a subject. Browsing
 * and searching the archive read a static index that ships with the site, so the whole
 * archive works on a fresh clone with nothing configured.
 *
 * When `VITE_BASE_URL_GF` is not set, every call here fails immediately with a message
 * that says so. Previously the unset value was concatenated into the URL, producing a
 * request to `undefinedgetGeoJson?fileName=mapData` and a 404 that looked like a broken
 * server rather than missing configuration.
 */

/** The configured backend base URL, or null when the app is running without a backend. */
export function getBackendBaseUrl(): string | null {
	const configured = import.meta.env.VITE_BASE_URL_GF;

	if (typeof configured !== 'string' || configured.trim() === '') return null;

	// Tolerate a missing trailing slash rather than silently building a wrong URL.
	return configured.endsWith('/') ? configured : `${configured}/`;
}

/** True when the Firebase-backed features can be used at all. */
export function isBackendConfigured(): boolean {
	return getBackendBaseUrl() !== null;
}

/** Raised when a backend call is attempted with no backend configured. */
export class BackendNotConfiguredError extends Error {
	constructor() {
		super(
			'Deze functie heeft de Firebase-backend nodig, maar VITE_BASE_URL_GF is niet ingesteld. ' +
				'Kopieer .env.example naar .env en vul de waarde in. Het fotoarchief zelf werkt ook zonder.'
		);
		this.name = 'BackendNotConfiguredError';
	}
}

/** Builds a backend URL, or throws a message a volunteer can act on. */
function backendUrl(path: string): string {
	const base = getBackendBaseUrl();
	if (base === null) throw new BackendNotConfiguredError();

	return base + path;
}

export const getSubject = async (subjectId: string): Promise<Response> => {
	return await fetch(backendUrl(`getSubject?subjectId=${encodeURIComponent(subjectId)}`));
};

export const getAllSubjects = async (): Promise<Response> => {
	return await fetch(backendUrl('getAllSubjects'));
};

export const getImageDocuments = async (subjectId: string): Promise<Response> => {
	return await fetch(backendUrl(`getImageDocuments?subjectId=${encodeURIComponent(subjectId)}`));
};

export const retrieveImage = async (imgURL: string): Promise<Response> => {
	return await fetch(backendUrl(`retrieveImage?imgURL=${encodeURIComponent(imgURL)}`));
};

export const getGeoJson = async (fileName: string): Promise<Response> => {
	return await fetch(backendUrl(`getGeoJson?fileName=${encodeURIComponent(fileName)}`));
};

export const createSubject = async (subject: SubjectFS): Promise<Response> => {
	return await fetch(backendUrl('createSubject'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subject)
	});
};

export const uploadImages = async (
	subjectId: string,
	files: File[],
	marker: MapMarker | null
): Promise<Response> => {
	const formData = new FormData();

	files.forEach((file) => {
		formData.append('files', file);
	});

	const coordinates = marker ? `${marker.lngLat.lat},${marker.lngLat.lng}` : '';

	return await fetch(
		backendUrl(
			`uploadImages?subjectId=${encodeURIComponent(subjectId)}&coordinates=${encodeURIComponent(
				coordinates
			)}`
		),
		{ method: 'POST', body: formData }
	);
};
