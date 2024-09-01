import {Firestore} from "@google-cloud/firestore";
import {Storage} from "@google-cloud/storage";
import {BUCKET_NAME} from "../../constants/google-storage-constants";

export const firestore = new Firestore();
export const storage = new Storage().bucket(BUCKET_NAME);