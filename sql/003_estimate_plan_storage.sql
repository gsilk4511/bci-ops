-- Apply to the staging BCI database before enabling estimate PDF uploads.
-- Drawing bytes stay outside pilot_state; its estimate records retain access metadata.
CREATE TABLE IF NOT EXISTS bci_estimate_plan_files (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  pdf_bytes MEDIUMBLOB NOT NULL
) ENGINE=InnoDB;
