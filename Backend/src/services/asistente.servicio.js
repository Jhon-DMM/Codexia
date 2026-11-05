const OpenAI = require('openai');
const { CONTEXTO_CODEXIA } = require('../config/asistente.config');

const client = new OpenAI({
  baseURL: process.env.GROQ_BASE_URL || process.env.BASE_URL,
  apiKey: process.env.GROQ_API_KEY,
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
      model: process.env.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: CONTEXTO_CODEXIA,
        },
        ...historial,
        {
          role: 'user',
          content: mensajeUsuario,
        },
      ],
    });

    // Retorna el texto limpio obtenido de Groq
    const contenido = chatCompletion.choices?.[0]?.message?.content;
    if (typeof contenido !== 'string' || contenido.trim() === '') {
      throw new Error('Groq devolvió una respuesta sin texto válido');
    }

    return contenido;
  } catch (error) {
    console.error('Error directo en la API:', error);
    throw error; // Lanza el error para que lo capture el controlador
  }
};

const generarTituloConversacion = async (consulta) => {
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Crea un título breve en español para una conversación de Codexia. Resume el tema de la consulta en 2 a 6 palabras y máximo 55 caracteres. No copies literalmente la consulta. Devuelve solo el título, sin comillas, emojis, Markdown ni explicación.',
      },
      { role: 'user', content: String(consulta).slice(0, 1200) },
    ],
    max_tokens: 32,
    temperature: 0.2,
  });

  const contenido = completion.choices?.[0]?.message?.content;
  if (typeof contenido !== 'string' || !contenido.trim()) {
    throw new Error('Groq no devolvió un título válido');
  }

  const titulo = contenido
    .split(/\r?\n/, 1)[0]
    .replace(/["'“”‘’]/g, '')
    .replace(/^[#*\-\s]+|[#*\s]+$/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

  if (!titulo) {
    throw new Error('El título generado no cumple el formato esperado');
  }
  if (titulo.length <= 60) return titulo;
  const palabras = titulo.split(' ');
  let breve = '';
  for (const palabra of palabras) {
    const siguiente = breve ? `${breve} ${palabra}` : palabra;
    if (siguiente.length > 60) break;
    breve = siguiente;
  }
  return breve || titulo.slice(0, 60).trim();
};

module.exports = {
  obtenerRespuestaGroq,
  generarTituloConversacion,
};
