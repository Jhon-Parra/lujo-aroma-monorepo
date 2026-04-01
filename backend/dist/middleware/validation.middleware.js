"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
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
exports.validate = validate;
