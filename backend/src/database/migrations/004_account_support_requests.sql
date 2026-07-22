CREATE TABLE IF NOT EXISTS account_support_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  request_type ENUM('appeal', 'support') NOT NULL,
  message TEXT NOT NULL,
  contact_preference ENUM('portal', 'email', 'phone') NOT NULL DEFAULT 'portal',
  status ENUM('submitted', 'under-review', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'submitted',
  admin_response TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_account_support_user_created (user_id, created_at),
  KEY idx_account_support_status_created (status, created_at),
  CONSTRAINT fk_account_support_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_account_support_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
