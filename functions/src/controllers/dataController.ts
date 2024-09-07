import {Request, Response} from "express";
import {https, HttpsFunction, pubsub} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {isNotNullOrEmpty} from "../utils/string-helper";
import {validateCors} from "../utils/cors-helper";
import {dataService} from "../services";

export const getGeoJson: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            const fileName = request.query.fileName?.toString();
            if (isNotNullOrEmpty(fileName))
                response.status(200).send((await dataService.getMapData(fileName!)).toString('utf8'));
            else
                response.status(400).send("Validation error - 'fileName' query parameter is missing.")

        } catch (error) {
            logger.error("Error retrieving file:", error);
            response.status(500).send("Error retrieving file: " + error);
        }
    }
);

export const createGeoJson: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            await dataService.createAllMapData();
            response.status(204).send();
        } catch (error) {
            logger.error("Error retrieving file:", error);
            response.status(500).send("Error retrieving file: " + error);
        }
    }
);

export const createGeoJsonJob = pubsub.topic('create-geojson-topic').onPublish(async (): Promise<void> => {
    try {
        logger.log('GeoJSON creation process started.');
        await dataService.createAllMapData();
    } catch (error) {
        logger.error("Error creating file:", error);
    }
});
 