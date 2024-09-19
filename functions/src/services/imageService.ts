import {IncomingHttpHeaders} from "http";
import {DocumentReference, GeoPoint} from "@google-cloud/firestore";
import * as Busboy from "busboy";
import * as logger from "firebase-functions/logger";

import {firestore, storage} from "./externalServices";
import {extractDatesFromText, getFileExtension, removeFileExtension} from "../utils/string-helper";
import {FileData, FileDataFields, ImageDocument, ImageDocumentFS, MapMarker} from "../../../sharedModels/interfaces";
import {BUCKET_NAME, IMAGES_COLLECTION_NAME} from "../constants/google-storage-constants";


export async function handleImages(subjectId: string, imageFiles: any, headers: IncomingHttpHeaders, coordinates: MapMarker | null): Promise<void> {

    const busboy: Busboy.Busboy = Busboy({headers: headers});
    const files: FileData[] = [];

    extractImages(busboy, files);
    processImages(busboy, files, subjectId!.toString(), coordinates);

    busboy.end(imageFiles)
}

function extractImages(busboy: Busboy.Busboy, files: FileData[]): void {

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
}

function processImages(busboy: Busboy.Busboy, files: FileData[], subjectId: string, coordinates: MapMarker | null): void {
    busboy.on('finish', async () => {
        if (files.length === 0) throw Error('No files were uploaded.')

        for (const file of files) {
            logger.log(`Creating firestore document for ${file.fields.filename}`);

            const {dateOfAcquisition, yearOfImage} = extractDatesFromText(file.fields.filename);

            const imageDocument: ImageDocumentFS = {
                subjectId: subjectId,
                imageName: removeFileExtension(file.fields.filename),
                dateOfAcquisition: dateOfAcquisition,
                yearOfImage: yearOfImage,
                imageDescription: "",
                imgURL: "",
                nameOfSender: "",
                geopoint: coordinates ? new GeoPoint(coordinates.lngLat.lat, coordinates.lngLat.lng) : null,
            }

            // Add document to Firestore and get document ID
            const documentRef = await createImage(imageDocument);
            const documentId = documentRef.id;

            // Upload file to Google Cloud Storage with document ID as file name
            const fileName = `images/${documentId}${getFileExtension(file.fields.filename)}`;
            const fileUpload = storage.file(fileName);

            await fileUpload.save(file.buffer, {
                contentType: file.fields.mimetype,
            });

            // Set the URL of the uploaded image in Firestore document
            const imgURL = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
            await documentRef.update({imgURL});

            logger.log(`Uploaded file to Google Storage and updated Firestore document: ${fileName}`);
        }
    });
}

async function createImage(image: ImageDocumentFS): Promise<DocumentReference> {
    return await firestore.collection(IMAGES_COLLECTION_NAME).add(image);
}

export async function getAllImages(): Promise<ImageDocument[]> {

    const documentRefs = await firestore
        .collection(IMAGES_COLLECTION_NAME).get();

    return documentRefs.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data() as ImageDocumentFS
        };
    });
}

export async function getImageDocuments(subjectId: string): Promise<ImageDocument[]> {
    const documentRefs = await firestore
        .collection(IMAGES_COLLECTION_NAME).where("subjectId", "==", subjectId).get();

    return documentRefs.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data() as ImageDocumentFS
        };
    });
}