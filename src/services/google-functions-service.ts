import type {SubjectFS} from "../../firestore-types/interfaces";

export const retrieveAllSubjects = async (): Promise<Response> => {
    return (await fetch(import.meta.env.VITE_BASE_URL_GF + 'http_retrieve_subjects'));
}

export const retrieveGeojson = async (): Promise<Response> => {
    return (await fetch(import.meta.env.VITE_BASE_URL_GF + 'http_retrieve_geojson'));
}

export const createSubject = async (subject: SubjectFS): Promise<Response> => {
    return await fetch(import.meta.env.VITE_BASE_URL_GF + 'http_create_subject', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(subject)
    });
};

export const uploadImages = async (subjectId: string, files: File[]): Promise<Response> => {
    const formData = new FormData();
    
    files.forEach((file) => {
        formData.append('files', file);
    });
    
    return await fetch(import.meta.env.VITE_BASE_URL_GF + `http_upload_images?subjectId=${subjectId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: formData
    });
};