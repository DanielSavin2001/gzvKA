import {Request, Response} from "express";
import {HttpsFunction, https} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {validateCors} from "../utils/cors-helper";
import {isNullOrEmpty} from "../utils/string-helper";
import {imageService} from "../services"
import {MapMarker} from "../../../sharedModels/interfaces";

export const uploadImages: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);

        try {
            if (request.method !== 'POST') {
                return response.status(405).send('Method Not Allowed');
            }

            const subjectId = request.query.subjectId;

            if (isNullOrEmpty(subjectId?.toString())) {
                return response.status(400).send('Validation error - SubjectId can not be empty.');
            }

            const coordinates = request.query.coordinates?.toString();

            let convertedCoordinates: MapMarker | null = null;

            if (!isNullOrEmpty(coordinates)) {
                const splitCoordinates = coordinates!.toString().split(",");
                convertedCoordinates = {lngLat: {lat: parseFloat(splitCoordinates[0]), lng: parseFloat(splitCoordinates[1])}}
            }

            await imageService.handleImages(subjectId!.toString(), request.body, request.headers, convertedCoordinates)

            response.sendStatus(200);

        } catch (error) {
            logger.error('Error processing upload: ', error);
            response.status(500).send('Error processing upload: ' + error);
        }
    }
);