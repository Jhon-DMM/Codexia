import { useCallback, useEffect, useRef, useState } from 'react';
import { mostrarCargaNavegacion } from '../../js/carga-ui.js';

const TAMANO_CLIENTES = 25;
const TAMANO_ELIMINACIONES = 50;
const TAMANO_AUDITORIA = 50;

function apiBaseUrl() {
  const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'file:') return 'http://localhost:3000';
  if (local && port !== '3000') return `http://${hostname}:3000`;
  return '';
}

export function useAdmin() {
  const [admin, setAdmin] = useState(null);
  const [view, setView] = useState('resumen');
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [notification, setNotification] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientOffset, setClientOffset] = useState(0);
  const [clients, setClients] = useState([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [roleAccounts, setRoleAccounts] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleOffset, setRoleOffset] = useState(0);
  const [roleTotal, setRoleTotal] = useState(0);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [deleteSearch, setDeleteSearch] = useState('');
  const [deleteOffset, setDeleteOffset] = useState(0);
  const [deleteCandidates, setDeleteCandidates] = useState([]);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [scheduledDeletions, setScheduledDeletions] = useState([]);
  const [deletionsLoading, setDeletionsLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    categoria: '',
    accion: '',
    actor: '',
    desde: '',
    hasta: '',
  });
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [supportFilter, setSupportFilter] = useState('');
  const [supportRequests, setSupportRequests] = useState([]);
  const [supportResponses, setSupportResponses] = useState({});
  const [supportLoading, setSupportLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState({});
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteStep, setDeleteStep] = useState('verificacion');
  const [deleteFields, setDeleteFields] = useState({
    password: '',
    motivo: '',
    detalles: '',
    demoraHoras: '0',
  });
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const noticeTimer = useRef(null);
  const clientSearchTimer = useRef(null);
  const deleteSearchTimer = useRef(null);
  const roleSearchTimer = useRef(null);
  const clientQueryRef = useRef({ offset: 0, search: '' });
  const deleteQueryRef = useRef({ offset: 0, search: '' });
  const roleQueryRef = useRef({ offset: 0, search: '' });
  clientQueryRef.current = { offset: clientOffset, search: clientSearch };
  deleteQueryRef.current = { offset: deleteOffset, search: deleteSearch };
  roleQueryRef.current = { offset: roleOffset, search: roleSearch };

  const notificar = useCallback((texto, error = false) => {
    window.clearTimeout(noticeTimer.current);
    setNotification({ texto, error });
    noticeTimer.current = window.setTimeout(() => setNotification(null), 3800);
  }, []);

  const mostrarMensaje = useCallback((texto, error = false) => {
    setMessage(texto);
    setMessageError(error);
  }, []);

  const api = useCallback(async (ruta, opciones = {}) => {
    const respuesta = await fetch(`${apiBaseUrl()}/api/admin${ruta}`, {
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
      // Una eliminación exitosa puede responder sin cuerpo.
    }

    if (respuesta.status === 401 || (respuesta.status === 403 && ruta === '/me')) {
      const next = `${window.location.pathname}${window.location.search}`;
      mostrarCargaNavegacion();
      window.location.replace(
        respuesta.status === 401
          ? `acceso.html?next=${encodeURIComponent(next)}`
          : 'acceso.html?motivo=permisos',
      );
    }
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo completar la solicitud.');
    return datos;
  }, []);

  const cargarResumen = useCallback(async () => {
    const { resumen } = await api('/resumen');
    setSummary(resumen);
    return resumen;
  }, [api]);

  const cargarSalud = useCallback(async () => {
    try {
      const { salud } = await api('/salud');
      setHealth(salud);
      return salud;
    } catch (error) {
      setHealth({ api: 'disponible', baseDatos: 'sin conexión', proveedorIA: '—', entorno: '—' });
      throw error;
    }
  }, [api]);

  const cargarClientes = useCallback(
    async (offset, busqueda) => {
      const pagina = offset ?? clientQueryRef.current.offset;
      const consulta = busqueda ?? clientQueryRef.current.search;
      setClientsLoading(true);
      try {
        const query = new URLSearchParams({
          busqueda: consulta.trim(),
          limite: String(TAMANO_CLIENTES),
          offset: String(pagina),
        });
        const datos = await api(`/clientes?${query}`);
        setClients(datos.clientes);
        setClientTotal(datos.total);
        setClientOffset(pagina);
        const programados = new Set(
          datos.clientes
            .filter((client) => client.eliminacion_programada_en)
            .map((client) => String(client.id)),
        );
        setSelectedUsers((selected) =>
          selected.filter((user) => !programados.has(String(user.id))),
        );
        return datos;
      } finally {
        setClientsLoading(false);
      }
    },
    [api],
  );

  const cargarCuentasConRol = useCallback(
    async (offset = roleQueryRef.current.offset, busqueda = roleQueryRef.current.search) => {
      setRolesLoading(true);
      try {
        const query = new URLSearchParams({
          busqueda: busqueda.trim(),
          limite: '25',
          offset: String(offset),
        });
        const datos = await api(`/roles/cuentas?${query}`);
        setRoleAccounts(datos.cuentas);
        setRoleTotal(datos.total);
        setRoleOffset(offset);
        return datos;
      } finally {
        setRolesLoading(false);
      }
    },
    [api],
  );

  const cambiarRolCuenta = useCallback(
    async (cuenta) => {
      const rol = cuenta.rol === 'admin' ? 'cliente' : 'admin';
      const confirmacion = rol === 'admin'
        ? `¿Asignar el rol admin a ${cuenta.nombre}?`
        : `¿Quitar el rol admin a ${cuenta.nombre}? Sus sesiones actuales se cerrarán.`;
      if (!window.confirm(confirmacion)) return;
      setActionBusy((current) => ({ ...current, [`rol-${cuenta.id}`]: true }));
      try {
        await api(`/roles/cuentas/${encodeURIComponent(cuenta.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ rol }),
        });
        const mensaje = rol === 'admin'
          ? `${cuenta.nombre} ahora tiene rol admin.`
          : `Se quitó el rol admin a ${cuenta.nombre}.`;
        mostrarMensaje(mensaje);
        notificar(mensaje);
        await cargarCuentasConRol();
      } catch (error) {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      } finally {
        setActionBusy((current) => ({ ...current, [`rol-${cuenta.id}`]: false }));
      }
    },
    [api, cargarCuentasConRol, mostrarMensaje, notificar],
  );

  const cargarCandidatosEliminacion = useCallback(
    async (offset, busqueda) => {
      const pagina = offset ?? deleteQueryRef.current.offset;
      const consulta = busqueda ?? deleteQueryRef.current.search;
      setDeletionsLoading(true);
      try {
        const query = new URLSearchParams({
          busqueda: consulta.trim(),
          limite: String(TAMANO_ELIMINACIONES),
          offset: String(pagina),
        });
        const datos = await api(`/clientes?${query}`);
        setDeleteCandidates(datos.clientes);
        setDeleteTotal(datos.total);
        setDeleteOffset(pagina);
        const programados = new Set(
          datos.clientes
            .filter((client) => client.eliminacion_programada_en)
            .map((client) => String(client.id)),
        );
        setSelectedUsers((selected) =>
          selected.filter((user) => !programados.has(String(user.id))),
        );
        return datos;
      } finally {
        setDeletionsLoading(false);
      }
    },
    [api],
  );

  const cargarEliminacionesPendientes = useCallback(async () => {
    const { eliminaciones } = await api('/eliminaciones');
    setScheduledDeletions(eliminaciones);
    return eliminaciones;
  }, [api]);

  const cargarAuditoria = useCallback(
    async (offset = auditOffset, filtros = auditFilters, tipoAviso = '') => {
      const query = new URLSearchParams({
        limite: String(TAMANO_AUDITORIA),
        offset: String(offset),
      });
      Object.entries(filtros).forEach(([nombre, valor]) => {
        if (valor.trim()) query.set(nombre, valor.trim());
      });
      const { eventos, total } = await api(`/auditoria?${query}`);
      setAuditEvents(eventos);
      setAuditTotal(total);
      setAuditOffset(offset);

      if (tipoAviso) {
        const inicio = tipoAviso === 'limpiar' ? 'Filtros limpiados' : 'Filtros aplicados';
        const resultado = total
          ? `${new Intl.NumberFormat('es-CO').format(total)} ${total === 1 ? 'evento encontrado' : 'eventos encontrados'}.`
          : 'No hay eventos coincidentes.';
        notificar(`${inicio}. ${resultado}`);
      }
      return { eventos, total };
    },
    [api, auditFilters, auditOffset, notificar],
  );

  const cargarSoporte = useCallback(
    async (estado = supportFilter) => {
      setSupportLoading(true);
      try {
        const query = new URLSearchParams({ limite: '50' });
        if (estado) query.set('estado', estado);
        const { solicitudes } = await api(`/soporte?${query}`);
        setSupportRequests(solicitudes);
        return solicitudes;
      } finally {
        setSupportLoading(false);
      }
    },
    [api, supportFilter],
  );

  useEffect(() => {
    let activo = true;
    async function iniciar() {
      try {
        const { usuario } = await api('/me');
        if (!activo) return;
        setAdmin(usuario);
        await Promise.all([cargarResumen(), cargarSalud()]);
        if (activo) mostrarMensaje('');
      } catch (error) {
        if (activo) mostrarMensaje(error.message, true);
      }
    }
    iniciar();
    return () => {
      activo = false;
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(clientSearchTimer.current);
      window.clearTimeout(deleteSearchTimer.current);
    };
  }, [api, cargarResumen, cargarSalud, mostrarMensaje]);

  useEffect(() => {
    if (view !== 'clientes') return undefined;
    window.clearTimeout(clientSearchTimer.current);
    clientSearchTimer.current = window.setTimeout(() => {
      cargarClientes(0, clientSearch).catch((error) => {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      });
    }, 250);
    return () => window.clearTimeout(clientSearchTimer.current);
  }, [clientSearch, view, cargarClientes, mostrarMensaje, notificar]);

  useEffect(() => {
    if (view !== 'eliminaciones') return undefined;
    window.clearTimeout(deleteSearchTimer.current);
    deleteSearchTimer.current = window.setTimeout(() => {
      cargarCandidatosEliminacion(0, deleteSearch).catch((error) => {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      });
    }, 250);
    return () => window.clearTimeout(deleteSearchTimer.current);
  }, [deleteSearch, view, cargarCandidatosEliminacion, mostrarMensaje, notificar]);

  useEffect(() => {
    if (view !== 'roles') return undefined;
    window.clearTimeout(roleSearchTimer.current);
    roleSearchTimer.current = window.setTimeout(() => {
      cargarCuentasConRol(0, roleSearch).catch((error) => {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      });
    }, 250);
    return () => window.clearTimeout(roleSearchTimer.current);
  }, [roleSearch, view, cargarCuentasConRol, mostrarMensaje, notificar]);

  const cargarVista = useCallback(
    async (nuevaVista) => {
      setView(nuevaVista);
      try {
        if (nuevaVista === 'eliminaciones') await cargarEliminacionesPendientes();
        if (nuevaVista === 'auditoria') await cargarAuditoria(0);
        if (nuevaVista === 'soporte') await cargarSoporte();
      } catch (error) {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      }
    },
    [cargarAuditoria, cargarEliminacionesPendientes, cargarSoporte, mostrarMensaje, notificar],
  );

  const actualizarTodo = useCallback(async () => {
    mostrarMensaje('Actualizando información…');
    try {
      await Promise.all([cargarResumen(), cargarSalud()]);
      mostrarMensaje('Información actualizada.');
      notificar('Información actualizada.');
    } catch (error) {
      mostrarMensaje(error.message, true);
      notificar(error.message, true);
    }
  }, [cargarResumen, cargarSalud, mostrarMensaje, notificar]);

  const cambiarEstadoCliente = useCallback(
    async (client) => {
      const estado = client.estado === 'suspendido' ? 'activo' : 'suspendido';
      setActionBusy((current) => ({ ...current, [client.id]: true }));
      try {
        await api(`/clientes/${encodeURIComponent(client.id)}/estado`, {
          method: 'PATCH',
          body: JSON.stringify({ estado }),
        });
        const confirmacion =
          estado === 'suspendido' ? 'Cuenta suspendida y sesiones cerradas.' : 'Cuenta reactivada.';
        mostrarMensaje(confirmacion);
        notificar(confirmacion);
        await Promise.all([cargarClientes(), cargarResumen()]);
      } catch (error) {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      } finally {
        setActionBusy((current) => ({ ...current, [client.id]: false }));
      }
    },
    [api, cargarClientes, cargarResumen, mostrarMensaje, notificar],
  );

  const seleccionarUsuario = useCallback(
    (client, checked) => {
      setSelectedUsers((selected) => {
        const exists = selected.some((user) => String(user.id) === String(client.id));
        if (checked && !exists) {
          if (selected.length >= 100) {
            notificar('Puedes seleccionar un máximo de 100 cuentas a la vez.', true);
            return selected;
          }
          return [...selected, { id: client.id, nombre: client.nombre, correo: client.correo }];
        }
        return selected.filter((user) => String(user.id) !== String(client.id));
      });
    },
    [notificar],
  );

  const seleccionarVisibles = useCallback(
    (checked) => {
      setSelectedUsers((selected) => {
        const byId = new Map(selected.map((user) => [String(user.id), user]));
        deleteCandidates
          .filter((client) => !client.eliminacion_programada_en)
          .forEach((client) => {
            if (checked) {
              if (!byId.has(String(client.id)) && byId.size >= 100) return;
              byId.set(String(client.id), {
                id: client.id,
                nombre: client.nombre,
                correo: client.correo,
              });
            } else byId.delete(String(client.id));
          });
        if (checked && byId.size >= 100 && deleteCandidates.length > byId.size) {
          notificar('Se seleccionaron hasta 100 cuentas. Ese es el máximo por operación.', true);
        }
        return [...byId.values()];
      });
    },
    [deleteCandidates, notificar],
  );

  const abrirModalEliminacion = useCallback((targets) => {
    setDeleteModal(targets);
    setDeleteStep('verificacion');
    setDeleteFields({ password: '', motivo: '', detalles: '', demoraHoras: '0' });
    setDeleteError('');
  }, []);

  const cerrarModalEliminacion = useCallback(() => {
    setDeleteModal(null);
    setDeleteError('');
    setDeleteFields((current) => ({ ...current, password: '' }));
  }, []);

  const volverVerificacionEliminacion = useCallback(() => {
    setDeleteStep('verificacion');
    setDeleteError('');
  }, []);

  const verificarPassword = useCallback(async () => {
    if (!deleteFields.password) {
      setDeleteError('Escribe tu contraseña admin.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api('/verificar-password', {
        method: 'POST',
        body: JSON.stringify({ password: deleteFields.password }),
      });
      setDeleteStep('detalles');
    } catch (error) {
      setDeleteError(error.message);
      notificar(error.message, true);
    } finally {
      setDeleteBusy(false);
    }
  }, [api, deleteFields.password, notificar]);

  const confirmarEliminacion = useCallback(
    async (event) => {
      event.preventDefault();
      const motivo = deleteFields.motivo.trim();
      const detalles = deleteFields.detalles.trim();
      if (!motivo || detalles.length < 20 || !deleteFields.password) {
        setDeleteError('Completa el motivo y escribe al menos 20 caracteres de detalle.');
        return;
      }
      setDeleteBusy(true);
      setDeleteError('');
      try {
        const resultado = await api('/eliminaciones', {
          method: 'POST',
          body: JSON.stringify({
            usuarioIds: deleteModal.map(({ id }) => Number(id)),
            motivo,
            detalles,
            demoraHoras: Number(deleteFields.demoraHoras),
            password: deleteFields.password,
          }),
        });
        const cantidad = resultado.cantidad;
        const inmediata = Number(deleteFields.demoraHoras) === 0;
        const confirmacion = inmediata
          ? `${cantidad} cuenta${cantidad === 1 ? '' : 's'} eliminada${cantidad === 1 ? '' : 's'} inmediatamente.`
          : `Eliminación de ${cantidad} cuenta${cantidad === 1 ? '' : 's'} programada para dentro de ${deleteFields.demoraHoras} h.`;
        cerrarModalEliminacion();
        setSelectedUsers([]);
        mostrarMensaje(confirmacion);
        notificar(confirmacion);
        await Promise.all([
          cargarClientes(),
          cargarCandidatosEliminacion(),
          cargarEliminacionesPendientes(),
          cargarResumen(),
        ]);
      } catch (error) {
        setDeleteError(error.message);
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      } finally {
        setDeleteBusy(false);
      }
    },
    [
      api,
      cargarCandidatosEliminacion,
      cargarClientes,
      cargarEliminacionesPendientes,
      cargarResumen,
      cerrarModalEliminacion,
      deleteFields,
      deleteModal,
      mostrarMensaje,
      notificar,
    ],
  );

  const cancelarEliminacion = useCallback(
    async (deletion) => {
      setActionBusy((current) => ({ ...current, [`del-${deletion.id}`]: true }));
      try {
        await api(`/eliminaciones/${encodeURIComponent(deletion.id)}`, { method: 'DELETE' });
        notificar('Se canceló la eliminación programada.');
        mostrarMensaje('La cuenta permanece activa.');
        await Promise.all([
          cargarEliminacionesPendientes(),
          cargarClientes(),
          cargarCandidatosEliminacion(),
        ]);
      } catch (error) {
        notificar(error.message, true);
        mostrarMensaje(error.message, true);
      } finally {
        setActionBusy((current) => ({ ...current, [`del-${deletion.id}`]: false }));
      }
    },
    [
      api,
      cargarCandidatosEliminacion,
      cargarClientes,
      cargarEliminacionesPendientes,
      mostrarMensaje,
      notificar,
    ],
  );

  const cambiarRespuestaSoporte = useCallback((id, respuesta) => {
    setSupportResponses((current) => ({ ...current, [id]: respuesta }));
  }, []);

  const actualizarSolicitudSoporte = useCallback(
    async (request, estado) => {
      const respuesta = supportResponses[request.id] || '';
      if (estado === 'respondida' && !respuesta.trim()) {
        const aviso =
          'Escribe una respuesta antes de enviarla. Usa “Cerrar solicitud” si no requiere respuesta.';
        mostrarMensaje(aviso, true);
        notificar(aviso, true);
        return;
      }
      setActionBusy((current) => ({ ...current, [`support-${request.id}`]: true }));
      try {
        await api(`/soporte/${encodeURIComponent(request.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ estado, respuesta }),
        });
        const confirmacion =
          estado === 'respondida' ? 'Respuesta enviada al cliente.' : 'Solicitud cerrada.';
        setSupportResponses((current) => ({ ...current, [request.id]: '' }));
        mostrarMensaje(confirmacion);
        notificar(confirmacion);
        await cargarSoporte();
      } catch (error) {
        mostrarMensaje(error.message, true);
        notificar(error.message, true);
      } finally {
        setActionBusy((current) => ({ ...current, [`support-${request.id}`]: false }));
      }
    },
    [api, cargarSoporte, mostrarMensaje, notificar, supportResponses],
  );

  const aplicarFiltrosAuditoria = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        await cargarAuditoria(0, auditFilters, 'aplicar');
        mostrarMensaje('Filtros aplicados.');
      } catch (error) {
        mostrarMensaje(error.message, true);
        notificar(`No se pudieron aplicar los filtros: ${error.message}`, true);
      }
    },
    [auditFilters, cargarAuditoria, mostrarMensaje, notificar],
  );

  const limpiarFiltrosAuditoria = useCallback(async () => {
    const vacios = { categoria: '', accion: '', actor: '', desde: '', hasta: '' };
    setAuditFilters(vacios);
    try {
      await cargarAuditoria(0, vacios, 'limpiar');
      mostrarMensaje('Filtros limpiados.');
    } catch (error) {
      mostrarMensaje(error.message, true);
      notificar(`No se pudieron limpiar los filtros: ${error.message}`, true);
    }
  }, [cargarAuditoria, mostrarMensaje, notificar]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const titulos = {
    resumen: 'Resumen',
    clientes: 'Clientes',
    eliminaciones: 'Eliminaciones',
    uso: 'Uso y costos',
    soporte: 'Soporte',
    auditoria: 'Seguridad y auditoría',
    facturacion: 'Planes y facturación',
    roles: 'Administrar roles',
  };

  return {
    admin,
    view,
    titulos,
    summary,
    health,
    message,
    messageError,
    notification,
    clients,
    clientSearch,
    setClientSearch,
    clientOffset,
    clientTotal,
    clientsLoading,
    roleAccounts,
    roleSearch,
    setRoleSearch,
    roleOffset,
    setRoleOffset,
    roleTotal,
    rolesLoading,
    deleteSearch,
    setDeleteSearch,
    deleteOffset,
    deleteCandidates,
    deleteTotal,
    deletionsLoading,
    selectedUsers,
    scheduledDeletions,
    auditFilters,
    setAuditFilters,
    auditOffset,
    auditEvents,
    auditTotal,
    supportFilter,
    setSupportFilter,
    supportRequests,
    supportResponses,
    supportLoading,
    actionBusy,
    deleteModal,
    deleteStep,
    deleteFields,
    setDeleteFields,
    deleteError,
    deleteBusy,
    cargarVista,
    actualizarTodo,
    cargarClientes,
    cargarCuentasConRol,
    cargarCandidatosEliminacion,
    cargarEliminacionesPendientes,
    cargarAuditoria,
    cargarSoporte,
    cambiarEstadoCliente,
    cambiarRolCuenta,
    seleccionarUsuario,
    seleccionarVisibles,
    abrirModalEliminacion,
    cerrarModalEliminacion,
    volverVerificacionEliminacion,
    verificarPassword,
    confirmarEliminacion,
    cancelarEliminacion,
    cambiarRespuestaSoporte,
    actualizarSolicitudSoporte,
    aplicarFiltrosAuditoria,
    limpiarFiltrosAuditoria,
    notificar,
  };
}
