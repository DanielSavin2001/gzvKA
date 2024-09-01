import {DocumentReference} from "@google-cloud/firestore";

import {Subject, SubjectFS} from "../../../sharedModels/interfaces";
import {SUBJECTS_COLLECTION_NAME} from "../constants/google-storage-constants";
import {firestore} from "./externalServices";

export async function getAllSubjects(): Promise<Subject[]> {

    const documentRefs = await firestore
        .collection(SUBJECTS_COLLECTION_NAME).get();

    return documentRefs.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data() as SubjectFS
        };
    });
}

export async function createSubject(subject: SubjectFS): Promise<void> {
    await firestore.collection(SUBJECTS_COLLECTION_NAME).add(subject);
}

export function createSubjectRef(subjectId: string): DocumentReference {
    return firestore.doc(`${SUBJECTS_COLLECTION_NAME}/${subjectId}`);
}