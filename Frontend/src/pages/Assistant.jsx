import React, { useEffect, useRef, useState } from 'react';
import '../../css/base.css';
import '../../css/asistente.css';
import AssistantMessage from '../components/assistant/AssistantMessage.jsx';
import ConversationRow from '../components/assistant/ConversationRow.jsx';
import { useAssistant } from '../hooks/useAssistant.js';

function ActionDialog({ modal, busy, error, onConfirm, onClose, onError }) {
  const dialogRef = useRef(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(modal?.valor || '');
    onError('');
  }, [modal, onError]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  if (!modal) return <dialog ref={dialogRef} className="modal-conversacion" />;

  return (
    <dialog
      ref={dialogRef}
      className="modal-conversacion"
      aria-labelledby="modal-conversacion-titulo"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <form
        className="modal-conversacion-contenido"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (modal.etiqueta && !value.trim()) {
            onError('Escribe un valor antes de continuar.');
            return;
          }
          onConfirm(value.trim());
        }}
      >
        <h2 id="modal-conversacion-titulo">{modal.titulo}</h2>
        <p>{modal.mensaje}</p>
        {modal.etiqueta && (
          <>
            <label htmlFor="modal-conversacion-entrada">{modal.etiqueta}</label>
            <input
              id="modal-conversacion-entrada"
              className="modal-conversacion-entrada"
              type={modal.password ? 'password' : 'text'}
              autoComplete={modal.password ? 'current-password' : 'off'}
              maxLength={modal.maxLength || 120}
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
            />
          </>
        )}
        {error && (
          <p className="modal-conversacion-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-conversacion-acciones">
          <button className="btn btn-fantasma" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className={`btn${modal.peligro ? ' modal-boton-peligro' : ''}`}
            type="submit"
            disabled={busy}
          >
            {busy ? 'Procesando…' : modal.textoConfirmar || 'Aceptar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Assistant() {
  const app = useAssistant();
  const [infoChatVisible, setInfoChatVisible] = useState(false);
  const infoChat =
    window.matchMedia('(min-width: 701px)').matches && app.historyHidden && app.view === 'chat';

  useEffect(() => {
    setInfoChatVisible(infoChat);
  }, [infoChat]);

  function abrirChatDesdeMenu() {
    if (app.view !== 'chat') {
      app.cambiarVista('chat');
      if (window.matchMedia('(min-width: 701px)').matches && app.historyHidden) {
        app.setHistoryHidden(false);
      }
      return;
    }
    if (window.matchMedia('(min-width: 701px)').matches && app.historyHidden) {
      app.setHistoryHidden(false);
    }
  }

  function cerrarDialogo() {
    app.setModal(null);
  }

  if (app.pilotEnded) {
    return (
      <main className="piloto-finalizado">
        <span className="asistente-marca-icono" aria-hidden="true">
          ✦
        </span>
        <h1>Gracias por realizar las pruebas de Codexia</h1>
        <p>
          El acceso terminó. Codexia eliminará automáticamente tu cuenta y los datos guardados aquí.
          Groq puede conservar registros limitados de inferencia hasta 30 días, según su
          configuración.
        </p>
        <a href="../legal/privacidad.html" target="_blank" rel="noopener noreferrer">
          Ver política de privacidad
        </a>
        <a href="../../index.html">Volver al inicio</a>
      </main>
    );
  }

  return (
    <>
      <main className="asistente-shell" aria-busy={app.loading}>
        <header className="chat-encabezado">
          <div className="chat-nav">
            <button
              className="btn btn-fantasma btn-menu"
              type="button"
              aria-expanded={!app.historyHidden}
              aria-controls="historial-conversaciones"
              aria-label={app.historyHidden ? 'Mostrar conversaciones' : 'Ocultar conversaciones'}
              onClick={app.toggleHistory}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <a className="asistente-marca" href="../../index.html" aria-label="Volver al inicio">
              <span className="asistente-marca-icono" aria-hidden="true">
                ✦
              </span>
              <span>Codexia</span>
            </a>
          </div>
          <div className="chat-cuenta">
            <p>
              Hola, <span>{app.user?.nombre || ''}</span>
            </p>
            <button className="btn btn-fantasma" type="button" onClick={app.cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div
          className={`asistente-layout${app.historyHidden ? ' historial-oculto' : ''}${app.view !== 'chat' ? ' mostrando-cuenta' : ''}`}
          onClick={(event) => {
            if (!event.target.closest('.conversacion-fila')) app.setMenuConversacion(null);
            if (!event.target.closest('.acciones-pagina-cuenta')) app.setAccountMenuOpen(false);
          }}
        >
          <nav className="barra-lateral" aria-label="Secciones principales">
            <button
              className={`navegacion-lateral-boton${app.view === 'chat' ? ' activo' : ''}`}
              type="button"
              aria-label="Conversaciones"
              aria-current={app.view === 'chat' ? 'page' : undefined}
              title="Conversaciones"
              onClick={abrirChatDesdeMenu}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6" />
              </svg>
            </button>
            <button
              className={`navegacion-lateral-boton${app.view === 'cuenta' ? ' activo' : ''}`}
              type="button"
              aria-label="Cuenta"
              aria-current={app.view === 'cuenta' ? 'page' : undefined}
              title="Cuenta"
              onClick={() => app.cambiarVista('cuenta')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
              </svg>
            </button>
            <button
              className={`navegacion-lateral-boton${app.view === 'soporte' ? ' activo' : ''}`}
              type="button"
              aria-label="Ayuda y privacidad"
              aria-current={app.view === 'soporte' ? 'page' : undefined}
              title="Ayuda y privacidad"
              onClick={() => app.cambiarVista('soporte')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
                <rect x="3" y="12" width="4" height="7" rx="2" />
                <rect x="17" y="12" width="4" height="7" rx="2" />
                <path d="M12 6.5 13 9l2.5 1-2.5 1-1 2.5L11 11l-2.5-1L11 9l1-2.5Z" />
              </svg>
            </button>
            {app.user?.rol === 'admin' && (
              <a
                className="navegacion-lateral-boton enlace-admin"
                href="../admin/index.html"
                aria-label="Administración"
                title="Administración"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                  <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" />
                </svg>
              </a>
            )}
          </nav>

          <div className="asistente-tarjeta">
            {!app.historyHidden && window.matchMedia('(max-width: 700px)').matches && (
              <button
                className="cerrar-historial-fondo"
                type="button"
                aria-label="Cerrar conversaciones"
                onClick={() => app.setHistoryHidden(true)}
              />
            )}

            <nav
              id="historial-conversaciones"
              className="historial-conversaciones"
              aria-label="Mis conversaciones"
              inert={app.historyHidden || app.view !== 'chat'}
            >
              <div id="vista-conversaciones">
                <button
                  className="btn btn-nueva"
                  type="button"
                  disabled={app.loading || app.sending}
                  onClick={app.crearNuevaConversacion}
                >
                  ＋ <span>Nueva conversación</span>
                </button>

                {(Boolean(app.conversacionesFijadas.length) || app.closingPinned) && (
                  <section
                    className={`grupo-conversaciones grupo-fijadas${app.closingPinned ? ' recogiendo' : ''}`}
                    aria-label="Conversaciones fijadas"
                  >
                    <div className="historial-encabezado">
                      <h2>
                        <span aria-hidden="true">📌</span> Fijadas
                      </h2>
                    </div>
                    <div className="lista-conversaciones lista-fijadas">
                      {app.conversacionesFijadas.map((conversation) => (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          active={conversation.id === app.conversationId}
                          rowAnimation={app.animatingRows[conversation.id]}
                          menuOpen={app.menuConversacion === conversation.id}
                          onToggleMenu={app.setMenuConversacion}
                          onOpen={app.abrirConversacion}
                          onRename={app.renombrarConversacion}
                          onPin={app.fijarConversacion}
                          onDelete={app.borrarConversacion}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section
                  className="grupo-conversaciones grupo-recientes"
                  aria-label="Conversaciones recientes"
                >
                  <div className="historial-encabezado">
                    <h2>Recientes</h2>
                  </div>
                  <div className="lista-conversaciones">
                    {app.conversacionesRecientes.map((conversation) => (
                      <ConversationRow
                        key={conversation.id}
                        conversation={conversation}
                        active={conversation.id === app.conversationId}
                        rowAnimation={app.animatingRows[conversation.id]}
                        menuOpen={app.menuConversacion === conversation.id}
                        onToggleMenu={app.setMenuConversacion}
                        onOpen={app.abrirConversacion}
                        onRename={app.renombrarConversacion}
                        onPin={app.fijarConversacion}
                        onDelete={app.borrarConversacion}
                      />
                    ))}
                    {!app.loading && !app.conversations.length && (
                      <p>Tus conversaciones aparecerán aquí.</p>
                    )}
                  </div>
                </section>

                <div className="cuota-panel">
                  <p className="cuota-titulo">Uso de hoy</p>
                  <p className="cuota-diaria" aria-live="polite">
                    {app.quota.usado} / {app.quota.limite}
                  </p>
                  <div
                    className="cuota-barra"
                    role="progressbar"
                    aria-label="Uso diario del asistente"
                    aria-valuenow={app.quota.usado}
                    aria-valuemin="0"
                    aria-valuemax={app.quota.limite}
                  >
                    <span
                      style={{
                        width: `${app.quota.limite ? (app.quota.usado / app.quota.limite) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="cuota-ayuda">Límite diario de mensajes</p>
                </div>
              </div>
            </nav>

            {infoChat && (
              <aside
                className={`panel-chat-vacio${infoChatVisible ? ' entrando' : ''}`}
                aria-label="Información del chat"
              >
                <h2>{app.currentConversation?.titulo || 'Nueva conversación'}</h2>
                <div className="panel-chat-cuota">
                  <strong>
                    {app.quota.usado} / {app.quota.limite}
                  </strong>
                  <span>Mensajes de hoy</span>
                </div>
              </aside>
            )}

            <section
              className={`chat-seccion${app.viewTransition === 'chat' ? ' vista-encendiendose' : ''}${app.leavingView === 'chat' ? ' vista-apagandose' : ''}`}
              aria-label="Chat con el asistente"
              hidden={app.view !== 'chat' && app.leavingView !== 'chat'}
              inert={app.view !== 'chat'}
            >
              <div className="chat-bienvenida">
                <p className="chat-etiqueta">ASISTENTE PERSONAL</p>
                <h1>¿Qué tienes en mente?</h1>
                <p>Estoy aquí para ayudarte a pensar, crear y resolver.</p>
              </div>
              <div
                ref={app.chatRef}
                className={`chat${app.chatScrollActive ? ' chat-scroll-activa' : ''}`}
                role="log"
                aria-label="Mensajes de la conversación"
                aria-live="polite"
                aria-relevant="additions text"
                tabIndex="0"
                onWheel={app.mostrarBarraDesplazamiento}
                onTouchStart={app.mostrarBarraDesplazamiento}
                onKeyDown={app.handleChatKey}
              >
                {app.messages.map((message) => (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    onRetry={() => app.reintentarMensaje(message.retryData)}
                  />
                ))}
              </div>
              <form
                className="entrada"
                onSubmit={(event) => {
                  event.preventDefault();
                  app.enviarMensaje();
                }}
              >
                <label className="texto-oculto" htmlFor="mensaje">
                  Tu mensaje para la asistente
                </label>
                <input
                  ref={app.inputRef}
                  type="text"
                  id="mensaje"
                  placeholder="Escribe tu mensaje…"
                  maxLength="4000"
                  autoComplete="off"
                  value={app.input}
                  disabled={app.sending || app.loading}
                  onChange={(event) => app.setInput(event.target.value)}
                  onKeyDown={app.handleSendKey}
                />
                {app.input.trim() && (
                  <button
                    className="btn"
                    type="submit"
                    aria-label="Enviar mensaje"
                    disabled={app.sending}
                  >
                    →
                  </button>
                )}
              </form>
              <p className="chat-aviso">
                Prueba piloto: tus mensajes y hasta 20 mensajes previos se envían a Groq y se
                guardan en Codexia. No incluyas datos sensibles ni información de otras personas. El
                asistente puede equivocarse; verifica la información importante.{' '}
                <a href="../legal/privacidad.html" target="_blank" rel="noopener noreferrer">
                  Privacidad
                </a>
                .
              </p>
            </section>

            <section
              className={`pagina-cuenta${app.viewTransition === 'cuenta' ? ' vista-encendiendose' : ''}${app.leavingView === 'cuenta' ? ' vista-apagandose' : ''}${app.chatScrollActive ? ' chat-scroll-activa' : ''}`}
              aria-label="Información de la cuenta"
              hidden={app.view !== 'cuenta' && app.leavingView !== 'cuenta'}
              inert={app.view !== 'cuenta'}
              onWheel={app.mostrarBarraDesplazamiento}
              onTouchStart={app.mostrarBarraDesplazamiento}
              onScroll={app.mostrarBarraDesplazamiento}
            >
              <div className="pagina-cuenta-contenido">
                <div className="acciones-pagina-cuenta">
                  <button
                    className="icono-editar-cuenta"
                    type="button"
                    aria-label="Editar cuenta"
                    aria-expanded={app.accountMenuOpen}
                    onClick={() => app.setAccountMenuOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m14 5 5 5M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" />
                    </svg>
                  </button>
                  {app.accountMenuOpen && (
                    <div className="opciones-editar-cuenta">
                      <button
                        className="btn btn-fantasma"
                        type="button"
                        onClick={app.cambiarNombre}
                      >
                        Cambiar nombre
                      </button>
                    </div>
                  )}
                </div>
                <p className="chat-etiqueta">PERFIL</p>
                <header className="perfil-cuenta">
                  <div className="avatar-cuenta" aria-hidden="true">
                    {app.user?.nombre?.trim().charAt(0).toLocaleUpperCase('es') || 'C'}
                  </div>
                  <div>
                    <h1>{app.user?.nombre || ''}</h1>
                    <p>{app.user?.correo || ''}</p>
                  </div>
                </header>
                <section className="resumen-cuenta" aria-labelledby="resumen-cuenta-titulo">
                  <h2 id="resumen-cuenta-titulo">Uso del asistente</h2>
                  <div className="estadisticas-cuenta">
                    <div>
                      <strong>
                        {app.accountTotal === null
                          ? '—'
                          : new Intl.NumberFormat('es-CO').format(app.accountTotal)}
                      </strong>
                      <span>Mensajes enviados desde que creaste tu cuenta</span>
                    </div>
                    <div>
                      <strong>{app.quota.limite}</strong>
                      <span>Límite diario</span>
                    </div>
                    <div>
                      <strong>{app.quota.restante}</strong>
                      <span>Mensajes disponibles</span>
                    </div>
                  </div>
                  {app.accountError && (
                    <p className="estado-total-mensajes" role="status">
                      {app.accountError}
                    </p>
                  )}
                </section>
                {app.scheduledDeletion && (
                  <aside className="aviso-eliminacion-programada" aria-live="polite">
                    <span className="aviso-eliminacion-icono" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <strong>Tu cuenta tiene una eliminación programada</strong>
                      <p>
                        {app.scheduledDeletion.motivo} {app.scheduledDeletion.detalles}
                      </p>
                      <p>
                        Tu acceso seguirá disponible hasta que se cumpla el plazo. Si tienes dudas,
                        contacta con soporte.
                      </p>
                      <time>
                        Eliminación prevista:{' '}
                        {new Intl.DateTimeFormat('es-CO', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        }).format(new Date(app.scheduledDeletion.eliminar_en))}
                        .
                      </time>
                    </div>
                  </aside>
                )}
                <section className="seguridad-cuenta" aria-labelledby="seguridad-cuenta-titulo">
                  <div>
                    <h2 id="seguridad-cuenta-titulo">Seguridad de la cuenta</h2>
                    <p>
                      Si ya no quieres usar Codexia, puedes eliminar tu perfil y sus datos
                      guardados.
                    </p>
                  </div>
                  <div className="cuenta-zona-peligro">
                    <h3>Conversaciones</h3>
                    <p>Elimina todas las conversaciones y sus mensajes guardados.</p>
                    <button
                      className="btn btn-eliminar-cuenta"
                      type="button"
                      onClick={app.borrarTodasConversaciones}
                    >
                      Borrar todas las conversaciones
                    </button>
                    <div className="separador-zona-peligro" aria-hidden="true"></div>
                    <h3>Eliminar cuenta</h3>
                    <p>Se borrarán tu cuenta y todas tus conversaciones de forma permanente.</p>
                    <button
                      className="btn btn-eliminar-cuenta"
                      type="button"
                      onClick={app.eliminarCuenta}
                    >
                      Eliminar mi cuenta
                    </button>
                  </div>
                </section>
              </div>
            </section>

            <section
              className={`pagina-cuenta pagina-soporte${app.viewTransition === 'soporte' ? ' vista-encendiendose' : ''}${app.leavingView === 'soporte' ? ' vista-apagandose' : ''}`}
              aria-label="Ayuda y privacidad"
              hidden={app.view !== 'soporte' && app.leavingView !== 'soporte'}
              inert={app.view !== 'soporte'}
            >
              <div className="pagina-cuenta-contenido">
                <p className="chat-etiqueta">ATENCIÓN AL CLIENTE</p>
                <header className="encabezado-soporte">
                  <div className="icono-soporte-espacial" aria-hidden="true">
                    ✦
                  </div>
                  <div>
                    <h1 id="soporte-cuenta-titulo">¿En qué podemos ayudarte?</h1>
                    <p>
                      Cuéntanos qué necesitas. También puedes enviar solicitudes sobre tu privacidad
                      y tus datos.
                    </p>
                  </div>
                </header>
                <section className="soporte-cuenta" aria-labelledby="soporte-cuenta-titulo">
                  <div>
                    <h2>Enviar una solicitud</h2>
                    <p>No incluyas contraseñas ni información sensible.</p>
                  </div>
                  <form className="formulario-soporte-cuenta" onSubmit={app.enviarSolicitudSoporte}>
                    <label htmlFor="soporte-categoria">Tema</label>
                    <select
                      id="soporte-categoria"
                      name="categoria"
                      value={app.supportForm.categoria}
                      onChange={(event) =>
                        app.setSupportForm((form) => ({ ...form, categoria: event.target.value }))
                      }
                    >
                      <option value="general">Ayuda general</option>
                      <option value="privacidad">Privacidad y datos</option>
                      <option value="facturacion">Planes y facturación</option>
                    </select>
                    <label htmlFor="soporte-asunto">Asunto</label>
                    <input
                      id="soporte-asunto"
                      name="asunto"
                      maxLength="120"
                      required
                      value={app.supportForm.asunto}
                      onChange={(event) =>
                        app.setSupportForm((form) => ({ ...form, asunto: event.target.value }))
                      }
                    />
                    <label htmlFor="soporte-mensaje">Mensaje</label>
                    <textarea
                      id="soporte-mensaje"
                      name="mensaje"
                      maxLength="4000"
                      rows="4"
                      required
                      value={app.supportForm.mensaje}
                      onChange={(event) =>
                        app.setSupportForm((form) => ({ ...form, mensaje: event.target.value }))
                      }
                    />
                    <label className="soporte-consentimiento" htmlFor="soporte-acepta-privacidad">
                      <input
                        id="soporte-acepta-privacidad"
                        name="aceptaPrivacidadSoporte"
                        type="checkbox"
                        checked={app.supportForm.aceptaPrivacidadSoporte}
                        required
                        onChange={(event) =>
                          app.setSupportForm((form) => ({
                            ...form,
                            aceptaPrivacidadSoporte: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        Autorizo el tratamiento del contenido de esta solicitud según la{' '}
                        <a
                          href="../legal/privacidad.html"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Política de privacidad
                        </a>
                        .
                      </span>
                    </label>
                    <button className="btn" type="submit" disabled={app.supportBusy}>
                      {app.supportBusy ? 'Enviando solicitud…' : 'Enviar solicitud'}
                    </button>
                    <p className="soporte-estado" role="status" aria-live="polite">
                      {app.supportStatus}
                    </p>
                  </form>
                  <div className="soporte-solicitudes" aria-live="polite">
                    {app.supportRequests.map((request) => (
                      <article className="soporte-solicitud" key={request.id}>
                        <strong>{request.asunto}</strong>
                        <span>
                          {{ abierta: 'Abierta', respondida: 'Respondida', cerrada: 'Cerrada' }[
                            request.estado
                          ] || request.estado}
                        </span>
                        <p>{request.mensaje}</p>
                        {request.respuesta && (
                          <p className="soporte-respuesta">
                            Respuesta de Codexia: {request.respuesta}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </main>

      <div
        className={`notificacion-conversacion${app.notice ? ' visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {app.notice}
      </div>
      <ActionDialog
        modal={app.modal}
        busy={app.modalBusy}
        error={app.modalError}
        onConfirm={app.confirmarModal}
        onClose={cerrarDialogo}
        onError={app.setModalError}
      />
    </>
  );
}

export default Assistant;
