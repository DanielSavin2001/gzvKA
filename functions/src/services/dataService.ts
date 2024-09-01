import {storage} from "./externalServices";

export async function getMapData(): Promise<Buffer> {

    // Fetch GeoJSON data from the bucket
    const file = storage.file("TEST-MAP.geojson");

    // Get the file's contents
    const [contents] = await file.download();
    
    return contents
}