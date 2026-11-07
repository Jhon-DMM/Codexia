const adminService = require('../services/admin.servicio');
const { registrarError } = require('../utils/registro-errores');

function paginacion(valor, predeterminado, maximo) {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero >= 0 ? Math.min(numero, maximo) : predeterminado;
}

async function resumen(req, res) {
  return res.json({ resumen: await adminService.obtenerResumen() });
}

async function clientes(req, res) {
  const busqueda =
    typeof req.query.busqueda === 'string' ? req.query.busqueda.trim().slice(0, 100) : '';
  const resultado = await adminService.listarClientes({
    busqueda,
    limite: paginacion(req.query.limite, 25, 100),
    offset: paginacion(req.query.offset, 0, 100000),
  });
  await adminService.registrarAuditoria({
    actor: req.usuario,
    accion: 'clientes_consultados',
    objetivoTipo: 'clientes',
    detalles: { cantidad: resultado.clientes.length },
    req,
  });
  return res.json(resultado);
}

async function actualizarEstadoCliente(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const estado = req.body?.estado;
  if (!Number.isInteger(id) || id < 1 || !['activo', 'suspendido'].includes(estado)) {
    return res.status(400).json({ mensaje: 'La cuenta o el estado indicado no son válidos' });
  }
  const cliente = await adminService.cambiarEstadoCliente({
    admin: req.usuario,
    clienteId: id,
    estado,
    req,
  });
  if (!cliente) return res.status(404).json({ mensaje: 'No encontramos ese cliente' });
  return res.json({ cliente });
}

async function auditoria(req, res) {
  const limite = paginacion(req.query.limite, 50, 100);
  const offset = paginacion(req.query.offset, 0, 100000);
  const categorias = ['', 'consultas', 'cambios'];
  const acciones = [
    '',
    'clientes_consultados',
    'solicitudes_soporte_consultadas',
    'cliente_suspendido',
    'cliente_reactivado',
    'soporte_respondido',
    'soporte_cerrado',
    'cuentas_eliminadas',
    'eliminacion_programada',
    'eliminacion_cancelada',
  ];
  const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : '';
  const accion = typeof req.query.accion === 'string' ? req.query.accion : '';
  const actor = typeof req.query.actor === 'string' ? req.query.actor.trim().slice(0, 254) : '';
  const desde = typeof req.query.desde === 'string' ? req.query.desde : '';
  const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : '';
  const fechaValida = (fecha) => {
    if (!fecha) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const fechaParseada = new Date(`${fecha}T00:00:00.000Z`);
    return (
      Number.isFinite(fechaParseada.getTime()) && fechaParseada.toISOString().slice(0, 10) === fecha
    );
  };

  if (!categorias.includes(categoria) || !acciones.includes(accion)) {
    return res.status(400).json({ mensaje: 'El filtro indicado no es válido.' });
  }
  if (!fechaValida(desde) || !fechaValida(hasta) || (desde && hasta && desde > hasta)) {
    return res.status(400).json({ mensaje: 'Revisa el rango de fechas seleccionado.' });
  }

  const resultado = await adminService.listarAuditoria({
    limite,
    offset,
    categoria,
    accion,
    actor,
    desde,
    hasta,
  });
  return res.json(resultado);
}

async function salud(req, res) {
  try {
    return res.json({ salud: await adminService.obtenerSalud() });
  } catch (error) {
    error.status = 503;
    registrarError(error, { req, contexto: 'salud_sistema' });
    return res.status(503).json({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      mensaje: 'No fue posible consultar la base de datos',
      requestId: req.id || null,
      salud: { api: 'disponible', baseDatos: 'sin conexión' },
    });
  }
}

async function solicitudesSoporte(req, res) {
  const estado =
    typeof req.query.estado === 'string' &&
    ['abierta', 'respondida', 'cerrada'].includes(req.query.estado)
      ? req.query.estado
      : '';
  const solicitudes = await adminService.listarSolicitudesSoporte({
    estado,
    limite: paginacion(req.query.limite, 50, 100),
  });
  await adminService.registrarAuditoria({
    actor: req.usuario,
    accion: 'solicitudes_soporte_consultadas',
    objetivoTipo: 'soporte',
    detalles: { cantidad: solicitudes.length },
    req,
  });
  return res.json({ solicitudes });
}

async function responderSoporte(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' });
  try {
    const solicitud = await adminService.responderSolicitudSoporte({
      admin: req.usuario,
      id,
      respuesta: typeof req.body?.respuesta === 'string' ? req.body.respuesta : '',
      estado: req.body?.estado,
      req,
    });
    if (!solicitud) return res.status(404).json({ mensaje: 'No encontramos esa solicitud' });
    return res.json({ solicitud });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    throw error;
  }
}

async function listarEliminaciones(req, res) {
  return res.json({ eliminaciones: await adminService.listarEliminacionesProgramadas() });
}

async function programarEliminacion(req, res) {
  try {
    const resultado = await adminService.programarEliminacionesCuenta({
      admin: req.usuario,
      usuarioIds: req.body?.usuarioIds,
      motivo: req.body?.motivo,
      detalles: req.body?.detalles,
      demoraHoras: req.body?.demoraHoras,
      password: req.body?.password,
      req,
    });
    return res.status(201).json(resultado);
  } catch (error) {
    if (error.status && error.status < 500) {
      if (error.reintentarEn) res.set('Retry-After', String(error.reintentarEn));
      return res.status(error.status).json({
        mensaje: error.message,
        ...(Number.isInteger(error.intentosRestantes)
          ? { intentosRestantes: error.intentosRestantes }
          : {}),
        ...(error.reintentarEn ? { reintentarEn: error.reintentarEn } : {}),
      });
    }
    if (error.code === '23505')
      return res
        .status(409)
        .json({ mensaje: 'Una o más cuentas ya tienen una eliminación pendiente.' });
    throw error;
  }
}

async function cancelarEliminacion(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id < 1)
    return res.status(400).json({ mensaje: 'La eliminación indicada no es válida.' });
  const cancelada = await adminService.cancelarEliminacionCuenta({ admin: req.usuario, id, req });
  if (!cancelada)
    return res
      .status(404)
      .json({ mensaje: 'No encontramos una eliminación pendiente para cancelar.' });
  return res.json({ mensaje: 'La eliminación se canceló.', eliminacion: cancelada });
}

async function verificarPasswordAdmin(req, res) {
  const password = req.body?.password;
  if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 1024) {
    return res.status(400).json({ mensaje: 'Escribe la contraseña admin para continuar.' });
  }
  try {
    await adminService.verificarPasswordAdmin(req.usuario.id, password);
    return res.json({ verificada: true });
  } catch (error) {
    if (error.status && error.status < 500) {
      if (error.reintentarEn) res.set('Retry-After', String(error.reintentarEn));
      return res.status(error.status).json({
        mensaje: error.message,
        ...(Number.isInteger(error.intentosRestantes)
          ? { intentosRestantes: error.intentosRestantes }
          : {}),
        ...(error.reintentarEn ? { reintentarEn: error.reintentarEn } : {}),
      });
    }
    throw error;
  }
}

async function miAcceso(req, res) {
  return res.json({
    usuario: {
      id: req.usuario.id,
      nombre: req.usuario.nombre,
      correo: req.usuario.correo,
      rol: req.usuario.rol,
    },
  });
}

module.exports = {
  resumen,
  clientes,
  actualizarEstadoCliente,
  auditoria,
  salud,
  solicitudesSoporte,
  responderSoporte,
  listarEliminaciones,
  programarEliminacion,
  cancelarEliminacion,
  verificarPasswordAdmin,
  miAcceso,
};
