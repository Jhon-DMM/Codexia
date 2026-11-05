CREATE TABLE IF NOT EXISTS eliminaciones_cuenta (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  correo_hash CHAR(64) NOT NULL,
  admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  admin_correo VARCHAR(254) NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  detalles TEXT NOT NULL,
  aviso_password_hash TEXT,
  modo VARCHAR(20) NOT NULL CHECK (modo IN ('individual', 'multiple')),
  lote_id UUID,
  estado VARCHAR(20) NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'ejecutada', 'cancelada')),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminar_en TIMESTAMPTZ NOT NULL,
  ejecutada_en TIMESTAMPTZ,
  cancelada_en TIMESTAMPTZ
);

ALTER TABLE eliminaciones_cuenta
  ADD COLUMN IF NOT EXISTS aviso_password_hash TEXT;

CREATE INDEX IF NOT EXISTS eliminaciones_cuenta_programadas_idx
  ON eliminaciones_cuenta (eliminar_en) WHERE estado = 'programada';
CREATE INDEX IF NOT EXISTS eliminaciones_cuenta_usuario_idx
  ON eliminaciones_cuenta (usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS eliminaciones_cuenta_correo_idx
  ON eliminaciones_cuenta (correo_hash, creada_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS eliminaciones_cuenta_unica_programada_idx
  ON eliminaciones_cuenta (usuario_id) WHERE estado = 'programada' AND usuario_id IS NOT NULL;
