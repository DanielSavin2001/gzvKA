import {Firestore} from "@google-cloud/firestore";
import {Storage} from "@google-cloud/storage";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getBucketName} from "../../constants/google-storage-constants";

export const firestore = new Firestore();
export const storage = new Storage().bucket(getBucketName());

/**
 * Firebase Authentication, used to check that whoever is asking to approve a photograph is
 * a curator of this archive.
 *
 * The Admin SDK is initialised here rather than at the top of every function that needs it:
 * calling `initializeApp` twice throws, and a Cloud Functions instance serves many requests.
 * On Cloud Functions the default credentials are the ones the function already runs as, so
 * there is nothing to configure.
 */
if (getApps().length === 0) {
  initializeApp();
}

export const auth = getAuth();
