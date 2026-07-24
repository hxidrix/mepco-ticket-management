ALTER TABLE employee_profiles
  ADD COLUMN circle_id BIGINT UNSIGNED NULL AFTER work_location,
  ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id,
  ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id,
  ADD KEY idx_employee_profiles_work_location (circle_id, division_id, subdivision_id),
  ADD CONSTRAINT fk_employee_profiles_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_employee_profiles_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_employee_profiles_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE staff_profiles
  ADD COLUMN circle_id BIGINT UNSIGNED NULL AFTER work_location,
  ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id,
  ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id,
  ADD KEY idx_staff_profiles_work_location (circle_id, division_id, subdivision_id),
  ADD CONSTRAINT fk_staff_profiles_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_staff_profiles_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_staff_profiles_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
