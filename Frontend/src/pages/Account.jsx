import React from 'react';
import '../../css/base.css';
import '../../css/cuenta.css';
import { useAccount } from '../hooks/useAccount.js';

function Account() {
  const {
    registroActivo,
    mensaje,
    errorLogin,
    notificacion,
    intentoConsentimiento,
    consentimientos,
    cuentaEliminada,
    bloqueoHasta,
    segundosRestantes,
    enviando,
    passwordRegistro,
    passwordIntentada,
    requisitosPassword,
    passwordValida,
    verificacionModalAbierta,
    registroPendiente,
    correoVerificacion,
    codigoVerificacion,
    mensajeVerificacion,
    segundosReenvio,
    bloqueoActivo,
    formatoTiempoRestante,
    mostrarAvisoConsentimiento,
    cambiarPestana,
    enviar,
    enviarLogin,
    enviarRegistro,
    abrirVerificacion,
    enviarCodigoVerificacion,
    reenviarCodigoVerificacion,
    cerrarVerificacion,
    actualizarDigitoCodigo,
    manejarTeclaCodigo,
    cambiarConsentimiento,
    cuentaConsentimiento,
    claseConsentimiento,
    setErrorLogin,
    setMensaje,
    setPasswordRegistro,
  } = useAccount();
  return (
    <main className="cuenta-panel">
      <section
        className="cuenta-acceso"
        aria-label="Acceso a Codexia"
        aria-hidden={verificacionModalAbierta}
        inert={verificacionModalAbierta}
      >
        <a
          className="cuenta-marca"
          href="../../index.html"
          aria-label="Volver al inicio de Codexia"
        >
          <span className="cuenta-marca-icono" aria-hidden="true">
            ✦
          </span>
          <span>Codexia</span>
        </a>
        <div className="cuenta-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="8" r="3.2"></circle>
            <path d="M5.7 19c.6-3.1 2.9-4.8 6.3-4.8s5.7 1.7 6.3 4.8"></path>
          </svg>
        </div>
        <p className="cuenta-eyebrow">Tu espacio de ideas</p>
        <h1>Qué bueno verte.</h1>
        <p className="cuenta-intro">Inicia sesión para continuar tus conversaciones.</p>

        <div className="cuenta-pestanas" role="tablist" aria-label="Acceso a tu cuenta">
          <button
            type="button"
            className={`cuenta-pestana${registroActivo ? '' : ' activa'}`}
            id="pestana-login"
            role="tab"
            aria-selected={!registroActivo}
            onClick={() => cambiarPestana(false)}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`cuenta-pestana${registroActivo ? ' activa' : ''}`}
            id="pestana-registro"
            role="tab"
            aria-selected={registroActivo}
            onClick={() => cambiarPestana(true)}
          >
            Crear cuenta
          </button>
        </div>

        <form
          id="form-login"
          className="cuenta-form"
          onSubmit={enviarLogin}
          hidden={registroActivo}
        >
          <label className={errorLogin ? 'cuenta-label-invalida' : ''} htmlFor="login-correo">
            Correo electrónico
          </label>
          <input
            id="login-correo"
            name="correo"
            type="email"
            autoComplete="email"
            maxLength="255"
            required
            disabled={bloqueoActivo || enviando}
            className={errorLogin ? 'cuenta-entrada-invalida' : ''}
            aria-invalid={errorLogin}
            aria-describedby={errorLogin ? 'login-error-text' : undefined}
            onChange={() => {
              setErrorLogin(false);
              setMensaje('');
            }}
          />
          <label className={errorLogin ? 'cuenta-label-invalida' : ''} htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength="1024"
            required
            disabled={bloqueoActivo || enviando}
            className={errorLogin ? 'cuenta-entrada-invalida' : ''}
            aria-invalid={errorLogin}
            aria-describedby={errorLogin ? 'login-error-text' : undefined}
            onChange={() => {
              setErrorLogin(false);
              setMensaje('');
            }}
          />
          {errorLogin && (
            <p id="login-error-text" className="cuenta-error-campo" role="alert">
              Correo o contraseña equivocado.
            </p>
          )}
          <button
            className={`btn${enviando ? ' btn-cargando' : ''}`}
            type="submit"
            disabled={bloqueoActivo || enviando}
          >
            {enviando
              ? 'Iniciando sesión…'
              : bloqueoActivo
                ? `Espera ${formatoTiempoRestante(segundosRestantes)}`
                : 'Entrar a Codexia'}{' '}
            {!bloqueoActivo && !enviando && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <form
          id="form-registro"
          className="cuenta-form"
          onSubmit={enviarRegistro}
          hidden={!registroActivo}
          noValidate
        >
          <label htmlFor="registro-nombre">Nombre</label>
          <input
            id="registro-nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            maxLength="100"
            required
            disabled={enviando}
          />
          <label htmlFor="registro-correo">Correo electrónico</label>
          <input
            id="registro-correo"
            name="correo"
            type="email"
            autoComplete="email"
            maxLength="255"
            required
            disabled={enviando}
          />
          <label htmlFor="registro-password">Contraseña</label>
          <input
            id="registro-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength="8"
            maxLength="1024"
            required
            disabled={enviando}
            value={passwordRegistro}
            aria-describedby="registro-password-ayuda"
            aria-invalid={passwordIntentada && !passwordValida}
            onChange={(evento) => {
              setPasswordRegistro(evento.target.value);
              setMensaje('');
            }}
          />
          <div id="registro-password-ayuda" className="cuenta-password-ayuda">
            <p>Tu contraseña debe incluir:</p>
            <ul className="cuenta-password-requisitos">
              {requisitosPassword.map(({ texto, cumple }) => (
                <li key={texto} className={cumple ? 'cumplido' : ''}>
                  <span aria-hidden="true">{cumple ? '✓' : '○'}</span>
                  {texto}
                </li>
              ))}
            </ul>
            {passwordIntentada && !passwordValida && (
              <p className="cuenta-error-campo" role="alert">
                Completa los requisitos de la contraseña.
              </p>
            )}
          </div>
          <p className="cuenta-aviso-piloto">
            Prueba piloto: tus mensajes se guardan y se envían a Groq para responder. No compartas
            datos sensibles ni información de otras personas.{' '}
            <a href="../legal/privacidad.html" target="_blank" rel="noopener noreferrer">
              Cómo se usan tus datos
            </a>
            .
          </p>
          <div className="cuenta-consentimientos">
            <label className={claseConsentimiento('edad')} htmlFor="registro-edad">
              <input
                id="registro-edad"
                name="confirmaMayorEdad"
                type="checkbox"
                value="true"
                checked={consentimientos.edad}
                className={cuentaConsentimiento('edad') ? 'rechazado' : ''}
                aria-invalid={cuentaConsentimiento('edad')}
                onChange={(evento) => cambiarConsentimiento('edad', evento.target.checked)}
              />
              <span>Confirmo que tengo 18 años o más.</span>
            </label>
            <label className={claseConsentimiento('terminos')} htmlFor="registro-terminos">
              <input
                id="registro-terminos"
                name="aceptaTerminos"
                type="checkbox"
                value="true"
                checked={consentimientos.terminos}
                className={cuentaConsentimiento('terminos') ? 'rechazado' : ''}
                aria-invalid={cuentaConsentimiento('terminos')}
                onChange={(evento) => cambiarConsentimiento('terminos', evento.target.checked)}
              />
              <span>
                Acepto los{' '}
                <a href="../legal/terminos.html" target="_blank" rel="noopener noreferrer">
                  Términos y condiciones
                </a>
                .
              </span>
            </label>
            <label className={claseConsentimiento('privacidad')} htmlFor="registro-privacidad">
              <input
                id="registro-privacidad"
                name="aceptaPrivacidad"
                type="checkbox"
                value="true"
                checked={consentimientos.privacidad}
                className={cuentaConsentimiento('privacidad') ? 'rechazado' : ''}
                aria-invalid={cuentaConsentimiento('privacidad')}
                onChange={(evento) => cambiarConsentimiento('privacidad', evento.target.checked)}
              />
              <span>
                Autorizo el tratamiento de mis datos según la{' '}
                <a href="../legal/privacidad.html" target="_blank" rel="noopener noreferrer">
                  Política de privacidad
                </a>
                .
              </span>
            </label>
          </div>
          <button
            className={`btn${enviando ? ' btn-cargando' : ''}`}
            type="submit"
            disabled={enviando}
          >
            {enviando ? 'Creando cuenta…' : 'Crear cuenta y continuar'}{' '}
            {!enviando && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="cuenta-mensaje" role="status" aria-live="polite">
          {mensaje}
        </p>
        {registroPendiente && !verificacionModalAbierta && (
          <div className="cuenta-verificacion-pendiente">
            <span>Tu cuenta espera la confirmación del correo.</span>
            <button type="button" onClick={() => abrirVerificacion(correoVerificacion, 0)}>
              Continuar verificación
            </button>
          </div>
        )}
        {cuentaEliminada && (
          <section className="aviso-cuenta-eliminada" aria-live="polite">
            <h2>Esta cuenta fue eliminada</h2>
            <p className="aviso-cuenta-eliminada-motivo">{cuentaEliminada.motivo}</p>
            <p>{cuentaEliminada.detalles}</p>
            {cuentaEliminada.ejecutada_en && (
              <p className="aviso-cuenta-eliminada-fecha">
                Eliminada el{' '}
                {new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(
                  new Date(cuentaEliminada.ejecutada_en),
                )}
                .
              </p>
            )}
          </section>
        )}
        <p className="cuenta-nota">
          Tus conversaciones se guardan en tu cuenta. Hasta 30 mensajes al día.
        </p>
        <p className="cuenta-terminos">
          Consulta también nuestra <a href="../legal/cookies.html">Política de cookies</a> y{' '}
          <a href="../legal/reembolsos.html">Política de reembolsos</a>.
        </p>
      </section>

      <aside
        className="cuenta-bienvenida"
        aria-label="Bienvenida a Codexia"
        aria-hidden={verificacionModalAbierta}
        inert={verificacionModalAbierta}
      >
        <nav className="cuenta-bienvenida-menu" aria-label="Información legal">
          <a href="../legal/terminos.html">Términos y condiciones</a>
          <a href="../legal/privacidad.html">Política de privacidad</a>
        </nav>
        <div className="cuenta-bienvenida-contenido">
          <p className="cuenta-bienvenida-saludo">Piensa en grande.</p>
          <h2>
            Hola,
            <br />
            bienvenido.
          </h2>
          <p className="cuenta-bienvenida-texto">
            Un espacio para ordenar tus ideas, resolver dudas y dar forma a lo que imaginas.
          </p>
        </div>
        <div className="cuenta-bienvenida-pie">
          <span></span> Tus ideas, a un mensaje de distancia
        </div>
      </aside>
      <div
        className={`cuenta-notificacion${notificacion ? ' visible' : ''}`}
        role="alert"
        aria-live="assertive"
        aria-hidden={!notificacion}
      >
        {notificacion}
      </div>
      {verificacionModalAbierta && (
        <div className="cuenta-verificacion-overlay">
          <section
            className="cuenta-verificacion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verificacion-titulo"
            aria-describedby="verificacion-descripcion"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') {
                cerrarVerificacion();
                return;
              }
              if (evento.key !== 'Tab') return;

              const elementos = evento.currentTarget.querySelectorAll(
                'button:not(:disabled), input:not(:disabled)',
              );
              const primero = elementos[0];
              const ultimo = elementos[elementos.length - 1];
              if (evento.shiftKey && document.activeElement === primero) {
                evento.preventDefault();
                ultimo.focus();
              } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primero.focus();
              }
            }}
          >
            <button
              className="cuenta-verificacion-cerrar"
              type="button"
              aria-label="Cerrar ventana de verificación"
              onClick={cerrarVerificacion}
            >
              ×
            </button>
            <div className="cuenta-verificacion-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                <path d="m5 7 7 5.5L19 7" />
              </svg>
            </div>
            <p className="cuenta-verificacion-etiqueta">Un paso más</p>
            <h2 id="verificacion-titulo">Confirma tu correo</h2>
            <p id="verificacion-descripcion" className="cuenta-verificacion-descripcion">
              Escribe el código de seis dígitos asociado a <strong>{correoVerificacion}</strong>. En
              desarrollo, lo encontrarás en la terminal de la API.
            </p>
            <form className="cuenta-verificacion-form" onSubmit={enviarCodigoVerificacion}>
              <div className="cuenta-verificacion-digitos" aria-label="Código de seis dígitos">
                {Array.from({ length: 6 }, (_, indice) => (
                  <input
                    key={indice}
                    id={`verificacion-codigo-${indice}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={indice === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Dígito ${indice + 1} de 6`}
                    maxLength="6"
                    value={
                      codigoVerificacion[indice] && codigoVerificacion[indice] !== ' '
                        ? codigoVerificacion[indice]
                        : ''
                    }
                    onChange={(evento) => actualizarDigitoCodigo(indice, evento.target.value)}
                    onKeyDown={(evento) => manejarTeclaCodigo(evento, indice)}
                    onPaste={(evento) => {
                      evento.preventDefault();
                      actualizarDigitoCodigo(0, evento.clipboardData.getData('text'));
                    }}
                    disabled={enviando}
                  />
                ))}
              </div>
              {mensajeVerificacion && (
                <p className="cuenta-verificacion-mensaje" role="alert">
                  {mensajeVerificacion}
                </p>
              )}
              <button
                className="cuenta-verificacion-confirmar"
                type="submit"
                disabled={enviando || codigoVerificacion.replace(/\D/g, '').length !== 6}
              >
                {enviando ? 'Verificando…' : 'Verificar correo'}
                {!enviando && <span aria-hidden="true">→</span>}
              </button>
            </form>
            <div className="cuenta-verificacion-reenvio">
              <span>¿No lo encuentras? Revisa también la carpeta de spam.</span>
              <button
                type="button"
                onClick={reenviarCodigoVerificacion}
                disabled={enviando || segundosReenvio > 0}
              >
                {segundosReenvio > 0
                  ? `Reenviar en ${formatoTiempoRestante(segundosReenvio)}`
                  : 'Reenviar código'}
              </button>
            </div>
            <p className="cuenta-verificacion-seguridad">
              El código vence en 10 minutos y solo se puede usar una vez.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

export default Account;
