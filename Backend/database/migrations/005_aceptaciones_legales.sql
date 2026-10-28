-- Se conserva una constancia seudónima de aceptación incluso después de eliminar una cuenta.
-- La IP y el agente de usuario se guardan para respaldar la trazabilidad descrita en la política de privacidad.
CREATE TABLE IF NOT EXISTS aceptaciones_legales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  documento VARCHAR(16) NOT NULL CHECK (documento IN ('terminos', 'privacidad')),
  version VARCHAR(24) NOT NULL,
  documento_sha256 CHAR(64) NOT NULL,
  aceptado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mecanismo VARCHAR(20) NOT NULL CHECK (mecanismo IN ('registro', 'inicio_sesion')),
  ip INET,
  agente_usuario VARCHAR(512),
  UNIQUE (usuario_id, documento, version)
);

CREATE INDEX IF NOT EXISTS aceptaciones_legales_usuario_fecha_idx
  ON aceptaciones_legales (usuario_id, aceptado_en DESC);
