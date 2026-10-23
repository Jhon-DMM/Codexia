document.addEventListener('DOMContentLoaded', () => {
  const conversationIdKey = 'codexia-conversation-id';
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const nuevaBtn = document.getElementById('nueva-conversacion');
  const salirBtn = document.getElementById('cerrar-sesion');
  const chat = document.querySelector('.chat');
  const listaConversaciones = document.getElementById('lista-conversaciones');
  const cuotaTexto = document.getElementById('cuota-diaria');
  const mensajesPendientes = new Map();
  let conversationId = sessionStorage.getItem(conversationIdKey);
  let solicitudEnCurso = false;

  function apiBaseUrl() {
    const { protocol, hostname, port } = window.location;
    const local = hostname === 'localhost' || hostname === '127.0.0.1';
    if (protocol === 'file:') return 'http://localhost:3000';
    if (local && port && port !== '3000') return `http://${hostname}:3000`;
    return '';
  }

  function irAAcceso() {
    sessionStorage.removeItem(conversationIdKey);
    const destino = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`../cuenta/index.html?next=${encodeURIComponent(destino)}`);
  }

  async function apiFetch(ruta, opciones = {}) {
    const respuesta = await fetch(`${apiBaseUrl()}/api${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: {
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...opciones.headers,
      },
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch (error) { /* Respuesta sin JSON */ }
    if (respuesta.status === 401) irAAcceso();
    return { respuesta, datos };
  }

  function actualizarCuota(cuota) {
    if (cuota) cuotaTexto.textContent = `Mensajes de hoy: ${cuota.usado} de ${cuota.limite} · Quedan ${cuota.restante}`;
  }

  function agregarBurbuja(texto, clase = '') {
    const elemento = document.createElement('div');
    elemento.className = `mensaje-burbuja ${clase}`.trim();
    elemento.textContent = texto;
    chat.appendChild(elemento);
    chat.scrollTop = chat.scrollHeight;
    return elemento;
  }

  function renderizarMensajes(mensajes) {
    chat.replaceChildren();
    if (!mensajes.length) {
      agregarBurbuja('Hola, ¿en qué te puedo ayudar?', 'mensaje-asistente');
      return;
    }
    mensajes.forEach((mensaje) => {
      const esUsuario = mensaje.rol === 'usuario';
      agregarBurbuja(`${esUsuario ? 'Tú' : 'Asistente'}: ${mensaje.contenido}`, esUsuario ? 'mensaje-usuario' : 'mensaje-asistente');
    });
  }

  async function refrescarConversaciones() {
    const { respuesta, datos } = await apiFetch('/asistente/conversaciones');
    if (!respuesta.ok) return;
    listaConversaciones.replaceChildren();
    if (!datos.conversaciones.length) {
      const vacio = document.createElement('p');
      vacio.textContent = 'Tus conversaciones aparecerán aquí.';
      listaConversaciones.appendChild(vacio);
      return;
    }
    datos.conversaciones.forEach((conversacion) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'conversacion-item';
      boton.setAttribute('aria-current', String(conversacion.id === conversationId));
      boton.textContent = `${conversacion.titulo} · ${conversacion.cantidad_mensajes}`;
      boton.addEventListener('click', () => abrirConversacion(conversacion.id));
      listaConversaciones.appendChild(boton);
    });
  }

  async function abrirConversacion(id) {
    const { respuesta, datos } = await apiFetch(`/asistente/conversaciones/${encodeURIComponent(id)}`);
    if (!respuesta.ok) return;
    conversationId = datos.conversacion.id;
    sessionStorage.setItem(conversationIdKey, conversationId);
    renderizarMensajes(datos.conversacion.mensajes);
    await refrescarConversaciones();
  }

  async function crearConversacion() {
    const { respuesta, datos } = await apiFetch('/asistente/conversaciones', { method: 'POST' });
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo crear la conversación');
    conversationId = datos.conversationId;
    sessionStorage.setItem(conversationIdKey, conversationId);
    renderizarMensajes([]);
    await refrescarConversaciones();
    mensajeInput.focus();
  }

  async function cargarCuota() {
    const { respuesta, datos } = await apiFetch('/usuarios/me/cuota');
    if (respuesta.ok) actualizarCuota(datos);
  }

  function actualizarEstadoFormulario(ocupado) {
    solicitudEnCurso = ocupado;
    mensajeInput.disabled = ocupado;
    enviarBtn.disabled = ocupado;
    nuevaBtn.disabled = ocupado;
  }

  function crearError(pendiente, texto) {
    const error = document.createElement('div');
    error.className = 'mensaje-burbuja mensaje-error';
    const contenido = document.createElement('span');
    contenido.textContent = texto;
    error.appendChild(contenido);
    if (pendiente) {
      const reintentar = document.createElement('button');
      reintentar.type = 'button';
      reintentar.className = 'btn btn-reintentar';
      reintentar.textContent = 'Reintentar';
      reintentar.addEventListener('click', () => reenviarMensaje(pendiente.clientMessageId));
      error.appendChild(reintentar);
    }
    chat.appendChild(error);
    chat.scrollTop = chat.scrollHeight;
    return error;
  }

  async function enviarMensajePendiente(pendiente) {
    actualizarEstadoFormulario(true);
    pendiente.errorBubble?.remove();
    pendiente.processingBubble = agregarBurbuja('Asistente: procesando…', 'mensaje-asistente mensaje-procesando');
    try {
      let respuesta;
      let datos;
      for (let intento = 0; intento < 35; intento += 1) {
        ({ respuesta, datos } = await apiFetch('/asistente', {
          method: 'POST',
          body: JSON.stringify({ conversationId: pendiente.conversationId, clientMessageId: pendiente.clientMessageId, mensaje: pendiente.mensaje }),
        }));
        if (respuesta.status !== 202) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      pendiente.processingBubble.remove();
      pendiente.processingBubble = null;
      actualizarCuota(datos.cuota);
      if (respuesta.status === 429) {
        crearError(null, datos.mensaje || 'Alcanzaste el límite diario del asistente.');
        mensajesPendientes.delete(pendiente.clientMessageId);
        return;
      }
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible enviar tu mensaje');
      if (respuesta.status === 202) throw new Error('Tu mensaje sigue en proceso. Puedes volver a intentarlo en un momento.');
      agregarBurbuja(`Asistente: ${datos.mensaje}`, 'mensaje-asistente');
      mensajesPendientes.delete(pendiente.clientMessageId);
      await refrescarConversaciones();
    } catch (error) {
      pendiente.processingBubble?.remove();
      pendiente.processingBubble = null;
      pendiente.errorBubble = crearError(pendiente, error.message || 'Hubo un problema al procesar tu mensaje.');
    } finally {
      actualizarEstadoFormulario(false);
      mensajeInput.focus();
    }
  }

  async function reenviarMensaje(id) {
    if (solicitudEnCurso) return;
    const pendiente = mensajesPendientes.get(id);
    if (pendiente) await enviarMensajePendiente(pendiente);
  }

  async function enviarMensaje() {
    if (solicitudEnCurso) return;
    const texto = mensajeInput.value.trim();
    if (!texto) return;
    const pendiente = {
      conversationId,
      clientMessageId: window.crypto.randomUUID(),
      mensaje: texto,
      errorBubble: null,
      processingBubble: null,
    };
    agregarBurbuja(`Tú: ${texto}`, 'mensaje-usuario');
    mensajesPendientes.set(pendiente.clientMessageId, pendiente);
    mensajeInput.value = '';
    await enviarMensajePendiente(pendiente);
  }

  async function cerrarSesion() {
    try { await apiFetch('/usuarios/logout', { method: 'POST' }); } catch (error) { /* Se limpia el token local igualmente */ }
    sessionStorage.removeItem(conversationIdKey);
    window.location.replace('../../index.html');
  }

  async function inicializar() {
    const cuenta = await apiFetch('/usuarios/me');
    if (!cuenta.respuesta.ok) return;
    document.getElementById('nombre-usuario').textContent = cuenta.datos.usuario.nombre;

    enviarBtn.addEventListener('click', enviarMensaje);
    nuevaBtn.addEventListener('click', crearConversacion);
    salirBtn.addEventListener('click', cerrarSesion);
    mensajeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); enviarMensaje(); }
    });

    await cargarCuota();
    if (conversationId) {
      const { respuesta, datos } = await apiFetch(`/asistente/conversaciones/${encodeURIComponent(conversationId)}`);
      if (respuesta.ok) renderizarMensajes(datos.conversacion.mensajes);
      else await crearConversacion();
    } else {
      await crearConversacion();
    }
    await refrescarConversaciones();
  }

  inicializar().catch((error) => {
    console.error('No se pudo iniciar el asistente:', error);
    crearError(null, 'No fue posible cargar tu asistente. Inténtalo de nuevo.');
  });
});
