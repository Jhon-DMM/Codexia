CREATE TABLE IF NOT EXISTS limites_registro_ip (
  clave_hash CHAR(64) PRIMARY KEY,
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ventana_iniciada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS limites_registro_ip_actualizado_idx
  ON limites_registro_ip (actualizado_en);
