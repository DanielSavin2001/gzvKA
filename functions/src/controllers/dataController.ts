import {Request, Response} from "express";
import {https, HttpsFunction, pubsub} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {validateCors} from "../utils/cors-helper";
import {dataService} from "../services";

export const getGeoJson: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            response.status(200).send((await dataService.getMapData()).toString('utf8'));
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
            await dataService.createMapData();
            response.status(204).send();
        } catch (error) {
            logger.error("Error retrieving file:", error);
            response.status(500).send("Error retrieving file: " + error);
        }
    }
);

export const createGeoJsonJob = pubsub.topic('create-geojson-topic').onPublish(async () => {
    try {
        logger.log('GeoJSON creation process started.');
        await dataService.createMapData();
    } catch (error) {
        logger.error("Error creating file:", error);
    }
});
 