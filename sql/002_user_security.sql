-- Apply deliberately to the intended BCI database before enabling security.
CREATE TABLE IF NOT EXISTS bci_user_security (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL CHECK (JSON_VALID(state_json))
) ENGINE=InnoDB;
INSERT IGNORE INTO bci_user_security (id,state_json) VALUES (1,'{}');
