CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_normalizado_unico
  ON usuarios (LOWER(correo));

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sesiones_expiracion_idx ON sesiones (expira_en);

CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(120) NOT NULL DEFAULT 'Nueva conversación',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversaciones_usuario_fecha_idx
  ON conversaciones (usuario_id, actualizada_en DESC);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  rol VARCHAR(12) NOT NULL CHECK (rol IN ('usuario', 'asistente')),
  contenido TEXT NOT NULL,
  client_message_id UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chats_conversacion_orden_idx ON chats (conversacion_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS chats_idempotencia_idx
  ON chats (conversacion_id, client_message_id, rol)
  WHERE client_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS uso_asistente (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  PRIMARY KEY (usuario_id, fecha)
);
