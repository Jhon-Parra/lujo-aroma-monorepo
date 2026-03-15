import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm'
];

const ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm'
];

const ALLOWED_SPREADSHEET_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Imagenes/GIFs)
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB (Videos)
const MAX_SPREADSHEET_SIZE = 20 * 1024 * 1024; // 20MB

// Hero media (puede ser video); multer usa un solo limite global
const MAX_SETTINGS_MEDIA_SIZE = 35 * 1024 * 1024; // 35MB
const MAX_SETTINGS_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
    }
};

const spreadsheetFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const looksLikeSpreadsheet = ext === '.xlsx' || ext === '.xls' || ext === '.csv';
    if (ALLOWED_SPREADSHEET_MIME_TYPES.includes(file.mimetype) || looksLikeSpreadsheet) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Sube un .xlsx o .csv'));
    }
};

const sanitizeFilename = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const name = path.basename(filename, ext);
    const sanitized = name
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .substring(0, 50);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `${sanitized}-${randomSuffix}${ext}`;
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_VIDEO_SIZE, // Permitir hasta el maximo de video por defecto, luego validamos por tipo si es necesario
        files: 2
    },
    fileFilter
});

// Upload especial para /settings: permite hero_media (imagen/gif/video) y logo_image (solo imagen)
export const uploadSettingsAssets = (req: any, res: any, next: any) => {
    const settingsUpload = multer({
        storage,
        limits: {
            fileSize: MAX_SETTINGS_MEDIA_SIZE,
            files: 3
        },
        fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
            const field = String(file.fieldname || '');

            if (field === 'logo_image') {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
                return cb(new Error('Tipo de archivo no permitido para logo. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
            }

            if (field === 'envio_prioritario_image' || field === 'perfume_lujo_image') {
                if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                    return cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
                }
                // validacion de tamaño por imagen (multer no permite limite por campo); se revalida en controller
                return cb(null, true);
            }

            if (field === 'hero_media' || field === 'hero_image') {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
                    return cb(null, true);
                }
                return cb(new Error('Tipo de archivo no permitido para el banner. Permite JPEG/PNG/GIF/WebP o MP4/WebM'));
            }

            // Fallback: tratar como imagen
            if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Tipo de archivo no permitido.'));
        }
    }).fields([
        { name: 'hero_media', maxCount: 1 },
        { name: 'hero_image', maxCount: 1 },
        { name: 'logo_image', maxCount: 1 },
        { name: 'envio_prioritario_image', maxCount: 1 },
        { name: 'perfume_lujo_image', maxCount: 1 }
    ]);

    settingsUpload(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 35MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

const uploadSpreadsheet = multer({
    storage,
    limits: {
        fileSize: MAX_SPREADSHEET_SIZE,
        files: 1
    },
    fileFilter: spreadsheetFileFilter
});

export const uploadSingleImage = (req: any, res: any, next: any) => {
    upload.single('imagen')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen es demasiado grande. El límite es de 10MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

export const uploadSingleSpreadsheet = (req: any, res: any, next: any) => {
    uploadSpreadsheet.single('archivo')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 20MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

export { sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, ALLOWED_SPREADSHEET_MIME_TYPES, MAX_SPREADSHEET_SIZE };
export default upload;
