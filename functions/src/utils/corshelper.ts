import {Request, Response} from "express";

export const validateCors = (request: Request, response: Response) => {
    const allowedOrigins = [
        "http://localhost:5173", "https://gzvka.com"
    ];
    if (request.headers.origin != null) {
        const origin: string = request.headers.origin;

        if (allowedOrigins.includes(origin)) {
            // Allow requests from specified origins
            response.setHeader('Access-Control-Allow-Origin', origin);
            response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PATCH');
            response.setHeader(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization'
            ); // Allow the Authorization header
            response.setHeader('Access-Control-Max-Age', '3600'); // Cache preflight response for 1 hour
        }

        if (request.method === 'OPTIONS') {
            // Handle preflight requests
            response.status(204).send();
        }

    }
    return response;
};