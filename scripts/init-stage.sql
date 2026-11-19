-- TEMPLATE only. Use an Adminer SQL editor in the LAMP container, after backups.
-- Replace strong password with your own; NEVER paste secrets into chat.
CREATE DATABASE IF NOT EXISTS bci_operations_stage CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
-- Restrict by Docker application IP; login allowed only from the new BCI container.
CREATE USER IF NOT EXISTS 'bci_stage_app'@'10.50.6.20' IDENTIFIED BY 'REPLACE_ME_UNIQUE_LONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON bci_operations_stage.* TO 'bci_stage_app'@'10.50.6.20';
-- Run sql/001_pilot.sql using an administrator in bci_operations_stage.
-- Do not grant CREATE, DROP, or ALTER privileges to the runtime account.
