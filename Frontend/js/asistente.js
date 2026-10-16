document.addEventListener('DOMContentLoaded', () => {
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const reiniciarBtn = document.getElementById('reiniciar-chat');
  const chat = document.querySelector('.chat');
  const conversationIdKey = 'codexia-conversation-id';
  const apiBaseUrl = obtenerApiBaseUrl();
  const mensajesPendientes = new Map();
  let conversationId = sessionStorage.getItem(conversationIdKey) || null;
  let solicitudEnCurso = false;

  function obtenerApiBaseUrl() {
    const metaApiBaseUrl = document
      .querySelector('meta[name="codexia-api-base-url"]')
      ?.content
      ?.trim();

    if (metaApiBaseUrl) {
      return metaApiBaseUrl.replace(/\/+$/, '');
    }

    const { protocol, hostname, port } = window.location;
    const esLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    if (protocol === 'file:') {
      return 'http://localhost:3000';
    }

    if (esLocal && port && port !== '3000') {
      return 'http://localhost:3000';
    }

    return '';
  }

  function construirUrlApi(ruta) {
    return `${apiBaseUrl}${ruta}`;
  }

  function generarId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function asegurarConversationId() {
    if (!conversationId) {
      conversationId = generarId();
      sessionStorage.setItem(conversationIdKey, conversationId);
    }

    return conversationId;
  }

  function actualizarEstadoFormulario(ocupado) {
    solicitudEnCurso = ocupado;
    mensajeInput.disabled = ocupado;
    enviarBtn.disabled = ocupado;
    reiniciarBtn.disabled = ocupado;
  }

  function agregarBurbuja(texto, clase = '') {
    const mensaje = document.createElement('div');
    mensaje.textContent = texto;
    mensaje.className = clase ? `mensaje-burbuja ${clase}` : 'mensaje-burbuja';

    chat.appendChild(mensaje);
    chat.scrollTop = chat.scrollHeight;
    return mensaje;
  }

  function crearBurbujaProcesando() {
    const mensaje = document.createElement('div');
    const texto = document.createElement('span');
    const puntos = document.createElement('span');

    mensaje.className = 'mensaje-burbuja mensaje-asistente mensaje-procesando';
    mensaje.setAttribute('aria-live', 'polite');

    texto.textContent = 'Asistente: procesando';
    puntos.className = 'puntos-procesando';
    puntos.setAttribute('aria-hidden', 'true');
    puntos.innerHTML = '<span>.</span><span>.</span><span>.</span>';

    mensaje.append(texto, puntos);

    chat.appendChild(mensaje);
    chat.scrollTop = chat.scrollHeight;
    return mensaje;
  }

  function crearBurbujaError(pendiente) {
    const mensaje = document.createElement('div');
    const texto = document.createElement('span');
    const botonReintentar = document.createElement('button');

    mensaje.className = 'mensaje-burbuja mensaje-error';

    texto.textContent = 'Asistente: Lo siento, hubo un error al procesar tu mensaje.';

    botonReintentar.type = 'button';
    botonReintentar.className = 'btn btn-reintentar';
    botonReintentar.textContent = 'Reintentar';
    botonReintentar.addEventListener('click', () => {
      reenviarMensaje(pendiente.clientMessageId);
    });

    mensaje.append(texto, botonReintentar);

    chat.appendChild(mensaje);
    chat.scrollTop = chat.scrollHeight;
    return mensaje;
  }

  function removerNodo(nodo) {
    if (nodo?.parentNode) {
      nodo.parentNode.removeChild(nodo);
    }
  }

  async function obtenerErrorRespuesta(respuesta) {
    try {
      const datos = await respuesta.json();
      return datos.error || 'Error en la respuesta del servidor';
    } catch (error) {
      return 'Error en la respuesta del servidor';
    }
  }

  async function enviarMensajePendiente(pendiente) {
    actualizarEstadoFormulario(true);

    pendiente.errorBubble?.querySelector('button')?.setAttribute('disabled', 'disabled');
    removerNodo(pendiente.errorBubble);
    pendiente.errorBubble = null;
    pendiente.processingBubble = crearBurbujaProcesando();

    try {
      const respuesta = await fetch(construirUrlApi('/asistente'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: pendiente.conversationId,
          clientMessageId: pendiente.clientMessageId,
          mensaje: pendiente.mensaje
        })
      });

      if (!respuesta.ok) {
        throw new Error(await obtenerErrorRespuesta(respuesta));
      }

      const datos = await respuesta.json();

      if (datos.conversationId) {
        conversationId = datos.conversationId;
        sessionStorage.setItem(conversationIdKey, conversationId);
      }

      removerNodo(pendiente.processingBubble);
      pendiente.processingBubble = null;
      agregarBurbuja('Asistente: ' + datos.mensaje, 'mensaje-asistente');
      mensajesPendientes.delete(pendiente.clientMessageId);
    } catch (error) {
      console.error('Hubo un problema con la petición:', error);
      removerNodo(pendiente.processingBubble);
      pendiente.processingBubble = null;
      pendiente.errorBubble = crearBurbujaError(pendiente);
    } finally {
      actualizarEstadoFormulario(false);
      mensajeInput.focus();
    }
  }

  async function reenviarMensaje(clientMessageId) {
    if (solicitudEnCurso) {
      return;
    }

    const pendiente = mensajesPendientes.get(clientMessageId);

    if (!pendiente) {
      return;
    }

    await enviarMensajePendiente(pendiente);
  }

  async function enviarMensaje() {
    if (solicitudEnCurso) {
      return;
    }

    const mensaje = mensajeInput.value.trim();

    if (mensaje === '') {
      return alert('Debes escribir tu mensaje');
    }

    const pendiente = {
      conversationId: asegurarConversationId(),
      clientMessageId: generarId(),
      mensaje,
      userBubble: agregarBurbuja('Tú: ' + mensaje, 'mensaje-usuario'),
      processingBubble: null,
      errorBubble: null
    };

    mensajesPendientes.set(pendiente.clientMessageId, pendiente);
    mensajeInput.value = '';
    await enviarMensajePendiente(pendiente);
  }

  function renderizarMensajeInicial() {
    chat.innerHTML = `
      <strong>Asistente | Codexia</strong>
      <p>Holi, ¿en que te ayudo?.</p>
    `;
  }

  async function reiniciarChat() {
    try {
      if (conversationId) {
        const respuesta = await fetch(construirUrlApi('/asistente/reiniciar'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ conversationId })
        });

        if (!respuesta.ok) {
          throw new Error('No se pudo reiniciar la conversación');
        }
      }

      mensajesPendientes.clear();
      conversationId = null;
      sessionStorage.removeItem(conversationIdKey);
      renderizarMensajeInicial();
      agregarBurbuja('Asistente: Se inició una conversación nueva.', 'mensaje-asistente');
      mensajeInput.focus();
    } catch (error) {
      console.error('Hubo un problema al reiniciar el chat:', error);
      agregarBurbuja('Asistente: No pude reiniciar el chat en este momento. Inténtalo de nuevo.', 'mensaje-error');
    }
  }

  renderizarMensajeInicial();
  enviarBtn.addEventListener('click', enviarMensaje);
  reiniciarBtn.addEventListener('click', reiniciarChat);

  mensajeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      enviarMensaje();
    }
  });
});
