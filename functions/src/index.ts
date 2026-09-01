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
export const renameDonor = controllers.photoEditController.renameDonor;

/**
 * Functions behind placing whole places on the map from /beheer.
 *
 * The committed `place-coordinates.json` is the durable record; these pins are the live
 * layer over it, so a curator's click moves the map now rather than after a deploy.
 *
 * @function placePins    public - every curator-placed pin
 * @function savePlacePin curators - place or remove one pin
 */
export const placePins = controllers.placePinController.placePins;
export const savePlacePin = controllers.placePinController.savePlacePin;

/**
 * @function placeRecords      public - the places a curator made or corrected
 * @function savePlaceRecord   curators - create a place, or correct one
 * @function deletePlaceRecord curators - drop the overlay for one place
 */
export const placeRecords = controllers.placeRecordController.placeRecords;
export const savePlaceRecord = controllers.placeRecordController.savePlaceRecord;
export const deletePlaceRecord = controllers.placeRecordController.deletePlaceRecord;

/**
 * Functions behind "I know when this photograph was taken".
 *
 * 3,896 of the 4,504 photographs have no year, and no work inside this repository can
 * change that - a year is remembered, not derived. Accepting a suggestion writes it into
 * the same photo-edit overlay a curator's own correction lands in, so the timeline grows
 * without waiting for a rebuild.
 *
 * @function submitPhotoFact  public - somebody dates a photograph
 * @function listPhotoFacts   curators - the queue
 * @function reviewPhotoFact  curators - accept or reject
 */
export const submitPhotoFact = controllers.photoFactController.submitPhotoFact;
export const listPhotoFacts = controllers.photoFactController.listPhotoFacts;
export const reviewPhotoFact = controllers.photoFactController.reviewPhotoFact;
