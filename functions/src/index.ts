import * as controllers from './controllers';

/**
 * What this project deploys.
 *
 * Nine functions used to live above this line - getGeoJson, createGeoJson,
 * createGeoJsonJob, getAllSubjects, getSubject, createSubject, uploadImages,
 * getImageDocuments and retrieveImage. They served the old Firestore-backed site, whose
 * only page was `/detail/[id]`, and nothing has linked to that page since the archive
 * became a static index. They are gone with it.
 *
 * The Firestore documents and the Storage objects they read are untouched: removing a
 * function removes the way in, not the data.
 */

/**
 * Functions behind contributing a photograph and curating what arrives.
 *
 * Anyone may submit; only a curator on the `admins` list may see the queue or act on it.
 * `publishedPhotos` is what the website merges into the archive, so an approved photograph
 * appears without waiting for a rebuild.
 *
 * @function submitPhoto      public - accepts a contributed photograph
 * @function publishedPhotos  public - everything approved so far
 * @function listSubmissions  curators - the queue
 * @function reviewSubmission curators - approve, reject or withdraw
 * @function whoAmI           curators - confirms the caller curates this archive
 */
export const submitPhoto = controllers.submissionController.submitPhoto;
export const publishedPhotos = controllers.submissionController.publishedPhotos;
export const listSubmissions = controllers.submissionController.listSubmissions;
export const reviewSubmission = controllers.submissionController.reviewSubmission;
export const whoAmI = controllers.submissionController.whoAmI;

export const submitCorrection = controllers.correctionController.submitCorrection;
export const listCorrections = controllers.correctionController.listCorrections;
export const reviewCorrection = controllers.correctionController.reviewCorrection;

export const photoEdits = controllers.photoEditController.photoEdits;
export const savePhotoEdit = controllers.photoEditController.savePhotoEdit;
export const deletePhotoEdit = controllers.photoEditController.deletePhotoEdit;
