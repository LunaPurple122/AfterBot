ALTER TABLE IF EXISTS serveurs
ADD COLUMN IF NOT EXISTS owner_id VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_serveurs_owner_id
ON serveurs (owner_id);
