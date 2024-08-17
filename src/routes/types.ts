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