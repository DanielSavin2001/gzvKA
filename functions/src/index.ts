import * as controllers from './controllers';

/**
 * Functions related to the Data Controller
 *
 * Retrieves GeoJSON data from the database.
 * @function getGeoJson
 *
 * Creates the GeoJSON data manually.
 * @function createGeoJson
 *
 * Sets-up the GeoJSON data automatically via recurring job.
 * @function createGeoJsonJob
 */
export const getGeoJson = controllers.dataController.getGeoJson;
export const createGeoJson = controllers.dataController.createGeoJson;
export const createGeoJsonJob = controllers.dataController.createGeoJsonJob;

/**
 * Functions related to the Subject Controller
 *
 * Retrieves all subjects from the database.
 * @function getAllSubjects
 *
 * Retrieves a subject from the database.
 * @function getSubject
 *
 * Creates a new subject in the database.
 * @function createSubject
 *
 */
export const getAllSubjects = controllers.subjectController.getAllSubjects;
export const getSubject = controllers.subjectController.getSubject;
export const createSubject = controllers.subjectController.createSubject;

/**
 * Functions related to the Image Controller
 *
 * Handles the uploading of images related to subjects.
 * @function uploadImages
 *
 * Retrieves all Images of a subject from the database.
 * @function getImageDocuments
 *
 * Retrieves Image from Google Storage by imgURL
 * @function retrieveImage
 */
export const uploadImages = controllers.imageController.uploadImages;
export const getImageDocuments = controllers.imageController.getImageDocuments;
export const retrieveImage = controllers.imageController.retrieveImage;

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
