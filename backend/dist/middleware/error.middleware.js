"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.OperationalError = exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Error interno del servidor';
    if (process.env.NODE_ENV === 'development') {
        console.error('🔴 Error:', {
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            body: req.body
        });
    }
    else {
        console.error('🔴 Error:', message);
    }
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
class OperationalError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.OperationalError = OperationalError;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
};
exports.notFoundHandler = notFoundHandler;
