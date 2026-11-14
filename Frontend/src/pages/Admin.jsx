import React, { useEffect, useRef } from 'react';
import '../../css/base.css';
import '../../css/admin.css';
import { useAdmin } from '../hooks/useAdmin.js';

const formatoNumero = (valor) =>
  valor == null || valor === '' ? '—' : new Intl.NumberFormat('es-CO').format(Number(valor) || 0);
const formatoFecha = (valor, larga = false) =>
  valor
    ? new Intl.DateTimeFormat('es-CO', {
        dateStyle: larga ? 'long' : 'medium',
        ...(larga ? { timeStyle: 'short' } : {}),
      }).format(new Date(valor))
    : 'Sin actividad';

function Paginacion({ offset, total, limite, etiqueta, onAnterior, onSiguiente }) {
  const pagina = Math.floor(offset / limite) + 1;
  const paginas = Math.max(1, Math.ceil(total / limite));
  return (
    <div className="admin-paginacion">
      <button
        className="btn btn-fantasma"
        type="button"
        disabled={offset === 0}
        onClick={onAnterior}
      >
        Anterior
      </button>
      <span>{etiqueta ? `Página ${pagina} de ${paginas}` : `Página ${pagina}`}</span>
      <button
        className="btn btn-fantasma"
        type="button"
        disabled={offset + limite >= total}
        onClick={onSiguiente}
      >
        Siguiente
      </button>
    </div>
  );
}

function Resumen({ state }) {
  const resumen = state.summary || {};
  const salud = state.health || {};
  const etiqueta =
    salud.baseDatos === 'disponible' ? 'Operativo' : salud.baseDatos ? 'Revisar' : 'Consultando';
  return (
    <section className="admin-vista activa" data-panel="resumen">
      <div className="admin-tarjetas-metricas">
        <article className="admin-metrica">
          <span>Clientes</span>
          <strong>{formatoNumero(resumen.clientes)}</strong>
          <small>Registros últimos 30 días: {formatoNumero(resumen.registros_30_dias)}</small>
        </article>
        <article className="admin-metrica">
          <span>Cuentas activas</span>
          <strong>{formatoNumero(resumen.clientes_activos)}</strong>
          <small>Suspendidas: {formatoNumero(resumen.suspendidos)}</small>
        </article>
        <article className="admin-metrica">
          <span>Mensajes hoy</span>
          <strong>{formatoNumero(resumen.mensajes_hoy)}</strong>
          <small>Límite actual por cliente: {formatoNumero(resumen.limiteDiarioActual)}</small>
        </article>
        <article className="admin-metrica">
          <span>Mensajes últimos 30 días</span>
          <strong>{formatoNumero(resumen.mensajes_30_dias)}</strong>
          <small>Solo se muestran cantidades, no el contenido.</small>
        </article>
      </div>
      <div className="admin-panel admin-estado-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">SERVICIO</p>
            <h2>Estado de Codexia</h2>
          </div>
          <span
            className={`estado-pill${salud.baseDatos && salud.baseDatos !== 'disponible' ? ' error' : ''}`}
          >
            {etiqueta}
          </span>
        </div>
        <div className="admin-estado-grid">
          <div>
            <span>API</span>
            <strong>{salud.api || '—'}</strong>
          </div>
          <div>
            <span>PostgreSQL</span>
            <strong>{salud.baseDatos || '—'}</strong>
          </div>
          <div>
            <span>Proveedor de IA</span>
            <strong>{salud.proveedorIA || '—'}</strong>
          </div>
          <div>
            <span>Entorno</span>
            <strong>{salud.entorno || '—'}</strong>
          </div>
        </div>
        <p className="admin-ayuda">
          {salud.respuestaBaseDatosMs == null
            ? ''
            : `Consulta a PostgreSQL: ${salud.respuestaBaseDatosMs} ms.`}
        </p>
      </div>
      <div className="admin-panel admin-nota-privacidad">
        <span className="admin-nota-icono" aria-hidden="true">
          ◇
        </span>
        <div>
          <h2>Privacidad de los clientes</h2>
          <p>
            El panel solo muestra actividad y cantidades. No permite abrir conversaciones ni leer
            mensajes. Si luego se agrega una herramienta de soporte con acceso a contenido, deberá
            tener autorización y dejar constancia de cada acceso.
          </p>
        </div>
      </div>
    </section>
  );
}

