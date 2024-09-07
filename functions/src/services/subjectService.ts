import {firestore} from "./externalServices";
import {Subject, SubjectFS} from "../../../sharedModels/interfaces";
import {SUBJECTS_COLLECTION_NAME} from "../constants/google-storage-constants";

export async function getSubject(subjectId: string): Promise<Subject> {

    return (await firestore.collection(SUBJECTS_COLLECTION_NAME).doc(subjectId).get()).data() as Subject
}

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
