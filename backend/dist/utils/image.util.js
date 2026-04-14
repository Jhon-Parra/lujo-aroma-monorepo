"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeImage = optimizeImage;
exports.isOptimizableImage = isOptimizableImage;
const sharp_1 = __importDefault(require("sharp"));
/**
 * Optimiza una imagen convirtiéndola a WebP y redimensionándola si es necesario.
 * @param buffer El buffer de la imagen original.
 * @param options Opciones de optimización.
 * @returns Un objeto con el nuevo buffer y el tipo MIME.
 */
async function optimizeImage(buffer, options = {}) {
    const { maxWidth = 1200, maxHeight = 1200, quality = 80, format = 'webp' } = options;
    let pipeline = (0, sharp_1.default)(buffer);
    // Obtener metadatos para validar si es una imagen válida
    const metadata = await pipeline.metadata();
    if (!metadata.format) {
        throw new Error('Formato de imagen no soportado o archivo corrupto');
    }
    // Redimensionar manteniendo la proporción si supera los límites
    pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true
    });
    // Convertir al formato seleccionado (WebP por defecto)
    if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
    }
    else if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality });
    }
    else if (format === 'png') {
        pipeline = pipeline.png({ quality });
    }
    const optimizedBuffer = await pipeline.toBuffer();
    return {
        buffer: optimizedBuffer,
        contentType: `image/${format}`,
        extension: `.${format}`
    };
}
/**
 * Verifica si un archivo es una imagen que podemos optimizar (no GIFs animados ni videos).
 * @param mimetype El tipo MIME del archivo.
 * @returns boolean
 */
function isOptimizableImage(mimetype) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    return validTypes.includes(mimetype.toLowerCase());
}
