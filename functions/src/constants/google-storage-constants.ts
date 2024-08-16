import { config } from "firebase-functions";

export const BUCKET_NAME = config().functions.bucket_name; 
