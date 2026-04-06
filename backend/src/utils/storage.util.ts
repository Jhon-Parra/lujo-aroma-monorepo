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
    const holdsFile = file && file.buffer && file.buffer.length > 0;
    
    if (!bucket && holdsFile) {
        throw new Error('Firebase Storage no está configurado correctamente en este entorno. Verifica las credenciales en el servidor.');
    }

    // Usamos una referencia local para que TypeScript sepa que no es null después de esta validación
    const b = bucket!;


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

    const fileRef = b.file(destination);

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

        return `https://storage.googleapis.com/${b.name}/${destination}`;
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
 * Elimina un archivo de Firebase Storage a partir de su URL pública, URL de descarga o path
 * @param urlOrPath URL completa o path del archivo
 */
export async function deleteFile(urlOrPath: string): Promise<void> {
    try {
        if (!urlOrPath || typeof urlOrPath !== 'string') {
            return;
        }

        if (!bucket) {
            console.warn('⚠️ No se puede eliminar archivo: Firebase Storage no configurado.');
            return;
        }

        let path = urlOrPath;

        // Caso 1: URL de Storage de Google Cloud (https://storage.googleapis.com/bucket/path)
        if (urlOrPath.includes('storage.googleapis.com')) {
            const parts = urlOrPath.split(`${bucket.name}/`);
            if (parts.length > 1) {
                path = decodeURIComponent(parts[1]);
            }
        } 
        // Caso 2: URL de descarga de Firebase (https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media)
        else if (urlOrPath.includes('firebasestorage.googleapis.com')) {
            const parts = urlOrPath.split('/o/');
            if (parts.length > 1) {
                // El path está codificado y termina antes de cualquier query param (?)
                const encodedPath = parts[1].split('?')[0];
                path = decodeURIComponent(encodedPath);
            }
        }

        const b = bucket!;
        const fileRef = b.file(path);
        const [exists] = await fileRef.exists();
        if (exists) {
            await fileRef.delete();
            console.log(`✅ Archivo eliminado físicamente de Firebase Storage: ${path}`);
        } else {
            console.warn(`⚠️ Intento de borrar archivo inexistente en Storage: ${path}`);
        }
    } catch (error: any) {
        console.error('❌ Error eliminando archivo de Storage:', error?.message || String(error));
    }
}

