CREATE TABLE IF NOT EXISTS consumer_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_number CHAR(14) NOT NULL,
  consumer_id CHAR(10) NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  registered_phone CHAR(11) NULL,
  tariff VARCHAR(80) NOT NULL,
  circle_id BIGINT UNSIGNED NOT NULL,
  division_id BIGINT UNSIGNED NOT NULL,
  subdivision_id BIGINT UNSIGNED NOT NULL,
  service_address VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consumer_records_reference (reference_number),
  UNIQUE KEY uq_consumer_records_consumer_id (consumer_id),
  KEY idx_consumer_records_location (circle_id, division_id, subdivision_id),
  CONSTRAINT chk_consumer_records_reference CHECK (reference_number REGEXP '^[0-9]{14}$'),
  CONSTRAINT chk_consumer_records_consumer_id CHECK (consumer_id REGEXP '^[0-9]{10}$'),
  CONSTRAINT chk_consumer_records_phone CHECK (
    registered_phone IS NULL OR registered_phone REGEXP '^03[0-9]{9}$'
  ),
  CONSTRAINT fk_consumer_records_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumer_records_division FOREIGN KEY (division_id) REFERENCES divisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumer_records_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tickets
  DROP FOREIGN KEY fk_tickets_requester,
  DROP INDEX uq_tickets_requester_idempotency,
  MODIFY requester_id BIGINT UNSIGNED NULL,
  ADD COLUMN consumer_record_id BIGINT UNSIGNED NULL AFTER requester_id,
  ADD COLUMN complaint_contact_phone CHAR(11) NULL AFTER consumer_record_id;

ALTER TABLE tickets
  ADD UNIQUE KEY uq_tickets_requester_idempotency (requester_id, idempotency_key),
  ADD UNIQUE KEY uq_tickets_consumer_idempotency (consumer_record_id, idempotency_key),
  ADD KEY idx_tickets_consumer_created (consumer_record_id, created_at),
  ADD CONSTRAINT chk_tickets_contact_phone CHECK (
    complaint_contact_phone IS NULL OR complaint_contact_phone REGEXP '^03[0-9]{9}$'
  ),
  ADD CONSTRAINT fk_tickets_requester FOREIGN KEY (requester_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_tickets_consumer_record FOREIGN KEY (consumer_record_id)
    REFERENCES consumer_records (id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE attachments
  DROP FOREIGN KEY fk_attachments_uploader,
  MODIFY uploader_id BIGINT UNSIGNED NULL;

ALTER TABLE attachments
  ADD CONSTRAINT fk_attachments_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE assignments
  DROP FOREIGN KEY fk_assignments_actor,
  MODIFY assigned_by BIGINT UNSIGNED NULL;

ALTER TABLE assignments
  ADD CONSTRAINT fk_assignments_actor FOREIGN KEY (assigned_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sms_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  recipient_phone CHAR(11) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  message VARCHAR(500) NOT NULL,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  provider_message_id VARCHAR(190) NULL,
  last_error VARCHAR(500) NULL,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_outbox_delivery (status, next_attempt_at, id),
  KEY idx_sms_outbox_ticket (ticket_id, created_at),
  CONSTRAINT chk_sms_outbox_phone CHECK (recipient_phone REGEXP '^03[0-9]{9}$'),
  CONSTRAINT fk_sms_outbox_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Legacy consumer users remain as immutable historical actors for existing audit records,
-- but they can no longer authenticate or hold refresh sessions.
UPDATE users u
JOIN roles r ON r.id = u.role_id AND r.name = 'consumer'
SET u.status = 'inactive',
    u.status_reason = 'Legacy consumer identity archived after public portal migration',
    u.locked_until = NULL,
    u.failed_login_count = 0;

DELETE session
FROM refresh_sessions session
JOIN users u ON u.id = session.user_id
JOIN roles r ON r.id = u.role_id AND r.name = 'consumer';
