const { randomUUID } = require('crypto');
const asistenteService = require('../services/asistente.servicio');
const conversacionStore = require('../stores/conversacion.store');

const procesarMensaje = async (req, res) => {
    const { mensaje, conversationId, clientMessageId } = req.body;

    // 1. Valida que el mensaje no esté vacío
    if (!mensaje || mensaje.trim() === '') {
        return res.status(400).json({
            error: 'Debes escribir tu mensaje'
        });
    }

    // 2. Validar clientMessageId (requerido para idempotencia)
    if (!clientMessageId) {
        return res.status(400).json({
            error: 'clientMessageId es requerido para procesar el mensaje'
        });
    }

    const id = conversationId || randomUUID();

    try {
        // 3. Verificar si el mensaje ya fue procesado o está en curso (Idempotencia)
        const registroExistente = conversacionStore.obtenerRegistroMensaje(id, clientMessageId);

        if (registroExistente) {
            if (registroExistente.status === 'completed') {
                return res.status(200).json({
                    conversationId: id,
                    mensaje: registroExistente.assistantMessage
                });
            }

            if (registroExistente.status === 'processing' && registroExistente.promise) {
                // Si ya se está procesando, esperamos a esa misma promesa
                const respuesta = await registroExistente.promise;
                return res.status(200).json({
                    conversationId: id,
                    mensaje: respuesta
                });
            }
            // Si el estado es 'error', permitimos que continúe para reintentar
        }

        // 4. Recuperamos el historial previo de la conversación
        const historial = conversacionStore.obtenerHistorial(id);

        // 5. Creamos la promesa de procesamiento
        const promesaProcesamiento = asistenteService.obtenerRespuestaGroq(mensaje, historial);

        // 6. Registramos el mensaje como "en proceso"
        conversacionStore.registrarMensajeEnProceso(id, clientMessageId, mensaje, promesaProcesamiento);

        // 7. Esperamos el resultado
        const respuestaIA = await promesaProcesamiento;

        // 8. Guardamos el resultado final y actualizamos el historial
        conversacionStore.completarMensaje(id, clientMessageId, mensaje, respuestaIA);

        return res.status(200).json({
            conversationId: id,
            mensaje: respuestaIA
        });

    } catch (error) {
        console.error("Error en el controlador de asistente:", error);
        
        // Marcamos el mensaje con error para permitir reintentos futuros
        conversacionStore.marcarMensajeConError(id, clientMessageId);

        return res.status(500).json({
            error: "Error interno del servidor al procesar el mensaje"
        });
    }
};

/**
 * Elimina el historial de una conversación.
 * Útil para que el usuario inicie una conversación nueva.
 */
const reiniciarConversacion = (req, res) => {
    const { conversationId } = req.body;

    if (!conversationId) {
        return res.status(400).json({
            error: 'Debes indicar el conversationId a reiniciar'
        });
    }

    conversacionStore.borrarConversacion(conversationId);

    return res.status(200).json({
        ok: true,
        mensaje: 'Conversación reiniciada'
    });
};

module.exports = {
    procesarMensaje,
    reiniciarConversacion
};
