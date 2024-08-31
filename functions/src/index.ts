import {Request, Response} from 'express';
import * as functions from 'firebase-functions';
import {Storage} from "@google-cloud/storage";
import {validateCors} from "./utils/cors-helper"
import {BUCKET_NAME} from "./constants/google-storage-constants";
import {Firestore} from "@google-cloud/firestore"
import {FileData, FileDataFields, ImageDocumentFS, Subject, SubjectFS} from "../../firestore-types/interfaces";
import {extractDatesFromText, getFileExtension, isNullOrEmpty, removeFileExtension} from "./utils/string-helper";
import * as Busboy from 'busboy';
import * as logger from 'firebase-functions/logger';

const firestore = new Firestore();
const storage = new Storage().bucket(BUCKET_NAME);

export const http_retrieve_geojson: functions.HttpsFunction = functions.https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        if (request.method === 'OPTIONS') return;

        try {
            // Fetch GeoJSON data from the bucket
            const file = storage.file("TEST-MAP.geojson");

            // Get the file's contents
            const [contents] = await file.download();

            // Send the contents as a response
            response.status(200).send(contents.toString('utf8'));
        } catch (error) {
            logger.error("Error retrieving file:", error);
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
            logger.error("Error retrieving subjects:", error);
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
            logger.error("Error creating subject: ", error);
            response.status(500).send("Error creating subject: " + error);
        }
    }
);

export const http_upload_images: functions.HttpsFunction = functions.https.onRequest(
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

            const busboy: Busboy.Busboy = Busboy({headers: request.headers});
            const files: FileData[] = [];

            busboy.on('file', (fieldName: string, file: any, fields: FileDataFields) => {
                const chunks: Buffer[] = [];

                file.on('data', (data: any) => {
                    chunks.push(data);
                    logger.log('Received data chunk for file:', fields?.filename);
                });

                file.on('end', () => {
                    files.push({
                        fieldName,
                        fields,
                        buffer: Buffer.concat(chunks),
                    });
                    logger.log(`Finished processing file: ${fields?.filename}`);
                });

                file.on('error', (err: any) => {
                    logger.error('File stream error:', err);
                });
            });

            busboy.on('finish', async () => {
                try {
                    if (files.length === 0) {
                        logger.error('No files were uploaded.');
                        return response.status(400).send('No files were uploaded.');
                    }

                    // Create a DocumentReference from the subjectId string
                    const subjectRef = firestore.doc(`subjects/${subjectId}`);

                    for (const file of files) {
                        logger.log(`Creating firestore document for ${file.fields.filename}`);

                        const {dateOfAcquisition, yearOfImage} = extractDatesFromText(file.fields.filename);

                        const imageDocument: ImageDocumentFS = {
                            subjectId: subjectRef,
                            imageName: removeFileExtension(file.fields.filename),
                            dateOfAcquisition: dateOfAcquisition,
                            yearOfImage: yearOfImage,
                            imageDescription: "",
                            imgURL: "",
                            nameOfSender: "",
                            geopoint: null,
                        }

                        // Add document to Firestore and get document ID
                        const documentRef = await firestore.collection('images').add(imageDocument);
                        const documentId = documentRef.id;

                        // Upload file to Google Cloud Storage with document ID as file name
                        const fileName = `${documentId}${getFileExtension(file.fields.filename)}`; // Use document ID as the file name
                        const fileUpload = storage.file(fileName);

                        await fileUpload.save(file.buffer, {
                            contentType: file.fields.mimetype,
                        });

                        // Set the URL of the uploaded image in Firestore document
                        const imgURL = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
                        await documentRef.update({imgURL});

                        logger.log(`Uploaded file to Google Storage and updated Firestore document: ${fileName}`);
                    }
                    return response.sendStatus(200);
                } catch (error) {
                    logger.error('Error processing upload: ', error);
                    return response.status(500).send('Error processing upload: ' + error);
                }
            });

            busboy.end(request.body)
        } catch (error) {
            logger.error('Unexpected error in request handling:', error);
            return response.status(500).send('Unexpected error: ' + error);
        }
    }
);