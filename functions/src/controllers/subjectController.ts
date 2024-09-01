import {Request, Response} from "express";
import {HttpsFunction, https} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {SubjectFS} from "../../../sharedModels/interfaces";
import {validateCors} from "../utils/cors-helper";
import {isNullOrEmpty} from "../utils/string-helper";
import {subjectService} from "../services";

export const getAllSubjects: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            response.status(200).send(await subjectService.getAllSubjects());
        } catch (error) {
            logger.error("Error retrieving subjects:", error);
            response.status(500).send("Error retrieving subjects: " + error);
        }
    }
);

export const createSubject: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            const requestBody: SubjectFS = request.body;
            if (isNullOrEmpty(requestBody.name))
                response.status(400).send("Validation error - Name of the subject can not be empty.")

            await subjectService.createSubject(requestBody)

            response.sendStatus(200);
        } catch (error) {
            logger.error("Error creating subject: ", error);
            response.status(500).send("Error creating subject: " + error);
        }
    }
);