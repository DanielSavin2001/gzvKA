import {Request, Response} from 'express';
import * as functions from 'firebase-functions';
import {Storage} from "@google-cloud/storage";
import {validateCors} from "./utils/corshelper"
import {BUCKET_NAME} from "./constants/google-storage-constants";
// import * as logger from 'firebase-functions/logger';


export const http_retrieve_geojson: functions.HttpsFunction = functions.https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        if (request.method === 'OPTIONS') return;
        const storage = new Storage();

        try {
            // Fetch GeoJSON data from the bucket
            const file = storage.bucket(BUCKET_NAME).file("TEST-MAP.geojson");

            // Get the file's contents
            const [contents] = await file.download();

            // Send the contents as a response
            response.status(200).send(contents.toString('utf8'));
        } catch (error) {
            console.error("Error retrieving file:", error);
            response.status(500).send("Error retrieving file: " + error);
        }
    }
);