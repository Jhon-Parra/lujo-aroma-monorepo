import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { appCache, CACHE_KEYS } from '../utils/cache.util';

// Preferir GEMINI_API_KEY. Se mantiene fallback a GROQ_API_KEY para facilitar migracion.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

/**
 * Endpoint: POST /api/ai/generate-description
 * Descripción: Asistente IA para CMS. Genera una descripción de lujo basada en producto y notas.
 * Requiere Auth JWT y Rol ADMIN.
 */
export const generateAIDescription = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre = '', name = '', notas_olfativas = '', notes = '' } = req.body;
        const nombreFinal = name || nombre;
        const notasFinal = notes || notas_olfativas;

        const makeSimulated = (): string => {
            const safeName = String(nombreFinal || '').trim().slice(0, 60);
            const firstNote = String(notasFinal || '')
                .split(/,|\-|\||\//)
                .map((s) => s.trim())
                .filter(Boolean)[0] || String(notasFinal || '').trim().slice(0, 40);

            let text = `${safeName}: ${firstNote}. Estela elegante y adictiva.`.trim();
            if (text.length > 150) {
                text = text.slice(0, 147).trimEnd() + '...';
            }
            return text;
        };

        // Validar entradas básicas
        if (!nombreFinal || !notasFinal) {
            res.status(400).json({
                error: 'Para la Generación AI, se requiere proporcionar el Nombre del producto y sus notas olfativas.'
            });
            return;
        }

        if (!GEMINI_API_KEY || !gemini) {
            console.warn('GEMINI_API_KEY no proporcionada. Usando respuesta simulada...');
            res.status(200).json({
                message: 'Descripción generada exitosamente (Modo Simulación).',
                mode: 'SIMULATION',
                data: makeSimulated()
            });
            return;
        }

        // Prompt enriquecido (Maestro) para Generación Textual de Alta Calidad (Luxury E-commerce)
        const systemPrompt = `Asume el rol de una persona experta y apasionada que describe perfumes para "Lujo&Aroma | Perfumes Bogotá", una tienda de e-commerce de perfumería de alta gama. Tu función es describir el perfume de manera muy breve pero chévere.`;

        const userPrompt = `Haz una descripción muy breve pero chévere, atractiva y orientada a la compra para el siguiente perfume:
- Nombre Oficial: ${String(nombreFinal).slice(0, 100)}
- Notas Olfativas Presentes: ${String(notasFinal).slice(0, 300)}

IMPORTANTE: La salida debe tener ESTRICTAMENTE menos de 150 caracteres en total. Solo una o dos oraciones contundentes. No agregues saludos, código, ni frases genéricas vacías. Usa un tono sensorial puro y cautivador.`;

        const contentResponse = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\n${userPrompt}`
        });

        const generatedText = String(contentResponse.text || '').trim();
        if (!generatedText) {
            res.status(200).json({
                message: 'Descripción generada exitosamente (Modo Simulación).',
                mode: 'SIMULATION',
                warning: 'GEMINI_EMPTY',
                data: makeSimulated()
            });
            return;
        }

        res.status(200).json({
            message: 'Descripción generada exitosamente mediante Gemini.',
            mode: 'GEMINI',
            data: generatedText
        });
    } catch (error) {
        // No romper el flujo del CMS: si Gemini falla, devolvemos una descripción simulada.
        const anyErr: any = error as any;
        const status = Number(anyErr?.status || anyErr?.response?.status || 0) || null;
        const message = String(anyErr?.message || anyErr?.error?.message || '').slice(0, 500);
        console.error('Error Generando AI description (Gemini):', { status, message });

        const nombreFinal = (req.body?.name || req.body?.nombre || '').toString();
        const notasFinal = (req.body?.notes || req.body?.notas_olfativas || '').toString();

        const safeName = String(nombreFinal || '').trim().slice(0, 60);
        const firstNote = String(notasFinal || '')
            .split(/,|\-|\||\//)
            .map((s) => s.trim())
            .filter(Boolean)[0] || String(notasFinal || '').trim().slice(0, 40);
        let text = `${safeName}: ${firstNote}. Estela elegante y adictiva.`.trim();
        if (text.length > 150) {
            text = text.slice(0, 147).trimEnd() + '...';
        }

        res.status(200).json({
            message: 'Descripción generada exitosamente (Modo Simulación).',
            mode: 'SIMULATION',
            warning: status ? `GEMINI_ERROR_${status}` : 'GEMINI_ERROR',
            data: text
        });
    }
};

/**
 * Función interna para refinar búsquedas mediante IA.
 * Traduce lenguaje natural (ej: "fresco para oficina") en keywords técnicas.
 */
export const refineSearchQuery = async (query: string): Promise<string[]> => {
    if (!GEMINI_API_KEY || !gemini || !query || query.length < 3) return [];
    
    // Optimizacion 1: Bypass para palabras simples (marcas, notas directas)
    // Si no hay espacios, es una busqueda directa que no necesita IA.
    const trimmed = query.trim();
    if (!trimmed.includes(' ')) return [trimmed.toLowerCase()];

    // Optimizacion 2: Cache de resultados previos
    const cacheKey = `${CACHE_KEYS.AI_REFINE}${trimmed.toLowerCase()}`;
    const cached = appCache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
        const systemPrompt = `Eres un sumiller de perfumes experto. Convierte la consulta del usuario en una lista de 5-8 palabras clave técnicas (notas, familias olfativas o estilos) separadas por comas.
Ejemplo: "dulce y para oficina" -> "vainilla, caramelo, ambar, elegante, profesional, limpio, suave"
Ejemplo: "fresco para deporte" -> "citrico, acuatico, marino, fresco, sport, dinamico"

IMPORTANTE: Responde ÚNICAMENTE con la lista de palabras clave separadas por comas, sin etiquetas, explicaciones ni números.`;

        const contentResponse: any = await (gemini as any).models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `${systemPrompt}\n\nConsulta: "${query}"`
        });

        const text = String(contentResponse.text || '').trim();
        
        // Limpiar y tokenizar
        const tokens = text.split(',')
            .map((s: string) => s.trim().toLowerCase())
            .filter((s: string) => s.length > 2);

        // Guardar en cache (6 horas = 21,600,000 ms)
        if (tokens.length > 0) {
            appCache.set(cacheKey, tokens, 6 * 60 * 60 * 1000);
        }

        return tokens;
    } catch (error) {
        console.error('Error al refinar búsqueda con IA:', error);
        return [];
    }
};
