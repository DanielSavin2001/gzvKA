export interface SubjectFS {
    name: string;
    explanation: string;
}

export interface Subject extends SubjectFS {
    id: string;
}

export interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        "id": string,
        "imageName": string,
        "imgURL": string,
        "nameOfSender": string,
        "yearOfImage": number
    };
}

export interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

export interface ImageDocument extends ImageDocumentFS {
    id: string;
}

export interface ImageDocumentFS {
    dateOfAcquisition: string; // Represents the date of acquisition as a Firestore timestamp
    geopoint: GeoPoint | null; // Represents the geographical coordinates as a Firestore GeoPoint
    imageDescription: string; // A description of the image, which might be an empty string
    imageName: string; // The name of the image
    imgURL: string; // The URL of the image stored in Firebase Storage
    nameOfSender: string; // The name of the person or organization who sent the image
    subjectId: DocumentReference; // A reference to the subject document in Firestore
    yearOfImage: string; // The year when the image was taken
}

export interface GeoPoint {
    latitude: number;
    longitude: number;
}

export interface DocumentReference {
    id: string;
    path: string;
}

export interface FileDataFields {
    filename: string,
    encoding: string,
    mimetype: string,
}

export interface FileData {
    fieldName: string,
    fields: FileDataFields,
    buffer: Buffer,
}

export interface MapMarker {
    lngLat: {
        lng: number,
        lat: number
    }
}