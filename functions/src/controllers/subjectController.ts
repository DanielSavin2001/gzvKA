import {Request, Response} from "express";
import {https, HttpsFunction} from "firebase-functions";
import * as logger from "firebase-functions/logger";

import {validateCors} from "../utils/cors-helper";
import {isNotNullOrEmpty, isNullOrEmpty} from "../utils/string-helper";
import {SubjectFS} from "../../../sharedModels/interfaces";
import {subjectService} from "../services";

export const getSubject: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            const subjectId = request.query.subjectId?.toString();
            if (isNotNullOrEmpty(subjectId))
                response.send(await subjectService.getSubject(subjectId!));
            else
                response.status(400).send("Validation error - 'subjectId' query parameter is missing.")
        } catch (error) {
            logger.error("Error retrieving subject:", error);
            response.status(500).send("Error retrieving subject: " + error);
        }
    }
);

export const getAllSubjects: HttpsFunction = https.onRequest(
    async (request: Request, response: Response): Promise<any> => {
        response = validateCors(request, response);
        try {
            response.send(await subjectService.getAllSubjects());
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
                response.status(400).send("Validation error - 'name' query parameter is missing. ")

            await subjectService.createSubject(requestBody)

            response.sendStatus(200);
        } catch (error) {
            logger.error("Error creating subject: ", error);
            response.status(500).send("Error creating subject: " + error);
        }
    }
);