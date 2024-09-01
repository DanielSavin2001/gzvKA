import * as controllers from "./controllers"

/**
 * Functions related to the Data Controller
 * 
 * Retrieves GeoJSON data from the database.
 * @function getGeoJson
 */
export const getGeoJson = controllers.dataController.getGeoJson;


/**
 * Functions related to the Subject Controller
 * 
 * Retrieves all subjects from the database.
 * @function getAllSubjects
 * 
 * Creates a new subject in the database.
 * @function createSubject
 * 
 */
export const getAllSubjects = controllers.subjectController.getAllSubjects
export const createSubject = controllers.subjectController.createSubject


/**
 * Functions related to the Image Controller
 * 
 * Handles the uploading of images related to subjects.
 * @function uploadImages
 */
export const uploadImages = controllers.imageController.uploadImages