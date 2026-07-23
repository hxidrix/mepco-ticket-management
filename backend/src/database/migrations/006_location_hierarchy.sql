CREATE TABLE IF NOT EXISTS divisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  circle_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_divisions_circle_name (circle_id, name),
  UNIQUE KEY uq_divisions_circle_slug (circle_id, slug),
  KEY idx_divisions_circle_active_sort (circle_id, is_active, sort_order),
  CONSTRAINT fk_divisions_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subdivisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  division_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subdivisions_division_name (division_id, name),
  UNIQUE KEY uq_subdivisions_division_slug (division_id, slug),
  KEY idx_subdivisions_division_active_sort (division_id, is_active, sort_order),
  CONSTRAINT fk_subdivisions_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO divisions (circle_id, name, slug, is_active, sort_order)
SELECT id, 'Other Division', 'other-division', TRUE, 9999
FROM circles
ON DUPLICATE KEY UPDATE is_active = TRUE;

INSERT INTO subdivisions (division_id, name, slug, is_active, sort_order)
SELECT id, 'Other Sub-division', 'other-sub-division', TRUE, 9999
FROM divisions
ON DUPLICATE KEY UPDATE is_active = TRUE;

ALTER TABLE consumer_profiles
  ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id,
  ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id;

UPDATE consumer_profiles cp
JOIN divisions d ON d.circle_id = cp.circle_id AND d.slug = 'other-division'
JOIN subdivisions sd ON sd.division_id = d.id AND sd.slug = 'other-sub-division'
SET cp.division_id = d.id, cp.subdivision_id = sd.id
WHERE cp.division_id IS NULL OR cp.subdivision_id IS NULL;

ALTER TABLE consumer_profiles
  MODIFY division_id BIGINT UNSIGNED NOT NULL,
  MODIFY subdivision_id BIGINT UNSIGNED NOT NULL,
  ADD KEY idx_consumer_profiles_operational_location (circle_id, division_id, subdivision_id),
  ADD CONSTRAINT fk_consumer_profiles_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_consumer_profiles_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE staff_scopes
  ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id,
  ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id,
  ADD KEY idx_staff_scopes_operational_location
    (domain, department_id, category_id, circle_id, division_id, subdivision_id),
  ADD CONSTRAINT fk_staff_scopes_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_staff_scopes_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE tickets
  ADD COLUMN division_id BIGINT UNSIGNED NULL AFTER circle_id,
  ADD COLUMN subdivision_id BIGINT UNSIGNED NULL AFTER division_id,
  ADD COLUMN division_name_snapshot VARCHAR(160) NULL AFTER circle_name_snapshot,
  ADD COLUMN subdivision_name_snapshot VARCHAR(160) NULL AFTER division_name_snapshot,
  ADD KEY idx_tickets_operational_location (circle_id, division_id, subdivision_id),
  ADD CONSTRAINT fk_tickets_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_tickets_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

UPDATE tickets t
JOIN divisions d ON d.circle_id = t.circle_id AND d.slug = 'other-division'
JOIN subdivisions sd ON sd.division_id = d.id AND sd.slug = 'other-sub-division'
SET t.division_id = d.id,
    t.subdivision_id = sd.id,
    t.division_name_snapshot = d.name,
    t.subdivision_name_snapshot = sd.name
WHERE t.circle_id IS NOT NULL AND (t.division_id IS NULL OR t.subdivision_id IS NULL);
