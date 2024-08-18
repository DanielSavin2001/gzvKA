import {Request, Response} from 'express';
import * as functions from 'firebase-functions';
import {Storage} from "@google-cloud/storage";
import {validateCors} from "./utils/cors-helper"
import {BUCKET_NAME} from "./constants/google-storage-constants";
import {Firestore} from "@google-cloud/firestore"
import {Subject, SubjectFS} from "../../firestore-types/interfaces";
import {isNullOrEmpty} from "./utils/string-helper";
import * as Busboy from 'busboy';
// import * as logger from 'firebase-functions/logger';

const firestore = new Firestore();

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

export const http_retrieve_subjects: functions.HttpsFunction = functions.https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        if (request.method === 'OPTIONS') return;
        try {

            const documentRefs = await firestore
                .collection('subjects').get();

            const subjects: Subject[] = documentRefs.docs.map(doc => {
                return {
                    id: doc.id,
                    ...doc.data() as SubjectFS
                };
            });

            response.status(200).send(subjects);
        } catch (error) {
            console.error("Error retrieving subjects:", error);
            response.status(500).send("Error retrieving subjects: " + error);
        }
    }
);

export const http_create_subject: functions.HttpsFunction = functions.https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        if (request.method === 'OPTIONS') return;
        try {
            const requestBody: SubjectFS = request.body;
            if (isNullOrEmpty(requestBody.name))
                response.status(400).send("Validation error - Name of the subject can not be empty.")

            await firestore.collection('subjects').add(requestBody);

            response.sendStatus(200);
        } catch (error) {
            console.error("Error creating subject: ", error);
            response.status(500).send("Error creating subject: " + error);
        }
    }
);

export const http_upload_images: functions.HttpsFunction = functions.https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        if (request.method === 'OPTIONS') return;

        if (request.method !== 'POST') {
            return response.status(405).send('Method Not Allowed');
        }

        const subjectId = request.query.subjectId;

        if (isNullOrEmpty(subjectId?.toString())) {
            return response.status(400).send('Validation error - SubjectId can not be empty.');
        }

        const busboy: Busboy.Busboy = Busboy({headers: request.headers});
        const fields: any = {};
        const files: any[] = [];

        busboy.on('field', (fieldname: any, value: any) => {
            fields[fieldname] = value;
        });

        busboy.on('file', (fieldname: any, file: any, filename: any, encoding: any, mimetype: any) => {
            const fileData: any = {
                fieldname,
                filename,
                encoding,
                mimetype,
                buffer: []
            };

            file.on('data', (data: any) => {
                fileData.buffer.push(data);
            });

            file.on('end', () => {
                fileData.buffer = Buffer.concat(fileData.buffer);
                files.push(fileData);
            });
        });

        busboy.on('finish', async () => {
            try {
                // Handle the uploaded files as needed, e.g., save to Cloud Storage or Firestore
                // TODO: CREATE FIRST FIRESTORE OBJECTS & then use doc ID as name in Google Storage
                new Storage().bucket(BUCKET_NAME)


                return response.sendStatus(200);
            } catch (error) {
                console.error('Error processing upload: ', error);
                return response.status(500).send('Error processing upload: ' + error);
            }
        });

        request.pipe(busboy);
    }
);