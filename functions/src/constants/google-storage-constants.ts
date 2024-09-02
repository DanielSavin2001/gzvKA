import { config } from "firebase-functions";

export const BUCKET_NAME = config().functions.bucket_name;
export const SUBJECTS_COLLECTION_NAME = config().functions.subjects_collection_name;
export const IMAGES_COLLECTION_NAME = config().functions.images_collection_name;
export const MAP_DATA_GEOJSON_NAME = config().functions.map_data_geojson_name;