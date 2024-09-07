import * as controllers from "./controllers"

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
export const getAllSubjects = controllers.subjectController.getAllSubjects
export const getSubject = controllers.subjectController.getSubject
export const createSubject = controllers.subjectController.createSubject


/**
 * Functions related to the Image Controller
 *
 * Handles the uploading of images related to subjects.
 * @function uploadImages
 */
export const uploadImages = controllers.imageController.uploadImages