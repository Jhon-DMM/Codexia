ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_valido;
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_valido CHECK (rol IN ('cliente', 'admin', 'superadmin'));

CREATE INDEX IF NOT EXISTS usuarios_roles_admin_idx
  ON usuarios (rol, creado_en DESC)
  WHERE rol IN ('admin', 'superadmin');
