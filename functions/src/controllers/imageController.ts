import {Request, Response} from "express";
import {https, HttpsFunction} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {validateCors} from "../utils/cors-helper";
import {extractImagePath, isNullOrEmpty} from "../utils/string-helper";
import {imageService} from "../services"
import {MapMarker} from "../../../sharedModels/interfaces";
import {storage} from "../services/externalServices";

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

export const getImageDocuments: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
      response = validateCors(request, response);

      try {
        const subjectId = request.query.subjectId;

        if (isNullOrEmpty(subjectId?.toString())) {
          return response.status(400).send('Validation error - SubjectId can not be empty.');
        }

        const images = await imageService.getImageDocuments(subjectId!.toString());

        return images.length >= 1 ? response.send(images) : response.sendStatus(204);

      } catch (error) {
        logger.error(`Error retrieving image documents: `, error);
        response.status(500).send('Error retrieving image documents: ' + error);
      }
    }
);

export const retrieveImage: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
      response = validateCors(request, response);
      try {
        const imgURL = request.query.imgURL;

        if (isNullOrEmpty(imgURL?.toString())) {
          return response.status(400).send('Validation error - imgURL can not be empty.');
        }

        const file = storage.file(extractImagePath(imgURL!.toString()));

        // Check if the file exists
        const [exists] = await file.exists();
        if (!exists) return response.status(404).send('Image not found.');

        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || 'application/octet-stream'; // Fallback if unknown

        // Stream the file to the response
        response.setHeader('Content-Type', contentType);
        const readStream = file.createReadStream();
        readStream.on('error', (err) => {
          logger.error(`Error retrieving image: `, err);
          response.status(500).send('Error retrieving image.');
        });

        readStream.pipe(response);

      } catch (error) {
        logger.error(`Error retrieving image: `, error);
        response.status(500).send('Error retrieving image: ' + error);
      }
    }
);