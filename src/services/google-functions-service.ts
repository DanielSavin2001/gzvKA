import type {MapMarker, SubjectFS} from "../../sharedModels/interfaces";

export const getAllSubjects = async (): Promise<Response> => {
    return (await fetch(import.meta.env.VITE_BASE_URL_GF + 'getAllSubjects'));
}

export const getGeoJson = async (): Promise<Response> => {
    return (await fetch(import.meta.env.VITE_BASE_URL_GF + 'getGeoJson'));
}

export const createSubject = async (subject: SubjectFS): Promise<Response> => {
    return await fetch(import.meta.env.VITE_BASE_URL_GF + 'createSubject', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(subject)
    });
};

export const uploadImages = async (subjectId: string, files: File[], marker: MapMarker | null): Promise<Response> => {
    const formData = new FormData();

    files.forEach((file) => {
        formData.append('files', file);
    });

    const coordinates = marker?`${marker.lngLat.lat},${marker.lngLat.lng}`:``;
    
    return await fetch(import.meta.env.VITE_BASE_URL_GF + `uploadImages?subjectId=${subjectId}&coordinates=${coordinates}`, {
        method: 'POST',
        body: formData
    });
};