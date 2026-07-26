SET @schema_name = DATABASE();

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND COLUMN_NAME='circle_id'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD COLUMN circle_id BIGINT UNSIGNED NULL AFTER work_location'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND COLUMN_NAME='division_id'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND COLUMN_NAME='subdivision_id'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND INDEX_NAME='idx_employee_profiles_work_location'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD KEY idx_employee_profiles_work_location (circle_id,division_id,subdivision_id)'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND CONSTRAINT_NAME='fk_employee_profiles_circle'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD CONSTRAINT fk_employee_profiles_circle FOREIGN KEY (circle_id) REFERENCES circles (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND CONSTRAINT_NAME='fk_employee_profiles_division'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD CONSTRAINT fk_employee_profiles_division FOREIGN KEY (division_id) REFERENCES divisions (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='employee_profiles' AND CONSTRAINT_NAME='fk_employee_profiles_subdivision'),
  'SELECT 1',
  'ALTER TABLE employee_profiles ADD CONSTRAINT fk_employee_profiles_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND COLUMN_NAME='circle_id'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD COLUMN circle_id BIGINT UNSIGNED NULL AFTER work_location'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND COLUMN_NAME='division_id'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND COLUMN_NAME='subdivision_id'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND INDEX_NAME='idx_staff_profiles_work_location'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD KEY idx_staff_profiles_work_location (circle_id,division_id,subdivision_id)'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND CONSTRAINT_NAME='fk_staff_profiles_circle'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD CONSTRAINT fk_staff_profiles_circle FOREIGN KEY (circle_id) REFERENCES circles (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND CONSTRAINT_NAME='fk_staff_profiles_division'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD CONSTRAINT fk_staff_profiles_division FOREIGN KEY (division_id) REFERENCES divisions (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='staff_profiles' AND CONSTRAINT_NAME='fk_staff_profiles_subdivision'),
  'SELECT 1',
  'ALTER TABLE staff_profiles ADD CONSTRAINT fk_staff_profiles_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE migration_statement FROM @ddl; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
