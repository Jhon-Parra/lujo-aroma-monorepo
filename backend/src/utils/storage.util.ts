import { bucket } from '../config/firebase';
import { supabase } from '../config/supabase';
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

    // Preferimos Firebase (si está configurado). Si no, hacemos fallback a Supabase Storage.
    if (bucket) {
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

        // URL pública estándar:
        // https://storage.googleapis.com/[BUCKET_NAME]/[FILE_PATH]
        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    }

    const supabaseBucket = String(process.env.SUPABASE_STORAGE_BUCKET || 'perfumissimo_bucket').trim();
    if (!supabaseBucket) {
        throw new Error('Storage no está configurado. Configura FIREBASE_SERVICE_ACCOUNT_JSON o SUPABASE_STORAGE_BUCKET.');
    }

    const { error } = await supabase.storage
        .from(supabaseBucket)
        .upload(destination, buffer, {
            contentType,
            upsert: true,
            cacheControl: '31536000'
        });

    if (error) {
        throw new Error(
            `No se pudo subir el archivo. Configura Firebase (FIREBASE_SERVICE_ACCOUNT_JSON) o habilita uploads en Supabase Storage (${supabaseBucket}). Detalle: ${error.message}`
        );
    }

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(destination);
    return data.publicUrl;
}

/**
 * Elimina un archivo de Firebase Storage a partir de su URL pública o path
 * @param urlOrPath URL completa o path del archivo
 */
export async function deleteFile(urlOrPath: string): Promise<void> {
    try {
        // Firebase
        if (bucket) {
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
            return;
        }

        // Supabase fallback
        const supabaseBucket = String(process.env.SUPABASE_STORAGE_BUCKET || 'perfumissimo_bucket').trim();
        if (!supabaseBucket) {
            console.warn('⚠️ No se puede eliminar archivo: Storage no configurado.');
            return;
        }

        let path = urlOrPath;
        if (/^https?:\/\//i.test(urlOrPath)) {
            // Formatos comunes:
            // .../storage/v1/object/public/<bucket>/<path>
            // .../storage/v1/object/sign/<bucket>/<path>
            const idx = urlOrPath.indexOf(`/${supabaseBucket}/`);
            if (idx >= 0) {
                path = decodeURIComponent(urlOrPath.slice(idx + supabaseBucket.length + 2));
            }
        }

        const { error } = await supabase.storage.from(supabaseBucket).remove([path]);
        if (error) {
            console.warn('⚠️ Error eliminando archivo de Supabase Storage:', error.message);
        }
    } catch (error) {
        console.error('❌ Error eliminando archivo de Storage:', error);
    }
}
