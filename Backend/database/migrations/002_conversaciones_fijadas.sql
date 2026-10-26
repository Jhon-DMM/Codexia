ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS fijada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS conversaciones_usuario_fijadas_fecha_idx
  ON conversaciones (usuario_id, fijada DESC, actualizada_en DESC);
