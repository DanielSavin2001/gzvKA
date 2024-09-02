import * as logger from "firebase-functions/logger";

import {storage} from "./externalServices";
import {getAllImages} from "./imageService";
import {ImageDocument} from "../../../sharedModels/interfaces";
import {MAP_DATA_GEOJSON_NAME} from "../constants/google-storage-constants";

export async function getMapData(): Promise<Buffer> {

    // Fetch GeoJSON data from the bucket
    const file = storage.file(MAP_DATA_GEOJSON_NAME);

    // Get the file's contents
    const [contents] = await file.download();

    return contents
}

export async function createMapData(): Promise<void> {

    const images: ImageDocument[] = await getAllImages()

    // Construct GeoJSON structure
    const geoJson = {
        type: "FeatureCollection",
        features: images
            .filter(image => image.geopoint !== null && image.geopoint.latitude != 0 && image.geopoint.longitude != 0)
            .map(image => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [
                        image.geopoint?.longitude || 0,
                        image.geopoint?.latitude || 0,
                        0.0
                    ]
                },
                properties: {
                    id: image.id,
                    imageName: image.imageName,
                    imgURL: image.imgURL,
                    nameOfSender: image.nameOfSender,
                    yearOfImage: image.yearOfImage
                }
            }))
    };
    
    // Convert the GeoJSON object to a string
    const geoJsonString = JSON.stringify(geoJson, null, 2);
    logger.log(geoJsonString);

    // Define the file name and path in the bucket
    const fileName = MAP_DATA_GEOJSON_NAME;
    const file = storage.file(fileName);

    // Upload the GeoJSON string to Google Cloud Storage
    try {
        await file.save(geoJsonString, {
            contentType: 'application/json'
        });
        logger.log(`GeoJSON file saved to ${fileName} in bucket ${storage.name}.`);
    } catch (error) {
        logger.error('Error saving GeoJSON to Google Cloud Storage:', error);
    }
}