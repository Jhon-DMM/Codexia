import React, { useEffect, useRef, useState } from 'react';
import '../../css/base.css';
import '../../css/admin-acceso.css';
import { mostrarCargaNavegacion } from '../../js/carga-ui.js';

function apiBaseUrl() {
  const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'file:') return 'http://localhost:3000';
  if (local && port !== '3000') return `http://${hostname}:3000`;
  return '';
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${apiBaseUrl()}${ruta}`, {
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
    // Algunas respuestas de error no incluyen un cuerpo JSON.
  }

  return { respuesta, datos };
}

function AdminLogin() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorCredenciales, setErrorCredenciales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const temporizadorNotificacion = useRef(null);

  useEffect(() => {
    let activa = true;

    solicitar('/api/admin/me')
      .then(({ respuesta }) => {
        if (!activa) return;

        if (respuesta.ok) {
          mostrarCargaNavegacion();
          window.location.replace('index.html');
        } else if (respuesta.status === 403) {
          setMensaje(
            'La cuenta de la sesión actual no tiene permisos de administración. Inicia sesión con la cuenta autorizada.',
          );
        }
      })
      .catch(() => {});

    if (new URLSearchParams(window.location.search).get('motivo') === 'permisos') {
      setMensaje(
        'La cuenta de la sesión actual no tiene permisos de administración. Inicia sesión con la cuenta autorizada.',
      );
    }

    return () => {
      activa = false;
      window.clearTimeout(temporizadorNotificacion.current);
    };
  }, []);

  function limpiarError() {
    setErrorCredenciales('');
    setMensaje('');
    setNotificacion('');
    window.clearTimeout(temporizadorNotificacion.current);
  }

  function notificarErrorCredenciales(texto) {
    window.clearTimeout(temporizadorNotificacion.current);
    setNotificacion(texto);
    temporizadorNotificacion.current = window.setTimeout(() => setNotificacion(''), 4500);
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;

    limpiarError();
    setCargando(true);

    try {
      const login = await solicitar('/api/usuarios/login', {
        method: 'POST',
        body: JSON.stringify({ correo, password }),
      });

      if (!login.respuesta.ok) {
        if (login.respuesta.status === 401) {
          const aviso = 'Correo o contraseña equivocado. Revisa ambos datos e inténtalo de nuevo.';
          setErrorCredenciales(aviso);
          notificarErrorCredenciales(aviso);
        } else {
          setMensaje(login.datos.mensaje || 'No se pudo iniciar sesión.');
        }
        return;
      }

      const acceso = await solicitar('/api/admin/me');
      if (acceso.respuesta.ok) {
        mostrarCargaNavegacion();
        window.location.replace('index.html');
        return;
      }

      await solicitar('/api/usuarios/logout', { method: 'POST' });
      setMensaje(
        acceso.respuesta.status === 403
          ? 'Esta cuenta no tiene permisos de administración. Inicia sesión con la cuenta autorizada.'
          : acceso.datos.mensaje || 'No se pudo verificar el acceso administrativo.',
      );
    } catch (error) {
      setMensaje(
        error instanceof TypeError
          ? `No se pudo conectar con la API (${apiBaseUrl() || window.location.origin}). Comprueba que esté iniciada.`
          : error.message || 'No se pudo completar el acceso.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="admin-acceso-shell">
      {notificacion && (
        <div className="admin-acceso-notificacion" role="alert" aria-live="assertive">
          <span aria-hidden="true">!</span>
          {notificacion}
        </div>
      )}

      <section className="admin-acceso-lado" aria-label="Acceso al panel">
        <a className="admin-acceso-marca" href="../../index.html">
          <span aria-hidden="true">✦</span> Codexia <small>ADMIN</small>
        </a>

        <div className="admin-acceso-contenido">
          <div className="admin-acceso-sello" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <p className="admin-acceso-eyebrow">ESPACIO PRIVADO</p>
          <h1>Administración</h1>
          <p className="admin-acceso-descripcion">
            Inicia sesión con una cuenta autorizada para gestionar Codexia.
          </p>

          <form
            className={`admin-acceso-formulario${errorCredenciales ? ' admin-credenciales-invalidas' : ''}`}
            onSubmit={manejarEnvio}
          >
            <label htmlFor="admin-correo">Correo electrónico</label>
            <input
              id="admin-correo"
              name="correo"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              value={correo}
              aria-invalid={Boolean(errorCredenciales)}
              aria-describedby={errorCredenciales ? 'admin-error-credenciales' : undefined}
              onChange={(evento) => {
                setCorreo(evento.target.value);
                limpiarError();
              }}
            />

            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
              value={password}
              aria-invalid={Boolean(errorCredenciales)}
              aria-describedby={errorCredenciales ? 'admin-error-credenciales' : undefined}
              onChange={(evento) => {
                setPassword(evento.target.value);
                limpiarError();
              }}
            />

            {errorCredenciales && (
              <p
                id="admin-error-credenciales"
                className="admin-acceso-error-campos"
                role="alert"
                aria-live="polite"
              >
                {errorCredenciales}
              </p>
            )}

            <button
              className={`btn${cargando ? ' btn-cargando' : ''}`}
              type="submit"
              disabled={cargando}
            >
              {cargando ? (
                'Verificando acceso…'
              ) : (
                <>
                  Entrar al panel <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>

          <p className="admin-acceso-mensaje" role="status" aria-live="polite">
            {mensaje}
          </p>
          <a className="admin-acceso-volver" href="../asistente.ia/index.html">
            Volver a Codexia
          </a>
        </div>

        <p className="admin-acceso-pie">
          Acceso restringido a cuentas con permisos administrativos.
        </p>
      </section>

      <aside className="admin-acceso-bienvenida" aria-label="Información del panel de Codexia">
        <div className="admin-acceso-orbita" aria-hidden="true">
          <span />
          <div className="admin-acceso-emblema">
            <svg viewBox="0 0 64 64">
              <path d="M32 6 52 14v15c0 14-8 24-20 30C20 53 12 43 12 29V14L32 6Z" />
              <path d="m23 31 6 6 13-14" />
            </svg>
          </div>
        </div>

        <div className="admin-acceso-bienvenida-contenido">
          <p className="admin-acceso-bienvenida-eyebrow">CODEXIA · CENTRO DE OPERACIONES</p>
          <h2>
            Hola,
            <br />
            bienvenido.
          </h2>
          <p>
            Un espacio privado para gestionar las cuentas, el soporte y el funcionamiento de
            Codexia.
          </p>
        </div>

        <div className="admin-acceso-bienvenida-pie">
          <span aria-hidden="true">✦</span> Acceso reservado a administradores autorizados
        </div>
      </aside>
    </main>
  );
}

export default AdminLogin;
