import React from 'react';
import '../../css/base.css';
import '../../css/inicio.css';
import logo from '../../img/logo-codexia.png';
import Estrellas from '../components/home/Estrellas.jsx';
import { useHome } from '../hooks/useHome.js';

const servicios = [
  {
    titulo: 'Desarrollo web',
    texto: 'Diseñamos sitios web modernos, rápidos y adaptados a cualquier dispositivo.',
    icono: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
  },
  {
    titulo: 'Desarrollo de software',
    texto:
      'Creamos soluciones de software personalizadas para optimizar procesos y mejorar la productividad.',
    icono: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 4v5" />
      </>
    ),
  },
  {
    titulo: 'Ciberseguridad',
    texto:
      'Protegemos la información y fortalecemos la seguridad de los sistemas frente a amenazas digitales.',
    icono: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  },
  {
    titulo: 'Inteligencia artificial',
    texto:
      'Implementamos soluciones basadas en IA para automatizar tareas y potenciar la toma de decisiones.',
    icono: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />,
  },
];

const valores = [
  ['Innovación', 'Buscamos soluciones modernas para cada proyecto.'],
  ['Calidad', 'Cuidamos cada detalle para entregar productos confiables.'],
  [
    'Compromiso',
    'Trabajamos junto a nuestros clientes para comprender sus necesidades y ofrecer soluciones a su medida.',
  ],
  ['Seguridad', 'Diseñamos pensando en la protección de la información.'],
];

const razones = [
  [
    'Aclara tu idea',
    'Te hace preguntas que ayudan a definir qué necesitas, para quién y con qué alcance.',
  ],
  ['Conoce la empresa', 'Resuelve tus dudas sobre nuestros servicios y nuestra forma de trabajar.'],
  [
    'Llega con una base clara',
    'Tu proyecto queda más definido antes de la primera conversación con el equipo.',
  ],
];

