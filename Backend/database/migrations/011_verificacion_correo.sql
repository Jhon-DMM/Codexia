ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS codigos_verificacion_correo (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash CHAR(64) NOT NULL,
  vence_en TIMESTAMPTZ NOT NULL,
  intentos SMALLINT NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
  reenviar_despues_en TIMESTAMPTZ NOT NULL,
  reenvios_en_ventana SMALLINT NOT NULL DEFAULT 0 CHECK (reenvios_en_ventana BETWEEN 0 AND 5),
  ventana_reenvios_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS codigos_verificacion_correo_vencimiento_idx
  ON codigos_verificacion_correo (vence_en);
