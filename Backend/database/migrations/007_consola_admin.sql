ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_valido') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_valido CHECK (rol IN ('cliente', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_estado_valido') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_valido CHECK (estado IN ('activo', 'suspendido'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuarios_admin_clientes_idx ON usuarios (estado, creado_en DESC);

CREATE TABLE IF NOT EXISTS admin_auditoria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  actor_correo VARCHAR(254) NOT NULL,
  accion VARCHAR(80) NOT NULL,
  objetivo_tipo VARCHAR(40) NOT NULL,
  objetivo_id VARCHAR(120),
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  agente_usuario VARCHAR(512),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_auditoria_fecha_idx ON admin_auditoria (creado_en DESC);
CREATE INDEX IF NOT EXISTS admin_auditoria_actor_idx ON admin_auditoria (actor_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS solicitudes_soporte (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('general', 'privacidad', 'facturacion')),
  asunto VARCHAR(120) NOT NULL,
  mensaje TEXT NOT NULL CHECK (char_length(mensaje) BETWEEN 1 AND 4000),
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'respondida', 'cerrada')),
  respuesta TEXT,
  admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  privacidad_version VARCHAR(24) NOT NULL,
  privacidad_sha256 CHAR(64) NOT NULL,
  privacidad_aceptada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip INET,
  agente_usuario VARCHAR(512),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondida_en TIMESTAMPTZ
);

-- CREATE TABLE IF NOT EXISTS no modifica tablas instaladas con una versión anterior.
-- Las columnas de aceptación quedan NULL en solicitudes antiguas: no se inventa una aceptación retroactiva.
ALTER TABLE solicitudes_soporte
  ADD COLUMN IF NOT EXISTS privacidad_version VARCHAR(24),
  ADD COLUMN IF NOT EXISTS privacidad_sha256 CHAR(64),
  ADD COLUMN IF NOT EXISTS privacidad_aceptada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip INET,
  ADD COLUMN IF NOT EXISTS agente_usuario VARCHAR(512);

CREATE INDEX IF NOT EXISTS solicitudes_soporte_estado_idx ON solicitudes_soporte (estado, actualizada_en DESC);
CREATE INDEX IF NOT EXISTS solicitudes_soporte_usuario_idx ON solicitudes_soporte (usuario_id, creada_en DESC);
