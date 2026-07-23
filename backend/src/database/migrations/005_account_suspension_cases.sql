CREATE TABLE IF NOT EXISTS account_suspension_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_user_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  source_ticket_id BIGINT UNSIGNED NULL,
  origin ENUM('technician_request', 'manager_direct') NOT NULL,
  category ENUM(
    'abusive-behavior',
    'fraudulent-information',
    'repeated-policy-violation',
    'security-risk',
    'misuse-of-service',
    'other'
  ) NOT NULL,
  reason_summary VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  decision_notes TEXT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suspension_cases_target_created (target_user_id, created_at),
  KEY idx_suspension_cases_requester_created (requested_by, created_at),
  KEY idx_suspension_cases_status_created (status, created_at),
  KEY idx_suspension_cases_source_ticket (source_ticket_id),
  CONSTRAINT fk_suspension_cases_target FOREIGN KEY (target_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_suspension_cases_requester FOREIGN KEY (requested_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_suspension_cases_ticket FOREIGN KEY (source_ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_suspension_cases_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
