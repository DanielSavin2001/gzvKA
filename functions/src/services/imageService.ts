import {IncomingHttpHeaders} from "http";
import {DocumentReference, GeoPoint} from "@google-cloud/firestore";
import * as logger from "firebase-functions/logger";

import {firestore, storage} from "./externalServices";
import {extractDatesFromText, getFileExtension, removeFileExtension} from "../utils/string-helper";
import {resolveStoredFormat} from "../utils/image-format";
import {collectFiles} from "./upload/multipart";
import {FileData, ImageDocument, ImageDocumentFS, MapMarker} from "../../../sharedModels/interfaces";
import {getBucketName, getImagesCollectionName} from "../constants/google-storage-constants";


/**
 * Stores every image in a multipart upload and records it in Firestore.
 *
 * Resolves only once all of that work has finished, so the request handler can answer
 * after the upload is durable rather than before it has begun. Any failure propagates to
 * the caller and becomes a failed request instead of an unhandled rejection.
 */
export async function handleImages(subjectId: string, imageFiles: any, headers: IncomingHttpHeaders, coordinates: MapMarker | null): Promise<void> {

    const files: FileData[] = await collectFiles(headers, imageFiles);

    for (const file of files) {
        await storeImage(file, subjectId, coordinates);
    }
}

/** Writes one uploaded file to Cloud Storage and its metadata to Firestore. */
async function storeImage(file: FileData, subjectId: string, coordinates: MapMarker | null): Promise<void> {
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

    // Trust the bytes over the filename: 55 images already in this archive carry an
    // extension that disagrees with their content, and storing a GIF as image/png leaves
    // the object permanently mislabelled.
    const format = resolveStoredFormat(
        file.buffer,
        file.fields.mimeType,
        getFileExtension(file.fields.filename)
    );

    if (format.correctedFromDeclared) {
        logger.log(`"${file.fields.filename}" is actually ${format.mimeType}; storing it as such.`);
    }

    // Upload file to Google Cloud Storage with document ID as file name
    const fileName = `images/${documentId}${format.extension}`;
    const fileUpload = storage.file(fileName);

    await fileUpload.save(file.buffer, {
        contentType: format.mimeType,
    });

    // Set the URL of the uploaded image in Firestore document
    const imgURL = `https://storage.googleapis.com/${getBucketName()}/${fileName}`;
    await documentRef.update({imgURL});

    logger.log(`Uploaded file to Google Storage and updated Firestore document: ${fileName}`);
}

async function createImage(image: ImageDocumentFS): Promise<DocumentReference> {
    return await firestore.collection(getImagesCollectionName()).add(image);
}

export async function getAllImages(): Promise<ImageDocument[]> {

    const documentRefs = await firestore
        .collection(getImagesCollectionName()).get();

    return documentRefs.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data() as ImageDocumentFS
        };
    });
}

export async function getImageDocuments(subjectId: string): Promise<ImageDocument[]> {
    const documentRefs = await firestore
        .collection(getImagesCollectionName()).where("subjectId", "==", subjectId).get();

    return documentRefs.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data() as ImageDocumentFS
        };
    });
}