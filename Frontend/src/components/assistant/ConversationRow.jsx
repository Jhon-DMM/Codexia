import React, { useEffect } from 'react';

function ConversationRow({
  conversation,
  active,
  rowAnimation = '',
  menuOpen,
  onToggleMenu,
  onOpen,
  onRename,
  onPin,
  onDelete,
}) {
  useEffect(() => {
    if (!menuOpen) return undefined;
    const cerrarAlPresionarEscape = (event) => {
      if (event.key === 'Escape') onToggleMenu(null);
    };
    document.addEventListener('keydown', cerrarAlPresionarEscape);
    return () => document.removeEventListener('keydown', cerrarAlPresionarEscape);
  }, [menuOpen, onToggleMenu]);

  return (
    <div
      className={`conversacion-fila${active ? ' activa' : ''}${rowAnimation ? ` ${rowAnimation}` : ''}`}
      data-conversation-id={conversation.id}
    >
      <button
        className="conversacion-item"
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={() => onOpen(conversation.id)}
      >
        {conversation.fijada && (
          <span className="conversacion-alfiler" aria-label="Conversación fijada">
            📌
          </span>
        )}
        <span className="conversacion-titulo">{conversation.titulo}</span>
        <span className="conversacion-cantidad">· {conversation.cantidad_mensajes}</span>
      </button>

      <button
        className="conversacion-mas"
        type="button"
        aria-label={`Opciones de ${conversation.titulo}`}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu(menuOpen ? null : conversation.id);
        }}
      >
        •••
      </button>

      <div
        className={`conversacion-menu${menuOpen ? ' abierto' : ''}`}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <button
          type="button"
          onClick={() => {
            onToggleMenu(null);
            onRename(conversation);
          }}
        >
          Renombrar
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleMenu(null);
            onPin(conversation);
          }}
        >
          {conversation.fijada ? 'Quitar de fijadas' : 'Fijar conversación'}
        </button>
        <button
          className="accion-eliminar"
          type="button"
          onClick={() => {
            onToggleMenu(null);
            onDelete(conversation);
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default ConversationRow;
