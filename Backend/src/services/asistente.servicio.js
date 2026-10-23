const OpenAI = require('openai');
const { CONTEXTO_CODEXIA } = require('../config/asistente.config');

const client = new OpenAI({
    baseURL: process.env.GROQ_BASE_URL || process.env.BASE_URL,
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Obtiene la respuesta de la IA manteniendo el contexto de la conversación.
 *
 * @param {string} mensajeUsuario - Último mensaje enviado por el usuario.
 * @param {Array<{role: string, content: string}>} historial - Mensajes previos de la conversación.
 * @returns {Promise<string>} Texto de la respuesta de la IA.
 */
const obtenerRespuestaGroq = async (mensajeUsuario, historial = []) => {
    try {
        
        const chatCompletion = await client.chat.completions.create({
            model: process.env.GROQ_MODEL || process.env.OpenAI_API_VERSION,
            messages: [
                {
                    role: "system",
                    content: CONTEXTO_CODEXIA
                },
                ...historial,
                {
                    role: "user",
                    content: mensajeUsuario
                }
            ]
        });
     
        // Retorna el texto limpio obtenido de Groq
        const contenido = chatCompletion.choices?.[0]?.message?.content;
        if (typeof contenido !== 'string' || contenido.trim() === '') {
            throw new Error('Groq devolvió una respuesta sin texto válido');
        }

        return contenido;

    } catch (error) {
        console.error("Error directo en la API:", error);
        throw error; // Lanza el error para que lo capture el controlador
    }
};

module.exports = {
    obtenerRespuestaGroq
};
