import React, { useEffect, useMemo, useState } from 'react';

function separarPalabras(texto) {
  if (typeof Intl.Segmenter === 'function') {
    const segmentador = new Intl.Segmenter('es', { granularity: 'word' });
    return Array.from(segmentador.segment(texto), ({ segment, isWordLike }) => ({
      texto: segment,
      animar: Boolean(isWordLike),
    }));
  }

  return (texto.match(/\S+\s*|\s+/g) || []).map((segmento) => ({
    texto: segmento,
    animar: /\S/.test(segmento),
  }));
}

function AssistantMessage({ message, onRetry }) {
  const esAsistente = message.role === 'asistente';
  const segmentos = useMemo(() => separarPalabras(message.content), [message.content]);
  const [palabrasVisibles, setPalabrasVisibles] = useState(message.animar ? 0 : segmentos.length);

  useEffect(() => {
    if (!message.animar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPalabrasVisibles(segmentos.length);
      return undefined;
    }

    setPalabrasVisibles(0);
    const intervalo = Math.min(35, Math.max(12, 1800 / Math.max(1, segmentos.length)));
    let posicion = 0;
    const timer = window.setInterval(() => {
      posicion += 1;
      setPalabrasVisibles(posicion);
      if (posicion >= segmentos.length) window.clearInterval(timer);
    }, intervalo);

    return () => window.clearInterval(timer);
  }, [message.id, message.animar, segmentos.length]);

  if (message.error) {
    return (
      <div className="mensaje-burbuja mensaje-error">
        <span>{message.content}</span>
        {message.retry && (
          <button className="btn btn-reintentar" type="button" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mensaje-burbuja ${esAsistente ? 'mensaje-asistente' : 'mensaje-usuario'}${message.processing ? ' mensaje-procesando' : ''}`}
      aria-label={`${esAsistente ? 'Asistente' : 'Tú'}: ${message.content}`}
    >
      {message.processing ? (
        message.content
      ) : (
        <>
          <strong aria-hidden="true">{esAsistente ? 'Asistente: ' : 'Tú: '}</strong>
          {esAsistente && message.animar ? (
            <>
              <span className="texto-en-escritura" aria-hidden="true">
                {segmentos.slice(0, palabrasVisibles).map((segmento, index) =>
                  segmento.animar ? (
                    <span className="palabra-animada" key={`${index}-${segmento.texto}`}>
                      {segmento.texto}
                    </span>
                  ) : (
                    <React.Fragment key={`${index}-${segmento.texto}`}>
                      {segmento.texto}
                    </React.Fragment>
                  ),
                )}
              </span>
              <span className="texto-oculto">{message.content}</span>
            </>
          ) : (
            message.content
          )}
        </>
      )}
    </div>
  );
}

export default AssistantMessage;
