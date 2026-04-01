"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const encryption_util_1 = require("../utils/encryption.util");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function testWompi() {
    try {
        console.log('--- Wompi Diagnostic ---');
        console.log('DB_HOST:', process.env.DB_HOST);
        console.log('DB_NAME:', process.env.DB_NAME);
        const result = await database_1.pool.query('SELECT wompi_env, wompi_public_key, wompi_private_key_enc, wompi_private_key_iv, wompi_private_key_tag FROM configuracionglobal WHERE id = 1');
        const rows = result?.[0] || result?.rows || result;
        const row = Array.isArray(rows) ? rows[0] : undefined;
        if (!row) {
            console.error('No configuration found for id=1');
            return;
        }
        console.log('Env:', row.wompi_env);
        console.log('Public Key:', row.wompi_public_key);
        const enc = row.wompi_private_key_enc;
        const iv = row.wompi_private_key_iv;
        const tag = row.wompi_private_key_tag;
        if (enc && iv && tag) {
            try {
                const privateKey = (0, encryption_util_1.decryptString)({ enc, iv, tag });
                console.log('Private Key decrypted successfully (starts with):', privateKey.substring(0, 8));
            }
            catch (e) {
                console.error('Decryption failed:', e.message);
            }
        }
        else {
            console.log('Private key fields missing or empty.');
        }
        const baseUrl = row.wompi_env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
        const url = `${baseUrl}/merchants/${encodeURIComponent(row.wompi_public_key)}`;
        console.log('Testing Wompi GET:', url);
        const resp = await fetch(url);
        console.log('Response Status:', resp.status);
        const text = await resp.text();
        console.log('Response Body:', text.substring(0, 200));
    }
    catch (error) {
        console.error('Diagnostic failed:', error);
    }
    finally {
        process.exit(0);
    }
}
testWompi();
