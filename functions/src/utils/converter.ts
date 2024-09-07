import {GeoJSONFeature, GeoJSONFeatureCollection, ImageDocument} from "../../../sharedModels/interfaces";

/**
 * Converts an ImageDocument object to a GeoJSON Feature.
 *
 * The function takes an ImageDocument and converts it into a GeoJSON Feature object,
 * with the coordinates based on the `geopoint` of the document. If the `geopoint`
 * is not provided, the coordinates will default to `[0, 0, 0]`.
 *
 * @param {ImageDocument} imageDocument - The ImageDocument to convert.
 * @returns {GeoJSONFeature} - A GeoJSON Feature representing the image document.
 *
 * @example
 * const imageDoc: ImageDocument = {
 *   id: "123",
 *   imageName: "Image 1",
 *   imgURL: "http://example.com/image.jpg",
 *   nameOfSender: "John Doe",
 *   yearOfImage: "1990",
 *   geopoint: {
 *     latitude: 40.7128,
 *     longitude: -74.0060
 *   }
 * };
 *
 * const feature = convertImageDocumentToGeoJSONFeature(imageDoc);
 */
export function convertImageDocumentToGeoJSONFeature(imageDocument: ImageDocument): GeoJSONFeature {
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [
                imageDocument.geopoint?.longitude || 0,
                imageDocument.geopoint?.latitude || 0,
                0.0
            ]
        },
        properties: {
            id: imageDocument.id,
            imageName: imageDocument.imageName,
            imgURL: imageDocument.imgURL,
            nameOfSender: imageDocument.nameOfSender,
            yearOfImage: imageDocument.yearOfImage
        }
    }
}

/**
 * Converts an array of ImageDocument objects into a GeoJSON FeatureCollection.
 *
 * This function takes an array of ImageDocument objects and converts each one into a
 * GeoJSON Feature. It filters out documents where the `geopoint` is null or has
 * invalid coordinates (0 latitude and 0 longitude).
 *
 * @param {ImageDocument[]} imageDocuments - The list of ImageDocuments to convert.
 * @returns {GeoJSONFeatureCollection} - A GeoJSON FeatureCollection containing the valid image documents.
 *
 * @example
 * const imageDocs: ImageDocument[] = [
 *   {
 *     id: "123",
 *     imageName: "Image 1",
 *     imgURL: "http://example.com/image1.jpg",
 *     nameOfSender: "John Doe",
 *     yearOfImage: "1990",
 *     geopoint: { latitude: 40.7128, longitude: -74.0060 }
 *   },
 *   {
 *     id: "124",
 *     imageName: "Image 2",
 *     imgURL: "http://example.com/image2.jpg",
 *     nameOfSender: "Jane Doe",
 *     yearOfImage: "1985",
 *     geopoint: { latitude: 34.0522, longitude: -118.2437 }
 *   }
 * ];
 *
 * const featureCollection = convertImageDocumentsToGeoJSONFeatureCollection(imageDocs);
 */
export function convertImageDocumentsToGeoJSONFeatureCollection(imageDocuments: ImageDocument[]): GeoJSONFeatureCollection {
    return {
        type: "FeatureCollection",
        features: imageDocuments
            .filter(image => image.geopoint !== null && image.geopoint.latitude != 0 && image.geopoint.longitude != 0)
            .map(image => convertImageDocumentToGeoJSONFeature(image))
    };
}


export function addGeoJSONFeaturesToGeoJSONFeatureCollections(imageDocuments: ImageDocument[]): GeoJSONFeatureCollection {
    return {
        type: "FeatureCollection",
        features: imageDocuments
            .filter(image => image.geopoint !== null && image.geopoint.latitude != 0 && image.geopoint.longitude != 0)
            .map(image => convertImageDocumentToGeoJSONFeature(image))
    };
}