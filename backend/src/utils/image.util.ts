import sharp from 'sharp';

export interface OptimizeImageOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Optimiza una imagen convirtiéndola a WebP y redimensionándola si es necesario.
 * @param buffer El buffer de la imagen original.
 * @param options Opciones de optimización.
 * @returns Un objeto con el nuevo buffer y el tipo MIME.
 */
export async function optimizeImage(
    buffer: Buffer,
    options: OptimizeImageOptions = {}
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 80,
        format = 'webp'
    } = options;

    let pipeline = sharp(buffer);

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
    } else if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality });
    } else if (format === 'png') {
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
export function isOptimizableImage(mimetype: string): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    return validTypes.includes(mimetype.toLowerCase());
}
