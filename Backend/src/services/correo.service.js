const URL_API_RESEND = 'https://api.resend.com/emails';

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caracter) => {
    const entidades = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter];
  });
}

async function enviarCodigoVerificacionCorreo({ correo, codigo }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const remitente = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !remitente) {
    const error = new Error('Falta configurar el proveedor de correo.');
    error.status = 503;
    error.codigoPublico = 'CORREO_NO_CONFIGURADO';
    error.mensajePublico = 'El envío de correo no está configurado todavía.';
    throw error;
  }

  const codigoHtml = escaparHtml(codigo);
  let respuesta;
  try {
    respuesta = await fetch(URL_API_RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente,
        to: [correo],
        subject: 'Tu código de verificación de Codexia',
        html: `<main style="font-family:Arial,sans-serif;color:#211638;max-width:520px;margin:auto;padding:32px"><h1 style="font-size:24px">Verifica tu correo</h1><p>Usa este código para terminar de crear tu cuenta en Codexia:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#6d42ce">${codigoHtml}</p><p>El código vence en 10 minutos. Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p></main>`,
        text: `Tu código de verificación de Codexia es ${codigo}. Vence en 10 minutos. Si no solicitaste esta cuenta, puedes ignorar este mensaje.`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (causa) {
    const error = new Error('No fue posible conectar con el proveedor de correo.');
    error.status = 503;
    error.codigoPublico = 'ENVIO_CORREO_FALLIDO';
    error.mensajePublico = 'No fue posible enviar el código. Inténtalo de nuevo en un momento.';
    error.registrar = true;
    error.cause = causa;
    throw error;
  }

  if (!respuesta.ok) {
    const error = new Error(`El proveedor de correo respondió con estado ${respuesta.status}.`);
    error.status = 503;
    error.codigoPublico = 'ENVIO_CORREO_FALLIDO';
    error.mensajePublico = 'No fue posible enviar el código. Inténtalo de nuevo en un momento.';
    error.registrar = true;
    throw error;
  }
}

module.exports = { enviarCodigoVerificacionCorreo };
