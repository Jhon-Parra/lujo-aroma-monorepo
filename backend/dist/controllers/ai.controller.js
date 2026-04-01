"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIDescription = void 0;
const openai_1 = __importDefault(require("openai"));
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Instanciar cliente apuntando a la API de Groq
const openai = new openai_1.default({
    apiKey: GROQ_API_KEY || '',
    baseURL: "https://api.groq.com/openai/v1"
});
/**
 * Endpoint: POST /api/products/generate-description
 * Descripción: Asistente IA para CMS. Genera una descripción de lujo basada en producto y notas.
 * Requiere Auth JWT y Rol ADMIN.
 */
const generateAIDescription = async (req, res) => {
    try {
        const { nombre = '', name = '', notas_olfativas = '', notes = '' } = req.body;
        const nombreFinal = name || nombre;
        const notasFinal = notes || notas_olfativas;
        // Validar entradas básicas
        if (!nombreFinal || !notasFinal) {
            res.status(400).json({
                error: 'Para la Generación AI, se requiere proporcionar el Nombre del producto y sus notas olfativas.'
            });
            return;
        }
        if (!GROQ_API_KEY) {
            console.warn('GROQ_API_KEY no proporcionada. Usando respuesta simulada...');
            const fallbackDescription = `Sumérgete en la exclusividad con ${nombre}, una fragancia diseñada para la seducción. Con sus sutiles notas de ${notas_olfativas}, despliega un aura de sofisticación y poder que perdura. \n\nCreada especialmente para realzar tu distinción, esta esencia te acompañará en tus momentos más inolvidables, dejando una estela embriagadora e imposible de ignorar.`;
            res.status(200).json({
                message: 'Descripción generada exitosamente (Modo Simulación).',
                data: fallbackDescription
            });
            return;
        }
        // Prompt enriquecido (Maestro) para Generación Textual de Alta Calidad (Luxury E-commerce)
        const systemPrompt = `Asume el rol de una persona experta y apasionada que describe perfumes para "Lujo&Aroma | Perfumes Bogotá", una tienda de e-commerce de perfumería de alta gama. Tu función es describir el perfume de manera muy breve pero chévere.`;
        const userPrompt = `Haz una descripción muy breve pero chévere, atractiva y orientada a la compra para el siguiente perfume:
- Nombre Oficial: ${String(nombreFinal).slice(0, 100)}
- Notas Olfativas Presentes: ${String(notasFinal).slice(0, 300)}

IMPORTANTE: La salida debe tener ESTRICTAMENTE menos de 150 caracteres en total. Solo una o dos oraciones contundentes. No agregues saludos, código, ni frases genéricas vacías. Usa un tono sensorial puro y cautivador.`;
        // Generación de contenido usando la API de Groq
        const contentResponse = await openai.chat.completions.create({
            model: 'llama-3.1-8b-instant', // Modelo veloz y asertivo de Groq
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 300
        });
        const generatedText = contentResponse.choices[0]?.message?.content || '';
        res.status(200).json({
            message: 'Descripción generada exitosamente mediante Groq.',
            data: generatedText
        });
    }
    catch (error) {
        console.error('Error Generando AI description (Groq):', error);
        res.status(500).json({ error: 'Ocurrió un error inesperado al conectar con el servicio de Inteligencia Artificial.' });
    }
};
exports.generateAIDescription = generateAIDescription;
