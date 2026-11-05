import { useCallback, useEffect, useRef, useState } from 'react';
import { mostrarCargaNavegacion } from '../../js/carga-ui.js';

const ID_CONVERSACION = 'codexia-conversation-id';
const MENSAJE_INICIAL = {
  id: 'saludo-inicial',
  role: 'asistente',
  content: 'Hola, ¿en qué te puedo ayudar?',
};

function apiBaseUrl() {
  const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'file:') return 'http://localhost:3000';
  if (local && port !== '3000') return `http://${hostname}:3000`;
  return '';
}

function esperar(milisegundos) {
  return new Promise((resolve) => window.setTimeout(resolve, milisegundos));
}

export function useAssistant() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(() =>
    window.sessionStorage.getItem(ID_CONVERSACION),
  );
  const [messages, setMessages] = useState([MENSAJE_INICIAL]);
  const [quota, setQuota] = useState({ usado: 0, limite: 30, restante: 30 });
  const [input, setInput] = useState('');
  const [view, setView] = useState('chat');
  const [viewTransition, setViewTransition] = useState('');
  const [leavingView, setLeavingView] = useState('');
  const [historyHidden, setHistoryHidden] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountTotal, setAccountTotal] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [supportRequests, setSupportRequests] = useState([]);
  const [supportStatus, setSupportStatus] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportForm, setSupportForm] = useState({
    categoria: 'general',
    asunto: '',
    mensaje: '',
    aceptaPrivacidadSoporte: false,
  });
  const [scheduledDeletion, setScheduledDeletion] = useState(null);
  const [pilotEnded, setPilotEnded] = useState(false);
  const [menuConversacion, setMenuConversacion] = useState(null);
  const [closingPinned, setClosingPinned] = useState(false);
  const [animatingRows, setAnimatingRows] = useState({});
  const [chatScrollActive, setChatScrollActive] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const conversationsRef = useRef([]);
  const notificationTimer = useRef(null);
  const scrollTimer = useRef(null);
  const pilotTimer = useRef(null);
  const viewTimer = useRef(null);

  const irAAcceso = useCallback(() => {
    window.sessionStorage.removeItem(ID_CONVERSACION);
    const destino = `${window.location.pathname}${window.location.search}`;
    mostrarCargaNavegacion();
    window.location.replace(`../cuenta/index.html?next=${encodeURIComponent(destino)}`);
  }, []);

  const apiFetch = useCallback(
    async (ruta, opciones = {}) => {
      const respuesta = await fetch(`${apiBaseUrl()}/api${ruta}`, {
        ...opciones,
        credentials: 'include',
        headers: {
          ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
          ...opciones.headers,
        },
      });

      let datos = {};
      try {
        datos = await respuesta.json();
      } catch {
        // Puede haber respuestas sin un cuerpo JSON.
      }

      if (!respuesta.ok && !datos.mensaje) {
        datos.mensaje = `La solicitud falló (HTTP ${respuesta.status}).`;
      }
      if (respuesta.status === 410 && datos.codigo === 'PILOTO_FINALIZADO') setPilotEnded(true);
      if (respuesta.status === 401) irAAcceso();
      return { respuesta, datos };
    },
    [irAAcceso],
  );

  const actualizarCuota = useCallback((nuevaCuota) => {
    if (!nuevaCuota) return;
    setQuota(nuevaCuota);
  }, []);

  const mostrarNotificacion = useCallback((texto) => {
    window.clearTimeout(notificationTimer.current);
    setNotice(texto);
    notificationTimer.current = window.setTimeout(() => setNotice(''), 3900);
  }, []);

  const refrescarConversaciones = useCallback(async () => {
    const { respuesta, datos } = await apiFetch('/asistente/conversaciones');
    if (!respuesta.ok || !Array.isArray(datos.conversaciones)) {
      setConversations([]);
      conversationsRef.current = [];
      return [];
    }
    const fijadasAntes = conversationsRef.current.some((conversation) => conversation.fijada);
    const fijadasDespues = datos.conversaciones.some((conversation) => conversation.fijada);
    conversationsRef.current = datos.conversaciones;
    setConversations(datos.conversaciones);
    if (fijadasAntes && !fijadasDespues) {
      setClosingPinned(true);
      await esperar(500);
      setClosingPinned(false);
    }
    return datos.conversaciones;
  }, [apiFetch]);

  const cargarConversacion = useCallback(
    async (id) => {
      const { respuesta, datos } = await apiFetch(
        `/asistente/conversaciones/${encodeURIComponent(id)}`,
      );
      if (!respuesta.ok) return false;
      const conversacion = datos.conversacion;
      setConversationId(conversacion.id);
      window.sessionStorage.setItem(ID_CONVERSACION, conversacion.id);
      setMessages(
        conversacion.mensajes.length
          ? conversacion.mensajes.map((message) => ({
              id: `db-${message.id}`,
              role: message.rol,
              content: message.contenido,
            }))
          : [MENSAJE_INICIAL],
      );
      await refrescarConversaciones();
      return true;
    },
    [apiFetch, refrescarConversaciones],
  );

  const crearConversacion = useCallback(async () => {
    const { respuesta, datos } = await apiFetch('/asistente/conversaciones', {
      method: 'POST',
    });
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo crear la conversación.');
    setConversationId(datos.conversationId);
    window.sessionStorage.setItem(ID_CONVERSACION, datos.conversationId);
    setMessages([MENSAJE_INICIAL]);
    await refrescarConversaciones();
    inputRef.current?.focus();
    return datos.conversationId;
  }, [apiFetch, refrescarConversaciones]);

  const cargarCuota = useCallback(async () => {
    const { respuesta, datos } = await apiFetch('/usuarios/me/cuota');
    if (respuesta.ok) actualizarCuota(datos);
  }, [actualizarCuota, apiFetch]);

  const cargarEstadisticasCuenta = useCallback(async () => {
    setAccountTotal(null);
    setAccountError('');
    try {
      const { respuesta, datos } = await apiFetch('/usuarios/me/estadisticas');
      if (!respuesta.ok || !Number.isFinite(Number(datos.totalMensajes))) {
        throw new Error(datos.mensaje || 'No se pudo cargar el total de mensajes.');
      }
      setAccountTotal(Number(datos.totalMensajes));
    } catch {
      setAccountTotal(null);
      setAccountError(
        'No se pudo actualizar el total. Comprueba que la API esté iniciada y actualizada.',
      );
    }
  }, [apiFetch]);

  const cargarSolicitudesSoporte = useCallback(async () => {
    try {
      const { respuesta, datos } = await apiFetch('/usuarios/me/soporte');
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo cargar el historial.');
      setSupportRequests(datos.solicitudes || []);
    } catch (error) {
      setSupportStatus(error.message || 'No se pudo cargar el historial de solicitudes.');
    }
  }, [apiFetch]);

  const cargarAvisoEliminacion = useCallback(async () => {
    const { respuesta, datos } = await apiFetch('/usuarios/me/eliminacion-programada');
    if (respuesta.ok) setScheduledDeletion(datos.eliminacion || null);
  }, [apiFetch]);

  useEffect(() => {
    let activa = true;

    async function inicializar() {
      try {
        const cuenta = await apiFetch('/usuarios/me');
        if (!activa || !cuenta.respuesta.ok) return;

        const usuario = cuenta.datos.usuario;
        setUser(usuario);
        if (usuario.piloto_activo && usuario.piloto_inicio_en) {
          const fechaCreacion = new Date(usuario.piloto_inicio_en).getTime();
          const venceEn = fechaCreacion + 7 * 24 * 60 * 60 * 1000;
          window.localStorage.setItem('codexia-piloto-expira-en', String(venceEn));
          const restante = venceEn - Date.now();
          if (restante <= 0) setPilotEnded(true);
          else pilotTimer.current = window.setTimeout(() => setPilotEnded(true), restante);
        } else {
          window.localStorage.removeItem('codexia-piloto-expira-en');
        }

        await Promise.all([cargarCuota(), cargarAvisoEliminacion()]);
        const lista = await refrescarConversaciones();
        if (!activa) return;

        const guardada = window.sessionStorage.getItem(ID_CONVERSACION);
        if (guardada && lista.some((conversation) => conversation.id === guardada)) {
          const cargada = await cargarConversacion(guardada);
          if (!cargada) {
            window.sessionStorage.removeItem(ID_CONVERSACION);
            setConversationId(null);
            setMessages([MENSAJE_INICIAL]);
          }
        } else {
          window.sessionStorage.removeItem(ID_CONVERSACION);
          setConversationId(null);
          setMessages([MENSAJE_INICIAL]);
        }
      } catch (error) {
        console.error('No se pudo iniciar el asistente:', error);
        setNotice(
          'No fue posible cargar tu asistente. Comprueba tu conexión e inténtalo de nuevo.',
        );
      } finally {
        if (activa) setLoading(false);
      }
    }

    inicializar();
    return () => {
      activa = false;
      window.clearTimeout(pilotTimer.current);
      window.clearTimeout(viewTimer.current);
    };
  }, [apiFetch, cargarAvisoEliminacion, cargarConversacion, cargarCuota, refrescarConversaciones]);

  useEffect(() => {
    const container = chatRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(
    () => () => {
      window.clearTimeout(notificationTimer.current);
      window.clearTimeout(scrollTimer.current);
      window.clearTimeout(pilotTimer.current);
      window.clearTimeout(viewTimer.current);
    },
    [],
  );

  const abrirConversacion = useCallback(
    async (id) => {
      const abierta = await cargarConversacion(id);
      if (abierta && window.matchMedia('(max-width: 700px)').matches) setHistoryHidden(true);
    },
    [cargarConversacion],
  );

  const enviarPendiente = useCallback(
    async (pending) => {
      setSending(true);
      setMessages((current) => [
        ...current.filter(
          (message) => message.id !== pending.processingId && message.id !== pending.errorId,
        ),
        {
          id: pending.processingId,
          role: 'asistente',
          content: 'Asistente: procesando…',
          processing: true,
        },
      ]);

      try {
        let result;
        for (let intento = 0; intento < 35; intento += 1) {
          result = await apiFetch('/asistente', {
            method: 'POST',
            body: JSON.stringify({
              conversationId: pending.conversationId,
              clientMessageId: pending.clientMessageId,
              mensaje: pending.content,
            }),
          });
          if (result.respuesta.status !== 202) break;
          await esperar(1000);
        }

        setMessages((current) => current.filter((message) => message.id !== pending.processingId));
        actualizarCuota(result?.datos.cuota);
        if (result?.respuesta.status === 429) {
          setMessages((current) => [
            ...current,
            {
              id: pending.errorId,
              role: 'asistente',
              content: result.datos.mensaje || 'Alcanzaste el límite diario del asistente.',
              error: true,
            },
          ]);
          return;
        }
        if (!result?.respuesta.ok)
          throw new Error(result?.datos.mensaje || 'No fue posible enviar tu mensaje.');
        if (result.respuesta.status === 202) {
          throw new Error('Tu mensaje sigue en proceso. Puedes volver a intentarlo en un momento.');
        }

        setMessages((current) => [
          ...current,
          {
            id: `respuesta-${pending.clientMessageId}`,
            role: 'asistente',
            content: result.datos.mensaje,
            animar: true,
          },
        ]);
        await refrescarConversaciones();
      } catch (error) {
        setMessages((current) => [
          ...current.filter((message) => message.id !== pending.processingId),
          {
            id: pending.errorId,
            role: 'asistente',
            content: error.message || 'Hubo un problema al procesar tu mensaje.',
            error: true,
            retry: true,
            retryData: pending,
          },
        ]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [apiFetch, actualizarCuota, refrescarConversaciones],
  );

  const enviarMensaje = useCallback(async () => {
    if (sending || !input.trim()) return;
    const content = input.trim();

    try {
      let id = conversationId;
      if (!id) id = await crearConversacion();
      setInput('');

      const clientMessageId = window.crypto.randomUUID();
      const pending = {
        conversationId: id,
        clientMessageId,
        content,
        processingId: `procesando-${clientMessageId}`,
        errorId: `error-${clientMessageId}`,
      };

      setMessages((current) => [
        ...current.filter((message) => message.id !== MENSAJE_INICIAL.id),
        { id: `usuario-${clientMessageId}`, role: 'usuario', content },
      ]);
      await enviarPendiente(pending);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'asistente',
          content: error.message || 'No se pudo iniciar la conversación.',
          error: true,
        },
      ]);
    }
  }, [conversationId, crearConversacion, enviarPendiente, input, sending]);

  const cambiarVista = useCallback(
    async (destino) => {
      if (view === destino) {
        if (window.matchMedia('(max-width: 700px)').matches) setHistoryHidden(true);
        return;
      }
      if (window.matchMedia('(max-width: 700px)').matches) setHistoryHidden(true);
      setLeavingView(view);
      setView(destino);
      setViewTransition(destino);
      window.clearTimeout(viewTimer.current);
      viewTimer.current = window.setTimeout(() => {
        setViewTransition('');
        setLeavingView('');
      }, 500);

      if (destino === 'cuenta') await cargarEstadisticasCuenta();
      if (destino === 'soporte') await cargarSolicitudesSoporte();
    },
    [cargarEstadisticasCuenta, cargarSolicitudesSoporte, view],
  );

  const confirmarModal = useCallback(
    async (value) => {
      if (!modal?.onConfirm) {
        setModal(null);
        return;
      }
      setModalBusy(true);
      setModalError('');
      try {
        const result = await modal.onConfirm(value);
        if (result?.ok === false) {
          setModalError(result.mensaje || 'No se pudo completar la acción. Inténtalo de nuevo.');
        } else {
          setModal(null);
        }
      } catch (error) {
        setModalError(error.message || 'No se pudo completar la acción. Inténtalo de nuevo.');
      } finally {
        setModalBusy(false);
      }
    },
    [modal],
  );

  const abrirModal = useCallback((configuracion) => {
    setModalError('');
    setModal(configuracion);
  }, []);

  const renombrarConversacion = useCallback(
    (conversation) =>
      abrirModal({
        titulo: 'Renombrar conversación',
        mensaje: 'Elige un nombre para identificarla fácilmente.',
        etiqueta: 'Nombre de la conversación',
        valor: conversation.titulo,
        textoConfirmar: 'Guardar',
        onConfirm: async (titulo) => {
          if (titulo === conversation.titulo) return { ok: true };
          const { respuesta, datos } = await apiFetch(
            `/asistente/conversaciones/${encodeURIComponent(conversation.id)}`,
            { method: 'PATCH', body: JSON.stringify({ titulo }) },
          );
          if (!respuesta.ok)
            return { ok: false, mensaje: datos.mensaje || 'No se pudo renombrar la conversación.' };
          await refrescarConversaciones();
          return { ok: true };
        },
      }),
    [apiFetch, abrirModal, refrescarConversaciones],
  );

  const fijarConversacion = useCallback(
    async (conversation) => {
      try {
        const { respuesta, datos } = await apiFetch(
          `/asistente/conversaciones/${encodeURIComponent(conversation.id)}/fijar`,
          { method: 'PATCH', body: JSON.stringify({ fijada: !conversation.fijada }) },
        );
        if (!respuesta.ok) {
          abrirModal({
            titulo: 'No se pudo actualizar',
            mensaje: datos.mensaje || 'Inténtalo de nuevo.',
          });
          return;
        }
        if (conversation.fijada) {
          setAnimatingRows((current) => ({
            ...current,
            [conversation.id]: 'moviendo-a-recientes',
          }));
          await esperar(800);
          setAnimatingRows((current) => {
            const next = { ...current };
            delete next[conversation.id];
            return next;
          });
        }
        await refrescarConversaciones();
      } catch (error) {
        abrirModal({
          titulo: 'No se pudo actualizar',
          mensaje: error.message || 'Revisa tu conexión e inténtalo de nuevo.',
        });
      }
    },
    [apiFetch, abrirModal, refrescarConversaciones],
  );

  const borrarConversacion = useCallback(
    (conversation) =>
      abrirModal({
        titulo: 'Eliminar conversación',
        mensaje: `¿Eliminar “${conversation.titulo}” y todos sus mensajes? Esta acción no se puede deshacer.`,
        textoConfirmar: 'Eliminar',
        peligro: true,
        onConfirm: async () => {
          const { respuesta, datos } = await apiFetch(
            `/asistente/conversaciones/${encodeURIComponent(conversation.id)}`,
            { method: 'DELETE' },
          );
          if (!respuesta.ok)
            return { ok: false, mensaje: datos.mensaje || 'No se pudo eliminar la conversación.' };
          setAnimatingRows((current) => ({
            ...current,
            [conversation.id]: 'desapareciendo-eliminar',
          }));
          await esperar(800);
          const eraActiva = conversationId === conversation.id;
          const lista = await refrescarConversaciones();
          if (eraActiva) {
            if (lista.length) await cargarConversacion(lista[0].id);
            else await crearConversacion();
          }
          setAnimatingRows({});
          mostrarNotificacion('La conversación se eliminó correctamente.');
          return { ok: true };
        },
      }),
    [
      apiFetch,
      abrirModal,
      cargarConversacion,
      conversationId,
      crearConversacion,
      mostrarNotificacion,
      refrescarConversaciones,
    ],
  );

  const borrarTodasConversaciones = useCallback(
    () =>
      abrirModal({
        titulo: 'Borrar todas las conversaciones',
        mensaje:
          'Se eliminarán todas tus conversaciones y sus mensajes. Esta acción no se puede deshacer.',
        textoConfirmar: 'Borrar todo',
        peligro: true,
        onConfirm: async () => {
          const { respuesta, datos } = await apiFetch('/asistente/conversaciones', {
            method: 'DELETE',
          });
          if (!respuesta.ok)
            return {
              ok: false,
              mensaje: datos.mensaje || 'No se pudieron borrar las conversaciones.',
            };
          setConversationId(null);
          window.sessionStorage.removeItem(ID_CONVERSACION);
          setMessages([MENSAJE_INICIAL]);
          await refrescarConversaciones();
          mostrarNotificacion('Se borraron todas tus conversaciones.');
          return { ok: true };
        },
      }),
    [apiFetch, abrirModal, mostrarNotificacion, refrescarConversaciones],
  );

  const cambiarNombre = useCallback(
    () =>
      abrirModal({
        titulo: 'Cambiar nombre',
        mensaje: 'Este nombre aparecerá en tu perfil y en el saludo del asistente.',
        etiqueta: 'Nuevo nombre',
        valor: user?.nombre || '',
        maxLength: 100,
        textoConfirmar: 'Guardar',
        onConfirm: async (nombre) => {
          if (nombre === user?.nombre) return { ok: true };
          const { respuesta, datos } = await apiFetch('/usuarios/me', {
            method: 'PATCH',
            body: JSON.stringify({ nombre }),
          });
          if (!respuesta.ok)
            return { ok: false, mensaje: datos.mensaje || 'No se pudo cambiar el nombre.' };
          setUser((current) => ({ ...current, ...datos.usuario }));
          return { ok: true };
        },
      }),
    [apiFetch, abrirModal, user],
  );

  const eliminarCuenta = useCallback(
    () =>
      abrirModal({
        titulo: 'Eliminar cuenta',
        mensaje:
          'Esta acción no se puede deshacer. Se eliminarán tu perfil y todas tus conversaciones.',
        etiqueta: 'Escribe tu contraseña para confirmar',
        password: true,
        maxLength: 1024,
        textoConfirmar: 'Eliminar cuenta',
        peligro: true,
        onConfirm: async (password) => {
          if (!password.trim())
            return { ok: false, mensaje: 'Escribe tu contraseña para confirmar.' };
          if (new TextEncoder().encode(password).length > 1024)
            return { ok: false, mensaje: 'La contraseña supera el límite permitido.' };
          const { respuesta, datos } = await apiFetch('/usuarios/me', {
            method: 'DELETE',
            body: JSON.stringify({ password }),
          });
          if (!respuesta.ok)
            return { ok: false, mensaje: datos.mensaje || 'No se pudo eliminar la cuenta.' };
          window.sessionStorage.removeItem(ID_CONVERSACION);
          mostrarCargaNavegacion();
          window.location.replace('../../index.html');
          return { ok: true };
        },
      }),
    [apiFetch, abrirModal],
  );

  const enviarSolicitudSoporte = useCallback(
    async (event) => {
      event.preventDefault();
      setSupportBusy(true);
      setSupportStatus('Enviando solicitud…');
      try {
        const { respuesta, datos } = await apiFetch('/usuarios/me/soporte', {
          method: 'POST',
          body: JSON.stringify({
            ...supportForm,
            aceptaPrivacidadSoporte: String(supportForm.aceptaPrivacidadSoporte),
          }),
        });
        if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo enviar la solicitud.');
        setSupportForm({
          categoria: 'general',
          asunto: '',
          mensaje: '',
          aceptaPrivacidadSoporte: false,
        });
        setSupportStatus('Recibimos tu solicitud. La respuesta aparecerá aquí.');
        await cargarSolicitudesSoporte();
      } catch (error) {
        setSupportStatus(error.message || 'No se pudo enviar la solicitud.');
      } finally {
        setSupportBusy(false);
      }
    },
    [apiFetch, cargarSolicitudesSoporte, supportForm],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await apiFetch('/usuarios/logout', { method: 'POST' });
    } catch {
      // Se elimina el dato local aunque falle la petición de cierre.
    }
    window.sessionStorage.removeItem(ID_CONVERSACION);
    mostrarCargaNavegacion();
    window.location.replace('../../index.html');
  }, [apiFetch]);

  const mostrarBarraDesplazamiento = useCallback(() => {
    setChatScrollActive(true);
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setChatScrollActive(false), 1400);
  }, []);

  const handleSendKey = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        enviarMensaje();
      }
    },
    [enviarMensaje],
  );

  const handleChatKey = useCallback(
    (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      mostrarBarraDesplazamiento();
      const chat = chatRef.current;
      const distancia = Math.max(48, Math.round(chat.clientHeight * 0.14));
      chat.scrollBy({ top: event.key === 'ArrowUp' ? -distancia : distancia, behavior: 'auto' });
    },
    [mostrarBarraDesplazamiento],
  );

  const crearNuevaConversacion = useCallback(async () => {
    try {
      await crearConversacion();
      setView('chat');
      if (window.matchMedia('(max-width: 700px)').matches) setHistoryHidden(true);
    } catch (error) {
      mostrarNotificacion(error.message || 'No se pudo crear la conversación.');
    }
  }, [crearConversacion, mostrarNotificacion]);

  const toggleHistory = useCallback(() => setHistoryHidden((hidden) => !hidden), []);

  const salirAlInicio = useCallback(async () => {
    await cerrarSesion();
  }, [cerrarSesion]);

  const conversacionesFijadas = conversations.filter((conversation) => conversation.fijada);
  const conversacionesRecientes = conversations.filter((conversation) => !conversation.fijada);
  const currentConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const reintentarMensaje = useCallback(
    (pending) => {
      if (pending && !sending) enviarPendiente(pending);
    },
    [enviarPendiente, sending],
  );

  return {
    user,
    conversations,
    conversacionesFijadas,
    conversacionesRecientes,
    currentConversation,
    conversationId,
    messages,
    quota,
    input,
    setInput,
    view,
    viewTransition,
    leavingView,
    historyHidden,
    setHistoryHidden,
    loading,
    sending,
    notice,
    modal,
    modalBusy,
    modalError,
    setModal,
    setModalError,
    accountMenuOpen,
    setAccountMenuOpen,
    accountTotal,
    accountError,
    supportRequests,
    supportStatus,
    supportBusy,
    supportForm,
    setSupportForm,
    scheduledDeletion,
    pilotEnded,
    menuConversacion,
    setMenuConversacion,
    closingPinned,
    animatingRows,
    chatScrollActive,
    chatRef,
    inputRef,
    abrirConversacion,
    crearNuevaConversacion,
    enviarMensaje,
    reintentarMensaje,
    handleSendKey,
    handleChatKey,
    cambiarVista,
    toggleHistory,
    confirmarModal,
    renombrarConversacion,
    fijarConversacion,
    borrarConversacion,
    borrarTodasConversaciones,
    cambiarNombre,
    eliminarCuenta,
    enviarSolicitudSoporte,
    cerrarSesion,
    mostrarBarraDesplazamiento,
    cargarSolicitudesSoporte,
    setSupportStatus,
    salirAlInicio,
  };
}
