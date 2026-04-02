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
    if (!bucket) {
        throw new Error('Firebase Storage no está configurado. Verifica FIREBASE_SERVICE_ACCOUNT_JSON y FIREBASE_STORAGE_BUCKET en tu entorno.');
    }

    const { folder = 'general', ...optimizeOptions } = options;
    
    let buffer = file.buffer;
    let contentType = file.mimetype;
    let originalName = sanitizeFilename(file.originalname || 'unknown');
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

    const saveOptions = {
        metadata: {
            contentType: contentType,
            cacheControl: 'public, max-age=31536000'
        },
        resumable: false
    } as const;

    // Intentar dejarlo público (si el bucket permite ACL). Si falla (Uniform bucket-level access),
    // reintentamos sin ACL y devolvemos un signed URL de larga duración.
    try {
        await fileRef.save(buffer, {
            ...saveOptions,
            public: true
        } as any);

        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    } catch (e: any) {
        const msg = String(e?.message || '');
        console.warn('⚠️ Firebase Storage: no se pudo marcar como público, usando URL firmada.', msg.slice(0, 300));

        await fileRef.save(buffer, saveOptions as any);

        const tenYears = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
        const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: tenYears
        });
        return signedUrl;
    }
}

/**
 * Elimina un archivo de Firebase Storage a partir de su URL pública o path
 * @param urlOrPath URL completa o path del archivo
 */
export async function deleteFile(urlOrPath: string): Promise<void> {
    try {
        if (!bucket) {
            console.warn('⚠️ No se puede eliminar archivo: Firebase Storage no configurado.');
            return;
        }

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
        console.error('❌ Error eliminando archivo de Storage:', error);
    }
}
