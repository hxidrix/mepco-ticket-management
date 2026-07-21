ALTER TABLE complaint_types
  ADD COLUMN sla_target_hours INT UNSIGNED NOT NULL DEFAULT 120 AFTER description;

ALTER TABLE tickets
  ADD COLUMN complaint_sla_target_hours INT UNSIGNED NULL AFTER priority_id,
  ADD COLUMN sla_target_hours INT UNSIGNED NULL AFTER complaint_sla_target_hours;

UPDATE tickets t
JOIN complaint_types ct ON ct.id = t.complaint_type_id
JOIN priorities p ON p.id = t.priority_id
SET t.complaint_sla_target_hours = ct.sla_target_hours,
    t.sla_target_hours = LEAST(ct.sla_target_hours, COALESCE(p.sla_target_hours, ct.sla_target_hours))
WHERE t.sla_target_hours IS NULL;

ALTER TABLE tickets
  MODIFY COLUMN complaint_sla_target_hours INT UNSIGNED NOT NULL,
  MODIFY COLUMN sla_target_hours INT UNSIGNED NOT NULL;

CREATE INDEX idx_tickets_sla_age
  ON tickets (status_id, sla_target_hours, created_at);
