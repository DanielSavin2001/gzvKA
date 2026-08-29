import { config } from 'firebase-functions';

/**
 * Where the archive keeps things in Google Cloud.
 *
 * These used to be read at module load with `functions.config()`, which throws outside a
 * deployed function. Importing anything downstream of this file therefore failed in the
 * emulator and in every unit test that touched a service - so the upload path, the only
 * part of this codebase that talks to Firebase, was the one part nobody could run locally.
 *
 * They are read on first use instead, and an environment variable wins over
 * `functions.config()`. `functions.config()` is on its way out of Firebase anyway; a
 * `.env` file in `functions/` is how this is done now, and it is also what lets the
 * emulator start.
 */

/** Reads a setting once, from the environment first and the legacy config after. */
function setting(environmentName: string, configName: string, fallback: string): string {
	const fromEnvironment = process.env[environmentName];
	if (fromEnvironment) return fromEnvironment;

	try {
		const value = config()?.functions?.[configName];
		if (value) return String(value);
	} catch {
		// Not running inside a deployed function, and nothing in the environment either.
	}

	return fallback;
}

let cache: Record<string, string> = {};

function cached(
	key: string,
	environmentName: string,
	configName: string,
	fallback: string
): string {
	if (!(key in cache)) cache[key] = setting(environmentName, configName, fallback);
	return cache[key];
}

/** For tests that need to change a setting and put it back. */
export function resetSettingsCache(): void {
	cache = {};
}

export const getBucketName = (): string =>
	cached('bucket', 'GZVKA_BUCKET_NAME', 'bucket_name', 'gzvka.appspot.com');

export const getSubjectsCollectionName = (): string =>
	cached('subjects', 'GZVKA_SUBJECTS_COLLECTION', 'subjects_collection_name', 'subjects');

export const getImagesCollectionName = (): string =>
	cached('images', 'GZVKA_IMAGES_COLLECTION', 'images_collection_name', 'images');

export const getMapDataGeoJsonName = (): string =>
	cached('geojson', 'GZVKA_MAP_DATA_GEOJSON', 'map_data_geojson_name', 'mapData.geojson');
