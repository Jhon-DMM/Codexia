ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS resumen_contexto TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resumen_hasta_chat_id INTEGER;
