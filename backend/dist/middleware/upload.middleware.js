"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SPREADSHEET_SIZE = exports.ALLOWED_SPREADSHEET_MIME_TYPES = exports.MAX_FILE_SIZE = exports.ALLOWED_MIME_TYPES = exports.sanitizeFilename = exports.uploadSingleSpreadsheet = exports.uploadProductImages = exports.uploadSingleImage = exports.uploadSettingsAssets = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm'
];
exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
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
exports.ALLOWED_SPREADSHEET_MIME_TYPES = ALLOWED_SPREADSHEET_MIME_TYPES;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Imagenes/GIFs)
exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB (Videos)
const MAX_SPREADSHEET_SIZE = 20 * 1024 * 1024; // 20MB
exports.MAX_SPREADSHEET_SIZE = MAX_SPREADSHEET_SIZE;
// Hero media (puede ser video); multer usa un solo limite global
const MAX_SETTINGS_MEDIA_SIZE = 35 * 1024 * 1024; // 35MB
const MAX_SETTINGS_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
    }
};
const spreadsheetFileFilter = (req, file, cb) => {
    const ext = path_1.default.extname(file.originalname || '').toLowerCase();
    const looksLikeSpreadsheet = ext === '.xlsx' || ext === '.xls' || ext === '.csv';
    if (ALLOWED_SPREADSHEET_MIME_TYPES.includes(file.mimetype) || looksLikeSpreadsheet) {
        cb(null, true);
    }
    else {
        cb(new Error('Tipo de archivo no permitido. Sube un .xlsx o .csv'));
    }
};
const sanitizeFilename = (filename) => {
    const ext = path_1.default.extname(filename).toLowerCase();
    const name = path_1.default.basename(filename, ext);
    const sanitized = name
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .substring(0, 50);
    const randomSuffix = crypto_1.default.randomBytes(4).toString('hex');
    return `${sanitized}-${randomSuffix}${ext}`;
};
exports.sanitizeFilename = sanitizeFilename;
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: MAX_VIDEO_SIZE, // Permitir hasta el maximo de video por defecto, luego validamos por tipo si es necesario
        files: 2
    },
    fileFilter
});
// Upload especial para /settings: permite hero_media (imagen/gif/video) y logo_image (solo imagen)
const uploadSettingsAssets = (req, res, next) => {
    const settingsUpload = (0, multer_1.default)({
        storage,
        limits: {
            fileSize: MAX_SETTINGS_MEDIA_SIZE,
            fieldSize: 25 * 1024 * 1024, // 25MB para campos de texto ricos que pueden contener base64
            files: 20
        },
        fileFilter: (_req, file, cb) => {
            const field = String(file.fieldname || '');
            // Home premium assets (carousel + categories)
            if (field.startsWith('home_slide_') || field.startsWith('home_category_')) {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
                    return cb(null, true);
                }
                return cb(new Error('Tipo de archivo no permitido. Permite JPEG/PNG/GIF/WebP o MP4/WebM'));
            }
            if (field === 'logo_image') {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype))
                    return cb(null, true);
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
            if (ALLOWED_MIME_TYPES.includes(file.mimetype))
                return cb(null, true);
            return cb(new Error('Tipo de archivo no permitido.'));
        }
    }).fields([
        { name: 'hero_media', maxCount: 1 },
        { name: 'hero_image', maxCount: 1 },
        { name: 'logo_image', maxCount: 1 },
        { name: 'envio_prioritario_image', maxCount: 1 },
        { name: 'perfume_lujo_image', maxCount: 1 },
        { name: 'empaque_regalo_image', maxCount: 1 },
        // Home premium
        { name: 'home_slide_1_media', maxCount: 1 },
        { name: 'home_slide_2_media', maxCount: 1 },
        { name: 'home_slide_3_media', maxCount: 1 },
        { name: 'home_category_1_media', maxCount: 1 },
        { name: 'home_category_2_media', maxCount: 1 },
        { name: 'home_category_3_media', maxCount: 1 },
        { name: 'home_category_4_media', maxCount: 1 },
        // Optional posters (images) for video cards
        { name: 'home_category_1_poster', maxCount: 1 },
        { name: 'home_category_2_poster', maxCount: 1 },
        { name: 'home_category_3_poster', maxCount: 1 },
        { name: 'home_category_4_poster', maxCount: 1 }
    ]);
    settingsUpload(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 35MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadSettingsAssets = uploadSettingsAssets;
const uploadSpreadsheet = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: MAX_SPREADSHEET_SIZE,
        files: 1
    },
    fileFilter: spreadsheetFileFilter
});
const uploadSingleImage = (req, res, next) => {
    upload.single('imagen')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen es demasiado grande. El límite es de 10MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadSingleImage = uploadSingleImage;
const uploadProductImages = (req, res, next) => {
    const productUpload = (0, multer_1.default)({
        storage,
        limits: {
            fileSize: MAX_FILE_SIZE,
            files: 3
        },
        fileFilter
    }).fields([
        { name: 'imagen', maxCount: 1 },
        { name: 'imagen2', maxCount: 1 },
        { name: 'imagen3', maxCount: 1 }
    ]);
    productUpload(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Al menos una de las imágenes es demasiado grande. El límite es de 10MB por archivo.' });
            }
            return res.status(400).json({ error: `Error en la subida de imágenes: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadProductImages = uploadProductImages;
const uploadSingleSpreadsheet = (req, res, next) => {
    uploadSpreadsheet.single('archivo')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 20MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadSingleSpreadsheet = uploadSingleSpreadsheet;
exports.default = upload;