function Home() {
  const { sesionActiva } = useHome();

  return (
    <>
      <div id="background-cosmico" className="background-cosmico" aria-hidden="true">
        <div className="halo-aurora"></div>
        <div className="planeta-eclipse"></div>
      </div>
      <header className="encabezado">
        <h1 className="titulo-2">Codexia</h1>
        <nav className="menu-pildora" aria-label="Principal">
          <a href="#background-cosmico" className="menu">
            inicio
          </a>
          <a href="#nosotros" className="menu">
            nosotros
          </a>
          <a href="#servicios" className="menu">
            servicios
          </a>
          <a href="#porque-elegirnos" className="menu">
            porque elegirnos
          </a>
        </nav>
        <a
          id="acceso-principal"
          href={sesionActiva ? './es/asistente.ia/index.html' : './es/cuenta/index.html'}
          className="btn btn-login"
        >
          {sesionActiva ? 'Ir al chat' : 'Iniciar sesión'}
        </a>
      </header>

      <main>
        <section id="hero" className="hero">
          <Estrellas />
          <div className="hero-content">
            <img className="logo" src={logo} alt="Logo de Codexia" />
            <h2 className="hero-titulo">CODEXIA</h2>
            <p>Transformamos tu idea en una realidad digital.</p>
            <div className="hero-acciones">
              <a href="./es/asistente.ia/index.html" className="btn">
                Habla con nuestra asistente de IA
              </a>
              <a
                href="https://wa.me/573175036274?text=Hola%20!%20Quiero%20saber%20más%20sobre%20tus%20servicio."
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-fantasma"
              >
                Escríbenos por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section id="nosotros" className="seccion seccion-nosotros">
          <Estrellas />
          <div className="contenido">
            <div className="seccion-titulo">
              <h3>Creamos con propósito</h3>
              <p className="text">
                Somos una empresa de desarrollo de software con un propósito claro: crear soluciones
                digitales que ayuden a las empresas a mejorar su rendimiento y a lograr sus
                objetivos.
              </p>
            </div>
            <ul className="lista">
              {valores.map(([titulo, texto], indice) => (
                <li key={titulo}>
                  <span className="num">{String(indice + 1).padStart(2, '0')}</span>
                  <h4>{titulo}</h4>
                  <p>{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="servicios" className="seccion seccion-servicios">
          <Estrellas />
          <div className="contenido">
            <div className="seccion-titulo">
              <h3>Nuestras capacidades técnicas</h3>
              <p className="text">
                Ofrecemos una gama diversa de servicios para satisfacer las necesidades de nuestros
                clientes.
              </p>
            </div>
            <ul className="lista lista-servicios">
              {servicios.map((servicio) => (
                <li key={servicio.titulo}>
                  <svg className="icono" viewBox="0 0 24 24" aria-hidden="true">
                    {servicio.icono}
                  </svg>
                  <div>
                    <h4>{servicio.titulo}</h4>
                    <p>{servicio.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="asistente" className="seccion seccion-asistente">
          <Estrellas />
          <div className="contenido asistente-grid">
            <div>
              <div className="seccion-titulo">
                <h3>Habla con nuestra asistente de IA</h3>
                <p className="text">
                  Antes de escribirnos, conversa con ella: te ayuda a poner en palabras lo que
                  tienes en mente y a conocer cómo trabajamos.
                </p>
              </div>
              <ul className="lista lista-razones">
                {razones.map(([titulo, texto]) => (
                  <li key={titulo}>
                    <h4>{titulo}</h4>
                    <p>{texto}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="asistente-chat">
              <div
                className="chat-ejemplo"
                role="img"
                aria-label="Ejemplo de conversación con la asistente"
              >
                <p className="burbuja burbuja-usuario">
                  Quiero una app para mi negocio, pero aún no sé por dónde empezar.
                </p>
                <p className="burbuja burbuja-ia">
                  Cuéntame: ¿qué problema quieres resolver y quién la usaría?
                </p>
              </div>
              <a href="./es/asistente.ia/index.html" className="btn">
                Habla con nuestra asistente de IA
              </a>
            </div>
          </div>
        </section>

        <section id="porque-elegirnos" className="seccion seccion-porque">
          <Estrellas />
          <div className="contenido">
            <div className="seccion-titulo">
              <h3>Tu éxito, respaldado por nuestra ingeniería</h3>
            </div>
            <ul className="lista lista-puntos">
              <li>
                <h4>Tecnología moderna</h4>
                <p>Trabajamos con herramientas actuales y soluciones escalables.</p>
              </li>
              <li>
                <h4>Atención personalizada</h4>
                <p>Cada detalle se ajusta a las necesidades y expectativas de nuestros clientes.</p>
              </li>
              <li>
                <h4>Seguridad desde el inicio</h4>
                <p>La protección de los datos forma parte del desarrollo, no es un añadido.</p>
              </li>
              <li>
                <h4>Enfoque en resultados</h4>
                <p>Buscamos crear soluciones que aporten valor real al negocio.</p>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer id="contacto">
        <div className="contenedor-footer">
          <h4>Codexia</h4>
          <p>Transformamos ideas en soluciones digitales.</p>
          <p>© 2026 Codexia.</p>
          <p>Todos los derechos reservados.</p>
        </div>
        <div className="footer-links">
          <a
            href="https://github.com/Jhon-DMM"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="GitHub de Codexia"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>
          <a
            href="https://wa.me/573175036274?text=Hola%20!%20Quiero%20saber%20más%20sobre%20tus%20servicio."
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="Contactar por WhatsApp"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </a>
          <a
            href="mailto:jhxnmondragon@gmail.com"
            className="social-icon"
            aria-label="Enviar correo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </a>
        </div>
        <nav className="footer-legales" aria-label="Información legal">
          <a href="./es/legal/terminos.html">Términos y condiciones</a>
          <a href="./es/legal/privacidad.html">Política de privacidad</a>
          <a href="./es/legal/cookies.html">Política de cookies</a>
          <a href="./es/legal/reembolsos.html">Política de reembolsos</a>
        </nav>
      </footer>
    </>
  );
}

export default Home;
