import * as logger from "firebase-functions/logger";

import {storage} from "./externalServices";
import {getAllImages} from "./imageService";
import {getAllSubjects} from "./subjectService";
import {convertImageDocumentsToGeoJSONFeatureCollection} from "../utils/converter";
import {isNotNullOrEmpty} from "../utils/string-helper";
import {GeoJSONFeatureCollection, ImageDocument, Subject} from "../../../sharedModels/interfaces";
import {MAP_DATA_GEOJSON_NAME} from "../constants/google-storage-constants";

export async function getMapData(fileName: string): Promise<Buffer> {

    // Fetch GeoJSON data from the bucket
    const file = storage.file(`geoJsonFiles/${fileName}.geojson`);

    // Get the file's contents
    const [contents] = await file.download();

    return contents
}

export async function createAllMapData(): Promise<void> {
    const images: ImageDocument[] = await getAllImages();
    const geoJsonFilesToUpload: Map<string, GeoJSONFeatureCollection> = await generateAllGeoJsonFiles(images)
    await uploadGeoJsonFiles(geoJsonFilesToUpload);
}

async function generateAllGeoJsonFiles(imageDocuments: ImageDocument[]): Promise<Map<string, GeoJSONFeatureCollection>> {

    const geoJsonFilesToUpload: Map<string, GeoJSONFeatureCollection> = new Map<string, GeoJSONFeatureCollection>();
    geoJsonFilesToUpload.set(MAP_DATA_GEOJSON_NAME, convertImageDocumentsToGeoJSONFeatureCollection(imageDocuments));

    const categorizedImageDocumentsCollection: Map<string, ImageDocument[]> = new Map<string, ImageDocument[]>();

    imageDocuments.forEach(imageDocument => {
        const subjectOfImageDocument = imageDocument.subjectId
        if (categorizedImageDocumentsCollection.has(subjectOfImageDocument))
            categorizedImageDocumentsCollection.get(subjectOfImageDocument)!.push(imageDocument)
        else
            categorizedImageDocumentsCollection.set(subjectOfImageDocument, [imageDocument])
    });

    const allSubjects = await getAllSubjects();

    for (const [keySubjectId, valueImageDocuments] of categorizedImageDocumentsCollection) {

        const foundSubject: Subject | undefined = allSubjects.find(subject => subject.id === keySubjectId);

        if (isNotNullOrEmpty(foundSubject?.name))
            geoJsonFilesToUpload.set(foundSubject!.name, convertImageDocumentsToGeoJSONFeatureCollection(valueImageDocuments))
        else
            logger.error(`Unknown Subject id '${keySubjectId}' was used for GeoJson generation.`)
    }

    return geoJsonFilesToUpload;
}

async function uploadGeoJsonFiles(geoJsonFilesToUpload: Map<string, GeoJSONFeatureCollection>): Promise<void> {
    for (const [keyFileName, GeoJSONFeatureCollection] of geoJsonFilesToUpload) {
        try {
            // Convert the GeoJSON object to a string
            const geoJsonString = JSON.stringify(GeoJSONFeatureCollection, null, 2);

            // Define the file name and path in the bucket
            const file = storage.file(`geoJsonFiles/${keyFileName}.geojson`);

            // Upload the GeoJSON string to Google Cloud Storage 
            await file.save(geoJsonString, {
                contentType: 'application/json'
            });
            logger.log(`GeoJSON file saved as '${keyFileName}' in bucket ${storage.name}.`);
        } catch (error) {
            logger.error(`Error saving GeoJSON '${keyFileName}' to Google Cloud Storage ${storage.name}:`, error);
        }
    }
}