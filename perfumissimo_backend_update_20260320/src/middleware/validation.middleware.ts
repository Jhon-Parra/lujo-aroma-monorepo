import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                console.error("Zod Validation Error:", errorMessages);
                res.status(400).json({
                    error: 'Error de validación de datos',
                    details: errorMessages
                });
                return;
            }
            res.status(500).json({ error: 'Error de validación' });
        }
    };
};
