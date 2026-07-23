UPDATE employee_profiles
SET employee_id = '00000001'
WHERE employee_id = 'EMP-DEMO-001';

UPDATE employee_profiles
SET employee_id = LPAD(employee_id, 8, '0')
WHERE employee_id REGEXP '^[0-9]{1,7}$';

ALTER TABLE consumer_profiles
  MODIFY reference_number CHAR(14) NOT NULL,
  ADD CONSTRAINT chk_consumer_reference_number_format
    CHECK (reference_number REGEXP '^[0-9]{14}$');

ALTER TABLE employee_profiles
  MODIFY employee_id CHAR(8) NOT NULL,
  ADD CONSTRAINT chk_employee_id_format
    CHECK (employee_id REGEXP '^[0-9]{8}$');