function Clientes({ state }) {
  const totalPaginas = Math.max(1, Math.ceil(state.clientTotal / 25));
  return (
    <section className="admin-vista activa" data-panel="clientes">
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">CUENTAS</p>
            <h2>Clientes</h2>
          </div>
          <span className="admin-contador">{formatoNumero(state.clientTotal)} cuentas</span>
        </div>
        <label className="admin-busqueda">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Buscar por nombre o correo"
            autoComplete="off"
            value={state.clientSearch}
            onChange={(event) => state.setClientSearch(event.target.value)}
          />
        </label>
        <div className="admin-tabla-contenedor">
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Mensajes hoy</th>
                <th>Total mensajes</th>
                <th>Conversaciones</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.clientsLoading ? (
                <tr>
                  <td colSpan="7" className="admin-vacio">
                    Cargando clientes…
                  </td>
                </tr>
              ) : state.clients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-vacio">
                    No encontramos clientes con esos datos.
                  </td>
                </tr>
              ) : (
                state.clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <span className="admin-cliente-nombre">{client.nombre}</span>
                      <span className="admin-cliente-correo">{client.correo}</span>
                    </td>
                    <td>{client.estado === 'suspendido' ? 'Suspendido' : 'Activo'}</td>
                    <td>{formatoNumero(client.mensajes_hoy)}</td>
                    <td>{formatoNumero(client.mensajes_totales)}</td>
                    <td>{formatoNumero(client.conversaciones)}</td>
                    <td>
                      <time dateTime={client.creado_en}>{formatoFecha(client.creado_en)}</time>
                    </td>
                    <td>
                      <div className="admin-acciones-cliente">
                        <button
                          className="admin-accion"
                          type="button"
                          disabled={state.actionBusy[client.id]}
                          onClick={() => state.cambiarEstadoCliente(client)}
                        >
                          {client.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
                        </button>
                        <button
                          className={`admin-accion admin-accion-peligro${client.eliminacion_programada_en ? ' admin-accion-programada' : ''}`}
                          type="button"
                          disabled={Boolean(client.eliminacion_programada_en)}
                          title={
                            client.eliminacion_programada_en
                              ? `Eliminación prevista para ${formatoFecha(client.eliminacion_programada_en)}`
                              : 'Programar o ejecutar eliminación de cuenta'
                          }
                          onClick={() =>
                            state.abrirModalEliminacion([
                              { id: client.id, nombre: client.nombre, correo: client.correo },
                            ])
                          }
                        >
                          {client.eliminacion_programada_en ? 'Programada' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion
          offset={state.clientOffset}
          total={state.clientTotal}
          limite={25}
          onAnterior={() =>
            state
              .cargarClientes(Math.max(0, state.clientOffset - 25))
              .catch((error) => state.notificar(error.message, true))
          }
          onSiguiente={() =>
            state
              .cargarClientes(Math.min(state.clientOffset + 25, Math.max(0, state.clientTotal - 1)))
              .catch((error) => state.notificar(error.message, true))
          }
        />
        <span className="sr-only">{totalPaginas} páginas</span>
      </div>
    </section>
  );
}

function Roles({ state }) {
  const limite = 25;
  return (
    <section className="admin-vista activa" data-panel="roles">
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">CONTROL DE ACCESO</p>
            <h2>Roles de las cuentas</h2>
          </div>
          <span className="admin-contador">{formatoNumero(state.roleTotal)} cuentas</span>
        </div>
        <p className="admin-ayuda">
          Asigna o retira el rol admin. Los cambios quedan registrados y, al retirar el rol, se
          cierran las sesiones administrativas de esa cuenta.
        </p>
        <label className="admin-busqueda">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Buscar por nombre o correo"
            autoComplete="off"
            value={state.roleSearch}
            onChange={(event) => {
              state.setRoleSearch(event.target.value);
              state.setRoleOffset(0);
            }}
          />
        </label>
        <div className="admin-tabla-contenedor">
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {state.rolesLoading ? (
                <tr>
                  <td colSpan="5" className="admin-vacio">Cargando cuentas…</td>
                </tr>
              ) : state.roleAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="admin-vacio">No encontramos cuentas.</td>
                </tr>
              ) : state.roleAccounts.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td>
                    <span className="admin-cliente-nombre">{cuenta.nombre}</span>
                    <span className="admin-cliente-correo">{cuenta.correo}</span>
                  </td>
                  <td>
                    {cuenta.rol === 'superadmin'
                      ? 'Superadmin'
                      : cuenta.rol === 'admin'
                        ? 'Admin'
                        : 'Cliente'}
                  </td>
                  <td>{cuenta.estado === 'suspendido' ? 'Suspendida' : 'Activa'}</td>
                  <td>
                    <time dateTime={cuenta.creado_en}>{formatoFecha(cuenta.creado_en)}</time>
                  </td>
                  <td>
                    {cuenta.rol === 'superadmin' ? (
                      <span className="admin-rol-protegido">Rol protegido</span>
                    ) : (
                      <button
                        className={`admin-accion${cuenta.rol === 'admin' ? ' admin-accion-peligro' : ''}`}
                        type="button"
                        disabled={state.actionBusy[`rol-${cuenta.id}`]}
                        onClick={() => state.cambiarRolCuenta(cuenta)}
                      >
                        {state.actionBusy[`rol-${cuenta.id}`]
                          ? 'Guardando…'
                          : cuenta.rol === 'admin'
                            ? 'Quitar admin'
                            : 'Hacer admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion
          offset={state.roleOffset}
          total={state.roleTotal}
          limite={limite}
          etiqueta
          onAnterior={() => state.cargarCuentasConRol(Math.max(0, state.roleOffset - limite))}
          onSiguiente={() =>
            state.cargarCuentasConRol(
              Math.min(state.roleOffset + limite, Math.max(0, state.roleTotal - 1)),
            )
          }
        />
      </div>
    </section>
  );
}

function Eliminaciones({ state }) {
  const visibles = state.deleteCandidates.filter((client) => !client.eliminacion_programada_en);
  const seleccionadasVisibles = visibles.filter((client) =>
    state.selectedUsers.some((user) => String(user.id) === String(client.id)),
  ).length;
  const todasVisibles = visibles.length > 0 && seleccionadasVisibles === visibles.length;
  return (
    <section className="admin-vista activa" data-panel="eliminaciones">
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">ACCIÓN IRREVERSIBLE</p>
            <h2>Eliminar varias cuentas</h2>
          </div>
          <button
            className="btn"
            type="button"
            disabled={!state.selectedUsers.length}
            onClick={() => state.abrirModalEliminacion(state.selectedUsers)}
          >
            Eliminar seleccionadas ({state.selectedUsers.length})
          </button>
        </div>
        <p className="admin-ayuda admin-ayuda-superior">
          Selecciona hasta 100 cuentas de clientes. Las cuentas admin no aparecen aquí. La
          eliminación borra conversaciones, mensajes, sesiones, cuota y solicitudes de soporte. La
          operación queda registrada en la auditoría.
        </p>
        <label className="admin-busqueda">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Buscar por nombre o correo"
            autoComplete="off"
            value={state.deleteSearch}
            onChange={(event) => state.setDeleteSearch(event.target.value)}
          />
        </label>
        <label className="admin-seleccionar-todos">
          <input
            type="checkbox"
            checked={todasVisibles}
            ref={(element) => {
              if (element) element.indeterminate = seleccionadasVisibles > 0 && !todasVisibles;
            }}
            onChange={(event) => state.seleccionarVisibles(event.target.checked)}
          />
          <span>Seleccionar los clientes mostrados</span>
        </label>
        <div className="admin-tabla-contenedor">
          <table className="admin-tabla">
            <thead>
              <tr>
                <th></th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Mensajes</th>
              </tr>
            </thead>
            <tbody>
              {state.deletionsLoading ? (
                <tr>
                  <td colSpan="4" className="admin-vacio">
                    Cargando clientes…
                  </td>
                </tr>
              ) : state.deleteCandidates.length === 0 ? (
                <tr>
                  <td colSpan="4" className="admin-vacio">
                    No encontramos clientes con esos datos.
                  </td>
                </tr>
              ) : (
                state.deleteCandidates.map((client) => {
                  const checked = state.selectedUsers.some(
                    (user) => String(user.id) === String(client.id),
                  );
                  return (
                    <tr key={client.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="admin-checkbox-cliente"
                          checked={checked}
                          disabled={Boolean(client.eliminacion_programada_en)}
                          aria-label={`Seleccionar a ${client.nombre}`}
                          onChange={(event) =>
                            state.seleccionarUsuario(client, event.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <span className="admin-cliente-nombre">{client.nombre}</span>
                        <span className="admin-cliente-correo">{client.correo}</span>
                      </td>
                      <td>
                        {client.eliminacion_programada_en
                          ? `Eliminación prevista: ${formatoFecha(client.eliminacion_programada_en)}`
                          : client.estado === 'suspendido'
                            ? 'Suspendido'
                            : 'Activo'}
                      </td>
                      <td>{formatoNumero(client.mensajes_totales)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Paginacion
          offset={state.deleteOffset}
          total={state.deleteTotal}
          limite={50}
          onAnterior={() =>
            state
              .cargarCandidatosEliminacion(Math.max(0, state.deleteOffset - 50))
              .catch((error) => state.notificar(error.message, true))
          }
          onSiguiente={() =>
            state
              .cargarCandidatosEliminacion(state.deleteOffset + 50)
              .catch((error) => state.notificar(error.message, true))
          }
        />
      </div>
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">PROGRAMADAS</p>
            <h2>Eliminaciones pendientes</h2>
          </div>
          <button
            className="btn btn-fantasma"
            type="button"
            onClick={() =>
              Promise.all([
                state.cargarCandidatosEliminacion(),
                state.cargarEliminacionesPendientes(),
              ])
                .then(() => state.notificar('Lista de eliminaciones actualizada.'))
                .catch((error) => state.notificar(error.message, true))
            }
          >
            Actualizar
          </button>
        </div>
        <div className="admin-eliminaciones-pendientes">
          {state.scheduledDeletions.length === 0 ? (
            <p className="admin-vacio">No hay eliminaciones pendientes.</p>
          ) : (
            state.scheduledDeletions.map((deletion) => (
              <article className="admin-eliminacion-pendiente" key={deletion.id}>
                <div>
                  <h3>
                    {deletion.nombre
                      ? `${deletion.nombre} · ${deletion.correo}`
                      : 'Cuenta pendiente'}
                  </h3>
                  <p>Motivo: {deletion.motivo}</p>
                  <p>{deletion.detalles}</p>
                  <time dateTime={deletion.eliminar_en}>
                    Se eliminará el {formatoFecha(deletion.eliminar_en, true)}
                  </time>
                </div>
                <button
                  className="admin-accion"
                  type="button"
                  disabled={state.actionBusy[`del-${deletion.id}`]}
                  onClick={() => state.cancelarEliminacion(deletion)}
                >
                  Cancelar
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Uso({ state }) {
  const resumen = state.summary || {};
  return (
    <section className="admin-vista activa" data-panel="uso">
      <div className="admin-panel">
        <p className="admin-eyebrow">CONSUMO</p>
        <h2>Uso y costos de IA</h2>
        <p>
          Codexia cuenta los mensajes por cliente y aplica actualmente el límite diario configurado.
          El costo real debe completarse al integrar facturación y obtener precios vigentes del
          proveedor de IA.
        </p>
        <div className="admin-info-grid">
          <article>
            <span>Mensajes hoy</span>
            <strong>{formatoNumero(resumen.mensajes_hoy)}</strong>
          </article>
          <article>
            <span>Mensajes en 30 días</span>
            <strong>{formatoNumero(resumen.mensajes_30_dias)}</strong>
          </article>
          <article>
            <span>Límite por cliente</span>
            <strong>
              {resumen.limiteDiarioActual
                ? `${formatoNumero(resumen.limiteDiarioActual)} al día`
                : '—'}
            </strong>
          </article>
        </div>
        <p className="admin-ayuda">
          No se calculan importes estimados porque todavía no hay registro de tokens ni una tarifa
          de proveedor configurada.
        </p>
      </div>
    </section>
  );
}

function Auditoria({ state }) {
  const paginas = Math.max(1, Math.ceil(state.auditTotal / 50));
  return (
    <section className="admin-vista activa" data-panel="auditoria">
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">TRAZABILIDAD</p>
            <h2>Acciones administrativas</h2>
          </div>
        </div>
        <form className="admin-filtros-auditoria" onSubmit={state.aplicarFiltrosAuditoria}>
          <label>
            Actividad
            <select
              className="admin-filtro"
              value={state.auditFilters.categoria}
              onChange={(event) =>
                state.setAuditFilters((current) => ({ ...current, categoria: event.target.value }))
              }
            >
              <option value="">Todas</option>
              <option value="consultas">Consultas de datos</option>
              <option value="cambios">Cambios administrativos</option>
            </select>
          </label>
          <label>
            Acción
            <select
              className="admin-filtro"
              value={state.auditFilters.accion}
              onChange={(event) =>
                state.setAuditFilters((current) => ({ ...current, accion: event.target.value }))
              }
            >
              <option value="">Todas las acciones</option>
              {[
                ['clientes_consultados', 'Consulta de clientes'],
                ['solicitudes_soporte_consultadas', 'Consulta de soporte'],
                ['cliente_suspendido', 'Cuenta suspendida'],
                ['cliente_reactivado', 'Cuenta reactivada'],
                ['soporte_respondido', 'Solicitud respondida'],
                ['soporte_cerrado', 'Solicitud cerrada'],
                ['cuentas_eliminadas', 'Cuentas eliminadas'],
                ['eliminacion_programada', 'Eliminación programada'],
                ['eliminacion_cancelada', 'Eliminación cancelada'],
                ['rol_admin_actualizado', 'Rol admin actualizado'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Administrador
            <input
              className="admin-filtro"
              type="search"
              maxLength="254"
              placeholder="Buscar por correo"
              autoComplete="off"
              value={state.auditFilters.actor}
              onChange={(event) =>
                state.setAuditFilters((current) => ({ ...current, actor: event.target.value }))
              }
            />
          </label>
          <label>
            Desde
            <input
              className="admin-filtro"
              type="date"
              value={state.auditFilters.desde}
              onChange={(event) =>
                state.setAuditFilters((current) => ({ ...current, desde: event.target.value }))
              }
            />
          </label>
          <label>
            Hasta
            <input
              className="admin-filtro"
              type="date"
              value={state.auditFilters.hasta}
              onChange={(event) =>
                state.setAuditFilters((current) => ({ ...current, hasta: event.target.value }))
              }
            />
          </label>
          <div className="admin-filtros-auditoria-acciones">
            <button className="btn" type="submit">
              Aplicar filtros
            </button>
            <button
              className="btn btn-fantasma"
              type="button"
              onClick={state.limpiarFiltrosAuditoria}
            >
              Limpiar
            </button>
          </div>
        </form>
        <p className="admin-auditoria-resumen" aria-live="polite">
          Se encontraron {formatoNumero(state.auditTotal)} eventos.
        </p>
        <div className="admin-auditoria-lista">
          {state.auditEvents.length === 0 ? (
            <p className="admin-vacio">
              {state.auditTotal
                ? 'No hay eventos en esta página.'
                : 'No hay eventos que coincidan con estos filtros.'}
            </p>
          ) : (
            state.auditEvents.map((event) => {
              const consulta = ['clientes_consultados', 'solicitudes_soporte_consultadas'].includes(
                event.accion,
              );
              return (
                <article className="admin-auditoria-evento" key={event.id}>
                  <div className="admin-auditoria-identidad">
                    <strong>{event.accion.replaceAll('_', ' ')}</strong>
                    <small
                      className={`admin-auditoria-categoria ${consulta ? 'consulta' : 'cambio'}`}
                    >
                      {consulta ? 'Consulta de datos' : 'Cambio administrativo'}
                    </small>
                  </div>
                  <span>
                    {event.actor_correo} · {event.objetivo_tipo}
                    {event.objetivo_id ? ` #${event.objetivo_id}` : ''}
                  </span>
                  <time dateTime={event.creado_en}>{formatoFecha(event.creado_en, true)}</time>
                </article>
              );
            })
          )}
        </div>
        <Paginacion
          offset={state.auditOffset}
          total={state.auditTotal}
          limite={50}
          etiqueta
          onAnterior={() =>
            state
              .cargarAuditoria(Math.max(0, state.auditOffset - 50))
              .catch((error) => state.notificar(error.message, true))
          }
          onSiguiente={() =>
            state
              .cargarAuditoria(Math.min(state.auditOffset + 50, (paginas - 1) * 50))
              .catch((error) => state.notificar(error.message, true))
          }
        />
      </div>
    </section>
  );
}

function Soporte({ state }) {
  return (
    <section className="admin-vista activa" data-panel="soporte">
      <div className="admin-panel">
        <div className="admin-panel-titulo">
          <div>
            <p className="admin-eyebrow">ATENCIÓN A CLIENTES</p>
            <h2>Solicitudes de soporte y privacidad</h2>
          </div>
          <select
            className="admin-filtro"
            value={state.supportFilter}
            onChange={(event) => {
              state.setSupportFilter(event.target.value);
              state
                .cargarSoporte(event.target.value)
                .catch((error) => state.notificar(error.message, true));
            }}
          >
            <option value="">Todas</option>
            <option value="abierta">Abiertas</option>
            <option value="respondida">Respondidas</option>
            <option value="cerrada">Cerradas</option>
          </select>
        </div>
        <div className="admin-soporte-lista">
          {state.supportLoading ? (
            <p className="admin-vacio">Cargando solicitudes…</p>
          ) : state.supportRequests.length === 0 ? (
            <p className="admin-vacio">No hay solicitudes en esta vista.</p>
          ) : (
            state.supportRequests.map((request) => {
              const categoria =
                { general: 'Ayuda general', privacidad: 'Privacidad', facturacion: 'Facturación' }[
                  request.categoria
                ] || request.categoria;
              return (
                <article className="admin-soporte-tarjeta" key={request.id}>
                  <div className="admin-soporte-encabezado">
                    <div>
                      <h3>{request.asunto}</h3>
                      <p>
                        {request.usuario_nombre} · {request.usuario_correo} · {categoria} ·{' '}
                        {formatoFecha(request.creada_en)}
                      </p>
                    </div>
                    <span className={`admin-soporte-estado ${request.estado}`}>
                      {{ abierta: 'Abierta', respondida: 'Respondida', cerrada: 'Cerrada' }[
                        request.estado
                      ] || request.estado}
                    </span>
                  </div>
                  <p className="admin-soporte-mensaje">{request.mensaje}</p>
                  {request.respuesta && (
                    <p className="admin-soporte-respuesta-previa">
                      Respuesta enviada: {request.respuesta}
                    </p>
                  )}
                  {request.estado !== 'cerrada' && (
                    <form
                      className="admin-soporte-responder"
                      onSubmit={(event) => {
                        event.preventDefault();
                        state.actualizarSolicitudSoporte(request, 'respondida');
                      }}
                    >
                      <textarea
                        maxLength="4000"
                        rows="3"
                        placeholder="Respuesta para el cliente"
                        value={state.supportResponses[request.id] || ''}
                        onChange={(event) =>
                          state.cambiarRespuestaSoporte(request.id, event.target.value)
                        }
                      />
                      <button
                        className="btn"
                        type="submit"
                        disabled={state.actionBusy[`support-${request.id}`]}
                      >
                        Responder
                      </button>
                      <button
                        className="btn btn-fantasma"
                        type="button"
                        disabled={state.actionBusy[`support-${request.id}`]}
                        onClick={() => state.actualizarSolicitudSoporte(request, 'cerrada')}
                      >
                        Cerrar solicitud
                      </button>
                    </form>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function Facturacion({ state }) {
  return (
    <section className="admin-vista activa" data-panel="facturacion">
      <div className="admin-panel admin-facturacion-vacia">
        <span className="admin-facturacion-icono" aria-hidden="true">
          ◇
        </span>
        <p className="admin-eyebrow">PREPARADO PARA CRECER</p>
        <h2>Planes y facturación</h2>
        <p>
          Codexia todavía no tiene un proveedor de pagos conectado. Antes de cobrar, aquí podrás
          configurar planes, renovaciones, cancelaciones, facturas y reembolsos con datos reales del
          proveedor.
        </p>
        <div className="admin-plan-actual">
          <span>Configuración actual</span>
          <strong>Acceso sin cobro integrado</strong>
          <small>
            Límite diario: {formatoNumero(state.summary?.limiteDiarioActual)} mensajes por cliente
          </small>
        </div>
        <p className="admin-ayuda">
          No se muestran suscripciones ni pagos ficticios. La integración requiere elegir un
          proveedor y configurar sus credenciales de forma segura en el servidor.
        </p>
      </div>
    </section>
  );
}

function ModalEliminacion({ state }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (state.deleteModal && !dialogRef.current.open) {
      dialogRef.current.showModal();
      window.requestAnimationFrame(() => dialogRef.current?.querySelector('input')?.focus());
    }
    if (!state.deleteModal && dialogRef.current.open) dialogRef.current.close();
  }, [state.deleteModal]);
  const esVerificacion = state.deleteStep === 'verificacion';
  const seleccion = state.deleteModal || [];
  const cuenta =
    seleccion.length === 1
      ? `${seleccion[0].nombre} (${seleccion[0].correo})`
      : `${seleccion.length} cuentas de cliente`;
  const setCampo = (nombre, valor) =>
    state.setDeleteFields((current) => ({ ...current, [nombre]: valor }));
  return (
    <dialog
      ref={dialogRef}
      className="admin-modal-eliminacion"
      aria-labelledby="modal-eliminar-admin-titulo"
      onClose={() => {
        if (state.deleteModal) state.cerrarModalEliminacion();
      }}
    >
      <form
        className="admin-modal-eliminacion-contenido"
        noValidate
        onSubmit={state.confirmarEliminacion}
      >
        <button
          className="admin-modal-cerrar"
          type="button"
          aria-label="Cerrar"
          onClick={state.cerrarModalEliminacion}
        >
          ×
        </button>
        <p className="admin-eyebrow">ELIMINACIÓN DE CUENTA</p>
        <h2 id="modal-eliminar-admin-titulo">
          {esVerificacion ? 'Verifica tu identidad' : 'Detalles y plazo'}
        </h2>
        <p className="admin-modal-descripcion">
          Se eliminará: {cuenta}. La contraseña se verificará antes de continuar.
        </p>
        {esVerificacion ? (
          <section className="admin-eliminacion-paso">
            <label htmlFor="eliminacion-password">Contraseña admin</label>
            <input
              id="eliminacion-password"
              type="password"
              autoComplete="current-password"
              maxLength="1024"
              required
              value={state.deleteFields.password}
              onChange={(event) => setCampo('password', event.target.value)}
            />
            <p className="admin-eliminacion-error" role="alert">
              {state.deleteError}
            </p>
            <button
              className="btn"
              type="button"
              disabled={state.deleteBusy}
              onClick={state.verificarPassword}
            >
              {state.deleteBusy ? (
                'Verificando…'
              ) : (
                <>
                  Continuar <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </section>
        ) : (
          <section className="admin-eliminacion-paso">
            <label htmlFor="eliminacion-motivo">Motivo breve (se mostrará al cliente)</label>
            <input
              id="eliminacion-motivo"
              type="text"
              maxLength="500"
              required
              value={state.deleteFields.motivo}
              onChange={(event) => setCampo('motivo', event.target.value)}
            />
            <label htmlFor="eliminacion-detalles">
              Detalles de la eliminación (visibles al cliente)
            </label>
            <textarea
              id="eliminacion-detalles"
              rows="5"
              minLength="20"
              maxLength="8000"
              required
              value={state.deleteFields.detalles}
              onChange={(event) => setCampo('detalles', event.target.value)}
            />
            <label htmlFor="eliminacion-plazo">Cuándo eliminar</label>
            <select
              id="eliminacion-plazo"
              value={state.deleteFields.demoraHoras}
              onChange={(event) => setCampo('demoraHoras', event.target.value)}
            >
              <option value="0">Inmediatamente</option>
              <option value="1">En 1 hora</option>
              <option value="12">En 12 horas</option>
              <option value="24">En 24 horas</option>
              <option value="72">En 72 horas</option>
            </select>
            <p className="admin-eliminacion-error" role="alert">
              {state.deleteError}
            </p>
            <div className="admin-modal-acciones">
              <button
                className="btn btn-fantasma"
                type="button"
                onClick={state.volverVerificacionEliminacion}
              >
                Volver
              </button>
              <button
                className="btn admin-boton-destructivo"
                type="submit"
                disabled={state.deleteBusy}
              >
                {state.deleteBusy
                  ? 'Procesando…'
                  : Number(state.deleteFields.demoraHoras) === 0
                    ? 'Eliminar inmediatamente'
                    : 'Programar eliminación'}
              </button>
            </div>
          </section>
        )}
      </form>
    </dialog>
  );
}

function Admin() {
  const state = useAdmin();
  const titulo = state.titulos[state.view] || 'Resumen';
  const panels = {
    resumen: <Resumen state={state} />,
    clientes: <Clientes state={state} />,
    eliminaciones: <Eliminaciones state={state} />,
    uso: <Uso state={state} />,
    auditoria: <Auditoria state={state} />,
    soporte: <Soporte state={state} />,
    facturacion: <Facturacion state={state} />,
    roles: <Roles state={state} />,
  };
  const navegar = (vista) => state.cargarVista(vista);
  return (
    <>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <a className="admin-marca" href="../../index.html">
            <span aria-hidden="true">✦</span> Codexia <small>ADMIN</small>
          </a>
          <nav className="admin-nav" aria-label="Administración">
            {[
              ['resumen', '◫', 'Resumen'],
              ['clientes', '♙', 'Clientes'],
              ['eliminaciones', '⌫', 'Eliminaciones'],
              ['uso', '◷', 'Uso y costos'],
              ['soporte', '✉', 'Soporte'],
              ['auditoria', '⌁', 'Seguridad y auditoría'],
              ['facturacion', '＄', 'Planes y facturación'],
              ...(state.admin?.rol === 'superadmin' ? [['roles', '♙', 'Administrar roles']] : []),
            ].map(([view, icon, label]) => (
              <button
                key={view}
                className={`admin-nav-item${state.view === view ? ' activo' : ''}`}
                type="button"
                aria-current={state.view === view ? 'page' : undefined}
                onClick={() => navegar(view)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-pie">
            <a href="../asistente.ia/index.html">
              Volver a Codexia <span aria-hidden="true">↗</span>
            </a>
            <span>{state.admin?.nombre || 'Cuenta admin'}</span>
          </div>
        </aside>
        <main className="admin-main">
          <header className="admin-topbar">
            <div>
              <p className="admin-eyebrow">CENTRO DE OPERACIONES</p>
              <h1>{titulo}</h1>
            </div>
            <button className="btn btn-fantasma" type="button" onClick={state.actualizarTodo}>
              Actualizar datos
            </button>
          </header>
          <p
            className={`admin-mensaje${state.messageError ? ' error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {state.message}
          </p>
          <div
            className={`admin-notificacion${state.notification ? ' visible' : ''}${state.notification?.error ? ' error' : ''}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {state.notification?.texto || ''}
          </div>
          {panels[state.view]}
        </main>
      </div>
      <ModalEliminacion state={state} />
    </>
  );
}

export default Admin;
