import { bucket } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import { optimizeImage, isOptimizableImage } from './image.util';
import { sanitizeFilename } from '../middleware/upload.middleware';

export interface UploadOptions {
    folder?: string;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

/**
 * Sube un archivo a Firebase Storage con optimización automática para imágenes.
 * @param file Objeto file de Multer
 * @param options Opciones de subida y optimización
 * @returns URL pública del archivo
 */
export async function uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {}
): Promise<string> {
    const { folder = 'general', ...optimizeOptions } = options;
    
    let buffer = file.buffer;
    let contentType = file.mimetype;
    let originalName = sanitizeFilename(file.originalname);
    let filename = originalName;

    // Optimizar si es imagen (excepto GIFs ya que sharp los aplana a menos que se configure extra)
    if (isOptimizableImage(file.mimetype)) {
        try {
            const optimized = await optimizeImage(file.buffer, optimizeOptions);
            buffer = optimized.buffer;
            contentType = optimized.contentType;
            // Cambiar extensión a .webp
            filename = originalName.replace(/\.[^/.]+$/, "") + optimized.extension;
        } catch (error) {
            console.warn('Image optimization failed, using original:', error);
        }
    }

    // Agregar un prefijo único para evitar colisiones
    const uniqueName = `${Date.now()}-${uuidv4().slice(0, 8)}-${filename}`;
    const destination = `${folder}/${uniqueName}`;
    const fileRef = bucket.file(destination);

    // Subir a Firebase Storage
    await fileRef.save(buffer, {
        metadata: {
            contentType: contentType,
            cacheControl: 'public, max-age=31536000'
        },
        public: true, // Hacerlo público si el bucket lo permite
        resumable: false
    });

    // En Firebase Storage, la URL pública estándar sigue un patrón:
    // https://storage.googleapis.com/[BUCKET_NAME]/[FILE_PATH]
    // O mediante getPublicUrl() de la librería de admin
    return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}

/**
 * Elimina un archivo de Firebase Storage a partir de su URL pública o path
 * @param urlOrPath URL completa o path del archivo
 */
export async function deleteFile(urlOrPath: string): Promise<void> {
    try {
        let path = urlOrPath;
        if (urlOrPath.includes('storage.googleapis.com')) {
            const parts = urlOrPath.split(`${bucket.name}/`);
            if (parts.length > 1) {
                path = decodeURIComponent(parts[1]);
            }
        }
        
        const fileRef = bucket.file(path);
        const [exists] = await fileRef.exists();
        if (exists) {
            await fileRef.delete();
            console.log(`✅ Archivo eliminado: ${path}`);
        }
    } catch (error) {
        console.error('❌ Error eliminando archivo de Firebase:', error);
    }
}
