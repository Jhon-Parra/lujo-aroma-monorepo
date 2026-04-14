"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
exports.deleteFile = deleteFile;
const firebase_1 = require("../config/firebase");
const uuid_1 = require("uuid");
const image_util_1 = require("./image.util");
const upload_middleware_1 = require("../middleware/upload.middleware");
/**
 * Sube un archivo a Firebase Storage con optimización automática para imágenes.
 * @param file Objeto file de Multer
 * @param options Opciones de subida y optimización
 * @returns URL pública del archivo
 */
async function uploadFile(file, options = {}) {
    const holdsFile = file && file.buffer && file.buffer.length > 0;
    if (!firebase_1.bucket && holdsFile) {
        const debug = process.env.FIREBASE_DEBUG === 'true';
        if (!debug) {
            throw new Error('Firebase Storage no está configurado correctamente en este entorno. Verifica las credenciales en el servidor.');
        }
        // Diagnóstico seguro (sin exponer secretos)
        const missing = Object.entries(firebase_1.firebaseDiagnostics.env)
            .filter(([, ok]) => !ok)
            .map(([k]) => k);
        const extra = [
            missing.length ? `Missing: ${missing.join(', ')}` : '',
            firebase_1.firebaseDiagnostics.lastInitError ? `InitError: ${firebase_1.firebaseDiagnostics.lastInitError}` : '',
            firebase_1.firebaseDiagnostics.loadedEnvFrom ? `EnvFile: loaded` : 'EnvFile: not-found'
        ].filter(Boolean).join(' | ');
        throw new Error(`Firebase Storage no está configurado correctamente en este entorno. ${extra}`);
    }
    // Usamos una referencia local para que TypeScript sepa que no es null después de esta validación
    const b = firebase_1.bucket;
    const { folder = 'general', ...optimizeOptions } = options;
    let buffer = file.buffer;
    let contentType = file.mimetype;
    let originalName = (0, upload_middleware_1.sanitizeFilename)(file.originalname || 'unknown');
    let filename = originalName;
    // Optimizar si es imagen (excepto GIFs ya que sharp los aplana a menos que se configure extra)
    if ((0, image_util_1.isOptimizableImage)(file.mimetype)) {
        try {
            const optimized = await (0, image_util_1.optimizeImage)(file.buffer, optimizeOptions);
            buffer = optimized.buffer;
            contentType = optimized.contentType;
            // Cambiar extensión a .webp
            filename = originalName.replace(/\.[^/.]+$/, "") + optimized.extension;
        }
        catch (error) {
            console.warn('Image optimization failed, using original:', error);
        }
    }
    // Agregar un prefijo único para evitar colisiones
    const uniqueName = `${Date.now()}-${(0, uuid_1.v4)().slice(0, 8)}-${filename}`;
    const destination = `${folder}/${uniqueName}`;
    const fileRef = b.file(destination);
    const saveOptions = {
        metadata: {
            contentType: contentType,
            cacheControl: 'public, max-age=31536000'
        },
        resumable: false
    };
    // Intentar dejarlo público (si el bucket permite ACL). Si falla (Uniform bucket-level access),
    // reintentamos sin ACL y devolvemos un signed URL de larga duración.
    try {
        await fileRef.save(buffer, {
            ...saveOptions,
            public: true
        });
        return `https://storage.googleapis.com/${b.name}/${destination}`;
    }
    catch (e) {
        const msg = String(e?.message || '');
        console.warn('⚠️ Firebase Storage: no se pudo marcar como público, usando URL firmada.', msg.slice(0, 300));
        await fileRef.save(buffer, saveOptions);
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
async function deleteFile(urlOrPath) {
    try {
        if (!urlOrPath || typeof urlOrPath !== 'string') {
            return;
        }
        if (!firebase_1.bucket) {
            console.warn('⚠️ No se puede eliminar archivo: Firebase Storage no configurado.');
            return;
        }
        let path = urlOrPath;
        // Caso 1: URL de Storage de Google Cloud (https://storage.googleapis.com/bucket/path)
        if (urlOrPath.includes('storage.googleapis.com')) {
            const parts = urlOrPath.split(`${firebase_1.bucket.name}/`);
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
        const b = firebase_1.bucket;
        const fileRef = b.file(path);
        const [exists] = await fileRef.exists();
        if (exists) {
            await fileRef.delete();
            console.log(`✅ Archivo eliminado físicamente de Firebase Storage: ${path}`);
        }
        else {
            console.warn(`⚠️ Intento de borrar archivo inexistente en Storage: ${path}`);
        }
    }
    catch (error) {
        console.error('❌ Error eliminando archivo de Storage:', error?.message || String(error));
    }
}
