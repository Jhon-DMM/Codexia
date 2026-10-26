document.addEventListener('DOMContentLoaded', () => {
  const conversationIdKey = 'codexia-conversation-id';
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const nuevaBtn = document.getElementById('nueva-conversacion');
  const salirBtn = document.getElementById('cerrar-sesion');
  const alternarHistorialBtn = document.getElementById('alternar-historial');
  const textoAlternarHistorial = document.getElementById('texto-alternar-historial');
  const asistenteLayout = document.querySelector('.asistente-layout');
  const historialConversaciones = document.getElementById('historial-conversaciones');
  const chatSeccion = document.querySelector('.chat-seccion');
  const chat = document.querySelector('.chat');
  const listaConversaciones = document.getElementById('lista-conversaciones');
  const listaFijadas = document.getElementById('lista-fijadas');
  const grupoFijadas = document.getElementById('grupo-fijadas');
  const modalConversacion = document.getElementById('modal-conversacion');
  const formularioModal = document.getElementById('formulario-modal-conversacion');
  const modalTitulo = document.getElementById('modal-conversacion-titulo');
  const modalMensaje = document.getElementById('modal-conversacion-mensaje');
  const modalEtiqueta = document.getElementById('modal-conversacion-etiqueta');
  const modalEntrada = document.getElementById('modal-conversacion-entrada');
  const modalError = document.getElementById('modal-conversacion-error');
  const modalCancelar = document.getElementById('modal-conversacion-cancelar');
  const modalConfirmar = document.getElementById('modal-conversacion-confirmar');
  const notificacionConversacion = document.getElementById('notificacion-conversacion');
  const cuotaTexto = document.getElementById('cuota-diaria');
  const cuotaBarra = document.getElementById('cuota-barra');
  const mensajesPendientes = new Map();
  let conversationId = sessionStorage.getItem(conversationIdKey);
  let solicitudEnCurso = false;
  let accionModalActual = null;
  let temporizadorNotificacion;
  let temporizadorBarraChat;

  const menuOcultoInicial = window.matchMedia('(max-width: 700px)').matches;
  asistenteLayout.classList.toggle('historial-oculto', menuOcultoInicial);
  historialConversaciones.inert = menuOcultoInicial;
  chatSeccion.inert = false;
  const etiquetaInicial = menuOcultoInicial ? 'Mostrar conversaciones' : 'Ocultar conversaciones';
  textoAlternarHistorial.textContent = etiquetaInicial;
  alternarHistorialBtn.setAttribute('aria-label', etiquetaInicial);
  alternarHistorialBtn.setAttribute('aria-expanded', String(!menuOcultoInicial));

  function apiBaseUrl() {
    const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
    if (configurada) return configurada.replace(/\/+$/, '');

    const { protocol, hostname, port } = window.location;
    const local = hostname === 'localhost' || hostname === '127.0.0.1';
    if (protocol === 'file:') return 'http://localhost:3000';
    if (local && port !== '3000') return `http://${hostname}:3000`;
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
    if (!respuesta.ok && !datos.mensaje) {
      datos.mensaje = `La solicitud falló (HTTP ${respuesta.status}).`;
    }
    if (respuesta.status === 401) irAAcceso();
    return { respuesta, datos };
  }

  function actualizarCuota(cuota) {
    if (!cuota) return;
    cuotaTexto.textContent = `${cuota.usado} / ${cuota.limite}`;
    cuotaBarra.setAttribute('aria-valuenow', String(cuota.usado));
    cuotaBarra.setAttribute('aria-valuemax', String(cuota.limite));
    cuotaBarra.querySelector('span').style.width = `${cuota.limite ? (cuota.usado / cuota.limite) * 100 : 0}%`;
  }

  function agregarBurbuja(texto, clase = '') {
    const elemento = document.createElement('div');
    elemento.className = `mensaje-burbuja ${clase}`.trim();
    elemento.textContent = texto;
    chat.appendChild(elemento);
    chat.scrollTop = chat.scrollHeight;
    return elemento;
  }

  function mostrarBarraDesplazamientoChat() {
    chat.classList.add('chat-scroll-activa');
    window.clearTimeout(temporizadorBarraChat);
    temporizadorBarraChat = window.setTimeout(() => chat.classList.remove('chat-scroll-activa'), 1400);
  }

  function agregarRespuestaAnimada(texto) {
    const elemento = document.createElement('div');
    elemento.className = 'mensaje-burbuja mensaje-asistente';

    const prefijo = document.createElement('strong');
    prefijo.textContent = 'Asistente: ';
    prefijo.setAttribute('aria-hidden', 'true');
    const textoVisible = document.createElement('span');
    textoVisible.className = 'texto-en-escritura';
    textoVisible.setAttribute('aria-hidden', 'true');

    const textoAccesible = document.createElement('span');
    textoAccesible.className = 'texto-oculto';
    textoAccesible.textContent = `Asistente: ${texto}`;

    elemento.append(prefijo, textoVisible, textoAccesible);
    chat.appendChild(elemento);

    const segmentador = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('es', { granularity: 'word' })
      : null;
    const palabras = segmentador
      ? Array.from(segmentador.segment(texto), ({ segment, isWordLike }) => ({ texto: segment, animar: Boolean(isWordLike) }))
      : (texto.match(/\S+\s*|\s+/g) || []).map((segmento) => ({ texto: segmento, animar: /\S/.test(segmento) }));
    const reducirMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!palabras.length || reducirMovimiento) {
      textoVisible.textContent = texto;
      chat.scrollTop = chat.scrollHeight;
      return Promise.resolve();
    }

    textoVisible.classList.add('escribiendo');
    const intervalo = Math.min(35, Math.max(12, 1800 / palabras.length));
    let posicion = 0;

    return new Promise((resolve) => {
      function revelarSiguientePalabra() {
        const palabra = palabras[posicion++];
        if (!palabra.animar) {
          textoVisible.append(document.createTextNode(palabra.texto));
        } else {
          const elementoPalabra = document.createElement('span');
          elementoPalabra.className = 'palabra-animada';
          elementoPalabra.textContent = palabra.texto;
          textoVisible.append(elementoPalabra);
        }
        chat.scrollTop = chat.scrollHeight;

        if (posicion < palabras.length) {
          window.setTimeout(revelarSiguientePalabra, intervalo);
          return;
        }

        textoVisible.classList.remove('escribiendo');
        chat.scrollTop = chat.scrollHeight;
        resolve();
      }

      revelarSiguientePalabra();
    });
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
    if (!respuesta.ok || !Array.isArray(datos.conversaciones)) {
      listaConversaciones.replaceChildren();
      listaFijadas.replaceChildren();
      const error = document.createElement('p');
      error.textContent = 'No se pudieron cargar tus conversaciones.';
      listaConversaciones.appendChild(error);
      grupoFijadas.hidden = true;
      return [];
    }
    const fijadas = datos.conversaciones.filter((conversacion) => conversacion.fijada);
    const recientes = datos.conversaciones.filter((conversacion) => !conversacion.fijada);
    if (!fijadas.length && !grupoFijadas.hidden) await animarCierreFijadas();
    if (fijadas.length) {
      grupoFijadas.hidden = false;
      grupoFijadas.classList.remove('recogiendo');
      grupoFijadas.style.maxHeight = '';
      grupoFijadas.style.overflow = '';
    }
    grupoFijadas.hidden = !fijadas.length;
    listaConversaciones.replaceChildren();
    listaFijadas.replaceChildren();
    if (!datos.conversaciones.length) {
      const vacio = document.createElement('p');
      vacio.textContent = 'Tus conversaciones aparecerán aquí.';
      listaConversaciones.appendChild(vacio);
    }
    fijadas.forEach((conversacion) => crearElementoConversacion(conversacion, listaFijadas));
    recientes.forEach((conversacion) => crearElementoConversacion(conversacion, listaConversaciones));
    return datos.conversaciones;
  }

  function crearElementoConversacion(conversacion, lista) {
    const fila = document.createElement('div');
    fila.className = 'conversacion-fila';
    fila.dataset.conversationId = conversacion.id;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'conversacion-item';
    boton.setAttribute('aria-current', String(conversacion.id === conversationId));
    if (conversacion.fijada) {
      const alfiler = document.createElement('span');
      alfiler.className = 'conversacion-alfiler';
      alfiler.setAttribute('aria-label', 'Conversación fijada');
      alfiler.textContent = '📌';
      boton.appendChild(alfiler);
    }
    const titulo = document.createElement('span');
    titulo.className = 'conversacion-titulo';
    titulo.textContent = conversacion.titulo;
    const cantidad = document.createElement('span');
    cantidad.className = 'conversacion-cantidad';
    cantidad.textContent = `· ${conversacion.cantidad_mensajes}`;
    boton.append(titulo, cantidad);
    boton.addEventListener('click', () => abrirConversacion(conversacion.id));

    const opciones = document.createElement('button');
    opciones.type = 'button';
    opciones.className = 'conversacion-mas';
    opciones.setAttribute('aria-label', `Opciones de ${conversacion.titulo}`);
    opciones.setAttribute('aria-expanded', 'false');
    opciones.textContent = '•••';

    const menu = document.createElement('div');
    menu.className = 'conversacion-menu';
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    const acciones = [
      { texto: 'Renombrar', ejecutar: () => renombrarConversacion(conversacion) },
      { texto: conversacion.fijada ? 'Quitar de fijadas' : 'Fijar conversación', ejecutar: () => cambiarFijado(conversacion) },
      { texto: 'Eliminar', clase: 'accion-eliminar', ejecutar: () => borrarConversacion(conversacion) },
    ];
    acciones.forEach(({ texto, clase, ejecutar }) => {
      const accion = document.createElement('button');
      accion.type = 'button';
      accion.className = clase || '';
      accion.textContent = texto;
      accion.addEventListener('click', async (event) => {
        event.stopPropagation();
        cerrarMenuConversacion(menu, opciones);
        await ejecutar();
      });
      menu.appendChild(accion);
    });
    opciones.addEventListener('click', (event) => {
      event.stopPropagation();
      const abrir = !menu.classList.contains('abierto');
      cerrarTodosLosMenus();
      if (abrir) {
        menu.classList.add('abierto');
        menu.setAttribute('aria-hidden', 'false');
        menu.inert = false;
        opciones.setAttribute('aria-expanded', 'true');
      }
    });
    fila.append(boton, opciones, menu);
    lista.appendChild(fila);
  }

  function cerrarMenuConversacion(menu, boton) {
    menu.classList.remove('abierto');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    boton.setAttribute('aria-expanded', 'false');
  }

  function cerrarTodosLosMenus() {
    document.querySelectorAll('.conversacion-menu').forEach((menu) => {
      const boton = menu.parentElement.querySelector('.conversacion-mas');
      if (boton) cerrarMenuConversacion(menu, boton);
    });
  }

  function animarFila(conversacionId, clase) {
    const fila = [...document.querySelectorAll('.conversacion-fila')]
      .find((elemento) => elemento.dataset.conversationId === conversacionId);
    if (!fila || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    return new Promise((resolve) => {
      let finalizada = false;
      const terminar = () => {
        if (finalizada) return;
        finalizada = true;
        window.clearTimeout(respaldo);
        fila.removeEventListener('transitionend', alTerminar);
        resolve();
      };
      const alTerminar = (evento) => {
        if (evento.target === fila && evento.propertyName === 'transform') terminar();
      };
      const respaldo = window.setTimeout(terminar, 850);
      fila.addEventListener('transitionend', alTerminar);
      requestAnimationFrame(() => fila.classList.add(clase));
    });
  }

  function animarCierreFijadas() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    grupoFijadas.style.maxHeight = `${grupoFijadas.getBoundingClientRect().height}px`;
    grupoFijadas.style.overflow = 'hidden';
    grupoFijadas.getBoundingClientRect();
    return new Promise((resolve) => {
      let finalizada = false;
      const terminar = () => {
        if (finalizada) return;
        finalizada = true;
        window.clearTimeout(respaldo);
        grupoFijadas.removeEventListener('transitionend', alTerminar);
        grupoFijadas.classList.remove('recogiendo');
        grupoFijadas.style.maxHeight = '';
        grupoFijadas.style.overflow = '';
        resolve();
      };
      const alTerminar = (evento) => {
        if (evento.target === grupoFijadas && evento.propertyName === 'max-height') terminar();
      };
      const respaldo = window.setTimeout(terminar, 550);
      grupoFijadas.addEventListener('transitionend', alTerminar);
      requestAnimationFrame(() => grupoFijadas.classList.add('recogiendo'));
    });
  }

  function mostrarNotificacionEliminacion() {
    window.clearTimeout(temporizadorNotificacion);
    notificacionConversacion.textContent = 'La conversación se eliminó correctamente.';
    notificacionConversacion.hidden = false;
    notificacionConversacion.classList.remove('visible');
    requestAnimationFrame(() => notificacionConversacion.classList.add('visible'));
    temporizadorNotificacion = window.setTimeout(() => {
      notificacionConversacion.classList.remove('visible');
      window.setTimeout(() => { notificacionConversacion.hidden = true; }, 300);
    }, 3600);
  }

  function abrirModal({ titulo, mensaje, textoConfirmar = 'Aceptar', peligro = false, etiqueta = '', valor = '', confirmar = null }) {
    modalTitulo.textContent = titulo;
    modalMensaje.textContent = mensaje;
    modalConfirmar.textContent = textoConfirmar;
    modalConfirmar.classList.toggle('modal-boton-peligro', peligro);
    modalEntrada.hidden = !etiqueta;
    modalEtiqueta.hidden = !etiqueta;
    modalEtiqueta.textContent = etiqueta;
    modalEntrada.value = valor;
    modalCancelar.hidden = !confirmar;
    modalError.hidden = true;
    modalError.textContent = '';
    accionModalActual = confirmar;
    modalConversacion.showModal();
    if (etiqueta) {
      modalEntrada.focus();
      modalEntrada.select();
    } else {
      modalConfirmar.focus();
    }
  }

  formularioModal.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!accionModalActual) {
      modalConversacion.close();
      return;
    }
    const valor = modalEntrada.value.trim();
    if (modalEntrada.hidden === false && (!valor || valor.length > 120)) {
      modalError.textContent = 'El nombre debe tener entre 1 y 120 caracteres.';
      modalError.hidden = false;
      modalEntrada.focus();
      return;
    }
    modalConfirmar.disabled = true;
    modalCancelar.disabled = true;
    try {
      const resultado = await accionModalActual(valor);
      if (resultado?.ok === false) {
        modalError.textContent = resultado.mensaje || 'No se pudo completar la acción. Inténtalo de nuevo.';
        modalError.hidden = false;
        return;
      }
      modalConversacion.close();
    } catch (error) {
      modalError.textContent = error.message || 'No se pudo completar la acción. Inténtalo de nuevo.';
      modalError.hidden = false;
    } finally {
      modalConfirmar.disabled = false;
      modalCancelar.disabled = false;
    }
  });

  modalCancelar.addEventListener('click', () => modalConversacion.close());
  modalConversacion.addEventListener('close', () => { accionModalActual = null; });

  async function renombrarConversacion(conversacion) {
    abrirModal({
      titulo: 'Renombrar conversación',
      mensaje: 'Elige un nombre para identificarla fácilmente.',
      textoConfirmar: 'Guardar',
      etiqueta: 'Nombre de la conversación',
      valor: conversacion.titulo,
      confirmar: async (nuevoTitulo) => {
        if (nuevoTitulo === conversacion.titulo) return { ok: true };
        const { respuesta, datos } = await apiFetch(`/asistente/conversaciones/${encodeURIComponent(conversacion.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ titulo: nuevoTitulo }),
        });
        if (!respuesta.ok) return { ok: false, mensaje: datos.mensaje || 'No se pudo renombrar la conversación.' };
        await refrescarConversaciones();
        return { ok: true };
      },
    });
  }

  async function cambiarFijado(conversacion) {
    try {
      const { respuesta, datos } = await apiFetch(`/asistente/conversaciones/${encodeURIComponent(conversacion.id)}/fijar`, {
        method: 'PATCH',
        body: JSON.stringify({ fijada: !conversacion.fijada }),
      });
      if (!respuesta.ok) {
        abrirModal({ titulo: 'No se pudo actualizar', mensaje: datos.mensaje || 'Inténtalo de nuevo.' });
        return;
      }
      if (conversacion.fijada) await animarFila(conversacion.id, 'moviendo-a-recientes');
      await refrescarConversaciones();
    } catch (error) {
      abrirModal({ titulo: 'No se pudo actualizar', mensaje: error.message || 'Revisa tu conexión e inténtalo de nuevo.' });
    }
  }

  async function borrarConversacion(conversacion) {
    abrirModal({
      titulo: 'Eliminar conversación',
      mensaje: `¿Eliminar “${conversacion.titulo}” y todos sus mensajes? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
      confirmar: async () => {
        const { respuesta, datos } = await apiFetch(`/asistente/conversaciones/${encodeURIComponent(conversacion.id)}`, { method: 'DELETE' });
        if (!respuesta.ok) return { ok: false, mensaje: datos.mensaje || 'No se pudo eliminar la conversación.' };
        await animarFila(conversacion.id, 'desapareciendo-eliminar');
        const eraLaActiva = conversationId === conversacion.id;
        if (eraLaActiva) {
          conversationId = null;
          sessionStorage.removeItem(conversationIdKey);
          renderizarMensajes([]);
        }
        const conversaciones = await refrescarConversaciones();
        if (eraLaActiva) {
          if (conversaciones.length) await abrirConversacion(conversaciones[0].id);
          else await crearConversacion();
        }
        mostrarNotificacionEliminacion();
        return { ok: true };
      },
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

  function actualizarVisibilidadEnviar() {
    enviarBtn.hidden = mensajeInput.value.trim().length === 0;
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
      await agregarRespuestaAnimada(datos.mensaje);
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
    actualizarVisibilidadEnviar();
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

    actualizarVisibilidadEnviar();
    mensajeInput.addEventListener('input', actualizarVisibilidadEnviar);
    enviarBtn.addEventListener('click', enviarMensaje);
    nuevaBtn.addEventListener('click', crearConversacion);
    salirBtn.addEventListener('click', cerrarSesion);
    alternarHistorialBtn.addEventListener('click', () => {
      const ocultar = !asistenteLayout.classList.contains('historial-oculto');
      asistenteLayout.classList.toggle('historial-oculto', ocultar);
      historialConversaciones.inert = ocultar;
      chatSeccion.inert = window.matchMedia('(max-width: 700px)').matches && !ocultar;
      const texto = ocultar ? 'Mostrar conversaciones' : 'Ocultar conversaciones';
      textoAlternarHistorial.textContent = texto;
      alternarHistorialBtn.setAttribute('aria-label', texto);
      alternarHistorialBtn.setAttribute('aria-expanded', String(!ocultar));
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('.conversacion-fila')) return;
      cerrarTodosLosMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      cerrarTodosLosMenus();
    });
    chat.addEventListener('wheel', mostrarBarraDesplazamientoChat, { passive: true });
    chat.addEventListener('touchstart', mostrarBarraDesplazamientoChat, { passive: true });
    chat.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      mostrarBarraDesplazamientoChat();
      const distancia = Math.max(48, Math.round(chat.clientHeight * .14));
      chat.scrollBy({ top: event.key === 'ArrowUp' ? -distancia : distancia, behavior: 'auto' });
    });
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
