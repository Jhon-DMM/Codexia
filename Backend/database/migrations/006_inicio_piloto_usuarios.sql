ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS piloto_inicio_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS usuarios_piloto_inicio_idx
  ON usuarios (piloto_inicio_en);
