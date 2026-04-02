"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseAdmin = exports.bucket = void 0;
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar siempre el .env del backend, independiente del working directory.
dotenv.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
let isInitialized = false;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'lujoyaroma-c1d28.firebasestorage.app';
    if (serviceAccountJson) {
        let serviceAccount;
        try {
            // Limpiar posibles problemas de escape si viene de variables de entorno de shell/hosting
            const cleanJson = serviceAccountJson.trim().replace(/^'|'$/g, '');
            serviceAccount = JSON.parse(cleanJson);
        }
        catch (e) {
            // Segundo intento: Reemplazar \n literales si vienen de una cadena mal escapada
            serviceAccount = JSON.parse(serviceAccountJson.replace(/\\n/g, '\n').replace(/^'|'$/g, ''));
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket
        });
        isInitialized = true;
        console.log('✅ Firebase Admin inicializado correctamente con Service Account.');
    }
    else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no encontrado en .env. Intentando inicialización por defecto.');
        admin.initializeApp({
            storageBucket: storageBucket
        });
        isInitialized = true;
    }
}
catch (error) {
    console.error('❌ Error crítico al inicializar Firebase Admin:', error);
}
// Exportar el bucket de forma segura. Si no se inicializó, las llamadas a bucket fallarán 
// pero no detendrán el arranque del servidor.
exports.bucket = isInitialized ? admin.storage().bucket() : null;
exports.firebaseAdmin = admin;
exports.default = admin;
