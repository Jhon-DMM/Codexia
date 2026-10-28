CREATE TABLE IF NOT EXISTS intentos_login (
  clave_hash CHAR(64) PRIMARY KEY,
  intentos SMALLINT NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 3),
  ventana_iniciada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bloqueada_hasta TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS intentos_login_ventana_idx
  ON intentos_login (ventana_iniciada_en);
