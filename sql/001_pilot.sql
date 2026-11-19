-- P I L O T  O N L Y. Execute against a NEW dedicated STAGING database.
-- This stores a single JSON document for a functional prototype; NOT a production schema.
CREATE TABLE IF NOT EXISTS pilot_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_valid_state CHECK (JSON_VALID(state_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
