import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
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
    } else {
        console.error('🔴 Error:', message);
    }

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export class OperationalError extends Error implements AppError {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
};
