ALTER TABLE intentos_login
  ADD COLUMN IF NOT EXISTS nivel_bloqueo SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE intentos_login
  DROP CONSTRAINT IF EXISTS intentos_login_nivel_bloqueo_check;

ALTER TABLE intentos_login
  ADD CONSTRAINT intentos_login_nivel_bloqueo_check
  CHECK (nivel_bloqueo BETWEEN 0 AND 4);
