import { useEffect, useState } from 'react';
import { mostrarCargaNavegacion } from '../../js/carga-ui.js';

const EMAIL_VERIFICATION_REQUIRED =
  import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED?.trim().toLowerCase() !== 'false';

function apiBaseUrl() {
  const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
  if (configurada) return configurada.replace(/\/+$/, '');
  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'file:') return 'http://localhost:3000';
  if (local && port !== '3000') return `http://${hostname}:3000`;
  return '';
}

function destinoAsistente() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  const marcadorCuenta = '/es/cuenta/';
  const indiceCuenta = window.location.pathname.lastIndexOf(marcadorCuenta);
  const raizFrontend = indiceCuenta >= 0 ? window.location.pathname.slice(0, indiceCuenta) : '';
  return `${raizFrontend}/es/asistente.ia/index.html`;
}

function formatoTiempoRestante(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;
  const dosDigitos = (numero) => String(numero).padStart(2, '0');
  return horas > 0
    ? `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundosRestantes)}`
    : `${dosDigitos(minutos)}:${dosDigitos(segundosRestantes)}`;
}

export function useAccount() {
  const [registroActivo, setRegistroActivo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [errorLogin, setErrorLogin] = useState(false);
  const [notificacion, setNotificacion] = useState('');
  const [intentoConsentimiento, setIntentoConsentimiento] = useState(false);
  const [consentimientos, setConsentimientos] = useState({
    edad: false,
    terminos: false,
    privacidad: false,
  });
  const [cuentaEliminada, setCuentaEliminada] = useState(null);
  const [bloqueoHasta, setBloqueoHasta] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [passwordRegistro, setPasswordRegistro] = useState('');
  const [passwordIntentada, setPasswordIntentada] = useState(false);
  const [verificacionModalAbierta, setVerificacionModalAbierta] = useState(false);
  const [registroPendiente, setRegistroPendiente] = useState(false);
  const [correoVerificacion, setCorreoVerificacion] = useState('');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [mensajeVerificacion, setMensajeVerificacion] = useState('');
  const [reenviarHasta, setReenviarHasta] = useState(0);
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  const requisitosPassword = [
    { texto: '8 caracteres o más', cumple: passwordRegistro.length >= 8 },
    { texto: 'Una mayúscula', cumple: /\p{Lu}/u.test(passwordRegistro) },
    { texto: 'Una minúscula', cumple: /\p{Ll}/u.test(passwordRegistro) },
    { texto: 'Un número', cumple: /\p{N}/u.test(passwordRegistro) },
  ];
  const passwordValida = requisitosPassword.every(({ cumple }) => cumple);

  useEffect(() => {
    document.body.classList.add('pagina-cuenta');
    const correoPendiente = sessionStorage.getItem('codexia-correo-pendiente');
    if (EMAIL_VERIFICATION_REQUIRED && correoPendiente) {
      setCorreoVerificacion(correoPendiente);
      setRegistroPendiente(true);
      setVerificacionModalAbierta(true);
    }
    const vencimientoPiloto = Number(localStorage.getItem('codexia-piloto-expira-en'));
    if (vencimientoPiloto && Date.now() >= vencimientoPiloto) {
      setMensaje('Gracias por realizar las pruebas de Codexia');
    }

    const controlador = new AbortController();
    fetch(`${apiBaseUrl()}/api/usuarios/me`, { credentials: 'include', signal: controlador.signal })
      .then((respuesta) => {
        if (respuesta.ok) {
          mostrarCargaNavegacion();
          window.location.replace(destinoAsistente());
        }
      })
      .catch(() => {});

    return () => {
      controlador.abort();
      document.body.classList.remove('pagina-cuenta');
    };
  }, []);

  useEffect(() => {
    if (!verificacionModalAbierta) return undefined;
    const temporizador = window.setTimeout(() => {
      document.getElementById('verificacion-codigo-0')?.focus();
    }, 50);
    return () => window.clearTimeout(temporizador);
  }, [verificacionModalAbierta]);

  useEffect(() => {
    if (!reenviarHasta) return undefined;
    const actualizar = () => {
      const quedan = Math.max(0, Math.ceil((reenviarHasta - Date.now()) / 1000));
      setSegundosReenvio(quedan);
      if (quedan === 0) setReenviarHasta(0);
    };
    actualizar();
    const temporizador = window.setInterval(actualizar, 250);
    return () => window.clearInterval(temporizador);
  }, [reenviarHasta]);

  useEffect(() => {
    if (!notificacion) return undefined;
    const temporizador = window.setTimeout(() => setNotificacion(''), 5000);
    return () => window.clearTimeout(temporizador);
  }, [notificacion]);

  useEffect(() => {
    if (!bloqueoHasta) return undefined;
    const actualizar = () => {
      const quedan = Math.max(0, Math.ceil((bloqueoHasta - Date.now()) / 1000));
      setSegundosRestantes(quedan);
      if (quedan === 0) {
        setBloqueoHasta(0);
        setMensaje('Ya puedes volver a intentarlo.');
      }
    };
    actualizar();
    const temporizador = window.setInterval(actualizar, 250);
    return () => window.clearInterval(temporizador);
  }, [bloqueoHasta]);

  function mostrarAvisoConsentimiento(texto) {
    setNotificacion(texto);
    const primeraPendiente = ['edad', 'terminos', 'privacidad'].find(
      (campo) => !consentimientos[campo],
    );
    document.getElementById(`registro-${primeraPendiente}`)?.focus({ preventScroll: true });
  }

  function cambiarPestana(registro) {
    setRegistroActivo(registro);
    setMensaje('');
    setErrorLogin(false);
    setNotificacion('');
    setIntentoConsentimiento(false);
    setPasswordRegistro('');
    setPasswordIntentada(false);
  }

  function abrirVerificacion(correo, espera = 60) {
    const normalizado = String(correo || '')
      .trim()
      .toLowerCase();
    if (normalizado) sessionStorage.setItem('codexia-correo-pendiente', normalizado);
    setCorreoVerificacion(normalizado);
    setCodigoVerificacion('');
    setMensajeVerificacion('');
    setRegistroPendiente(true);
    setVerificacionModalAbierta(true);
    setReenviarHasta(Date.now() + espera * 1000);
  }

  function actualizarDigitoCodigo(indice, valor) {
    const digitos = valor.replace(/\D/g, '');
    const nuevoCodigo = codigoVerificacion.padEnd(6, ' ').slice(0, 6).split('');

    if (digitos.length > 1) {
      digitos
        .slice(0, 6)
        .split('')
        .forEach((digito, posicion) => {
          nuevoCodigo[posicion] = digito;
        });
      setCodigoVerificacion(nuevoCodigo.join(''));
      document.getElementById(`verificacion-codigo-${Math.min(digitos.length, 6) - 1}`)?.focus();
      return;
    }

    nuevoCodigo[indice] = digitos || ' ';
    setCodigoVerificacion(nuevoCodigo.join(''));
    if (digitos && indice < 5) {
      document.getElementById(`verificacion-codigo-${indice + 1}`)?.focus();
    }
  }

  function manejarTeclaCodigo(evento, indice) {
    if (
      evento.key === 'Backspace' &&
      (!codigoVerificacion[indice] || codigoVerificacion[indice] === ' ') &&
      indice > 0
    ) {
      document.getElementById(`verificacion-codigo-${indice - 1}`)?.focus();
    }
    if (evento.key === 'ArrowLeft' && indice > 0) {
      document.getElementById(`verificacion-codigo-${indice - 1}`)?.focus();
    }
    if (evento.key === 'ArrowRight' && indice < 5) {
      document.getElementById(`verificacion-codigo-${indice + 1}`)?.focus();
    }
  }

  async function enviar(endpoint, form) {
    setMensaje('');
    if (endpoint === 'login') setErrorLogin(false);
    setCuentaEliminada(null);
    setEnviando(true);
    try {
      const datos = form instanceof HTMLFormElement ? Object.fromEntries(new FormData(form)) : form;
      const respuesta = await fetch(`${apiBaseUrl()}/api/usuarios/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        if (endpoint === 'login' && respuesta.status === 410) {
          if (resultado.codigo === 'CUENTA_ELIMINADA' && resultado.eliminacion) {
            setCuentaEliminada(resultado.eliminacion);
            setMensaje('');
          } else {
            setMensaje(resultado.mensaje || 'Gracias por realizar las pruebas de Codexia');
          }
          return;
        }
        if (endpoint === 'login' && respuesta.status === 401) {
          const finPiloto = Number(localStorage.getItem('codexia-piloto-expira-en'));
          if (finPiloto && Date.now() >= finPiloto) {
            setMensaje('Gracias por realizar las pruebas de Codexia');
          } else {
            setErrorLogin(true);
          }
          return;
        }
        if (endpoint === 'login' && resultado.codigo === 'CORREO_NO_VERIFICADO') {
          abrirVerificacion(datos.correo, 0);
          setMensaje('Debes confirmar tu correo para iniciar sesión.');
          return;
        }
        if (
          endpoint === 'login' &&
          respuesta.status === 429 &&
          Number.isFinite(resultado.reintentarEn)
        ) {
          setBloqueoHasta(Date.now() + resultado.reintentarEn * 1000);
          setMensaje('Inicio de sesión pausado temporalmente.');
          return;
        }
        if (endpoint === 'registro/verificar-correo') {
          setMensajeVerificacion(resultado.mensaje || 'No se pudo comprobar el código.');
          return;
        }
        if (endpoint === 'registro/reenviar-codigo' && respuesta.status === 429) {
          const espera = Number(resultado.reintentarEn) || 60;
          setReenviarHasta(Date.now() + espera * 1000);
          setMensajeVerificacion(resultado.mensaje || 'Espera antes de pedir otro código.');
          return;
        }
        throw new Error(resultado.mensaje || 'No fue posible completar la solicitud');
      }

      if (endpoint === 'registro' && resultado.requiereVerificacion) {
        abrirVerificacion(resultado.correo || datos.correo, resultado.reintentarEn || 60);
        setMensajeVerificacion(resultado.avisoCorreo || '');
        setMensaje('');
        return;
      }

      if (endpoint === 'registro/reenviar-codigo') {
        const espera = Number(resultado.reintentarEn) || 60;
        setReenviarHasta(Date.now() + espera * 1000);
        setMensajeVerificacion(
          resultado.mensaje || 'Si hay una cuenta pendiente, enviaremos un código.',
        );
        return;
      }

      if (
        endpoint === 'login' ||
        endpoint === 'registro' ||
        endpoint === 'registro/verificar-correo'
      ) {
        sessionStorage.removeItem('codexia-correo-pendiente');
      }

      if (endpoint === 'registro/verificar-correo') {
        setRegistroPendiente(false);
        setVerificacionModalAbierta(false);
      }

      if (resultado.usuario?.piloto_inicio_en) {
        const finPiloto =
          new Date(resultado.usuario.piloto_inicio_en).getTime() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('codexia-piloto-expira-en', String(finPiloto));
      }
      sessionStorage.removeItem('codexia-conversation-id');
      mostrarCargaNavegacion();
      window.location.assign(destinoAsistente());
    } catch (error) {
      const textoError =
        error instanceof TypeError
          ? `No se pudo conectar con el servidor (${apiBaseUrl() || window.location.origin}). Comprueba que la API esté iniciada y que el origen de esta página esté permitido por CORS.`
          : error.message || 'No fue posible completar la solicitud. Inténtalo de nuevo.';
      if (endpoint === 'registro/verificar-correo' || endpoint === 'registro/reenviar-codigo') {
        setMensajeVerificacion(textoError);
      } else {
        setMensaje(textoError);
      }
    } finally {
      setEnviando(false);
    }
  }

  function enviarLogin(event) {
    event.preventDefault();
    enviar('login', event.currentTarget);
  }

  function enviarRegistro(event) {
    event.preventDefault();
    setIntentoConsentimiento(true);
    if (!consentimientos.edad || !consentimientos.terminos || !consentimientos.privacidad) {
      const faltaEdad = !consentimientos.edad;
      const faltaConsentimiento = !consentimientos.terminos || !consentimientos.privacidad;
      mostrarAvisoConsentimiento(
        faltaEdad && faltaConsentimiento
          ? 'Debes confirmar que tienes 18 años o más y aceptar los términos y la política de privacidad.'
          : faltaEdad
            ? 'La prueba piloto está limitada a personas de 18 años o más.'
            : 'Debes aceptar los términos y condiciones y la política de privacidad para crear tu cuenta.',
      );
      return;
    }
    if (!passwordValida) {
      setPasswordIntentada(true);
      document.getElementById('registro-password')?.focus();
      return;
    }
    if (!event.currentTarget.reportValidity()) return;
    setNotificacion('');
    enviar('registro', event.currentTarget);
  }

  function enviarCodigoVerificacion(event) {
    event.preventDefault();
    const codigo = codigoVerificacion.replace(/\D/g, '');
    if (codigo.length !== 6) {
      setMensajeVerificacion('Escribe los seis dígitos del código.');
      return;
    }
    enviar('registro/verificar-correo', {
      correo: correoVerificacion,
      codigo,
    });
  }

  function reenviarCodigoVerificacion() {
    if (segundosReenvio > 0 || enviando) return;
    enviar('registro/reenviar-codigo', { correo: correoVerificacion });
  }

  function cerrarVerificacion() {
    setVerificacionModalAbierta(false);
  }

  function cambiarConsentimiento(campo, valor) {
    const actualizado = { ...consentimientos, [campo]: valor };
    setConsentimientos(actualizado);
    if (actualizado.edad && actualizado.terminos && actualizado.privacidad) setNotificacion('');
  }

  const cuentaConsentimiento = (campo) => intentoConsentimiento && !consentimientos[campo];
  const claseConsentimiento = (campo) =>
    `cuenta-consentimiento${cuentaConsentimiento(campo) ? ' rechazado' : ''}`;
  const bloqueoActivo = segundosRestantes > 0;

  return {
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
  };
}
