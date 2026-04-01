"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptString = exports.encryptString = void 0;
const crypto_1 = __importDefault(require("crypto"));
const loadKey = () => {
    const raw = String(process.env.SETTINGS_ENCRYPTION_KEY || '').trim();
    if (!raw) {
        throw new Error('SETTINGS_ENCRYPTION_KEY no esta configurado');
    }
    let key;
    // Primero intentamos como Hex (64 caracteres)
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
        key = Buffer.from(raw, 'hex');
    }
    // Otros casos (ej. Base64 de 44 caracteres como el del usuario)
    else {
        try {
            key = Buffer.from(raw, 'base64');
        }
        catch (e) {
            throw new Error('SETTINGS_ENCRYPTION_KEY no tiene un formato válido (Hex o Base64)');
        }
    }
    if (key.length !== 32) {
        throw new Error(`SETTINGS_ENCRYPTION_KEY debe derivar en 32 bytes (AES-256). Detectados: ${key.length} bytes. Longitud string: ${raw.length}`);
    }
    return key;
};
const encryptString = (plain) => {
    const key = loadKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        enc: enc.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
    };
};
exports.encryptString = encryptString;
const decryptString = (payload) => {
    const key = loadKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.enc, 'base64');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString('utf8');
};
exports.decryptString = decryptString;
