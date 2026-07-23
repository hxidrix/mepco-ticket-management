CREATE TABLE IF NOT EXISTS internal_message_threads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  technician_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(160) NOT NULL,
  last_message_id BIGINT UNSIGNED NULL,
  technician_last_read_message_id BIGINT UNSIGNED NULL,
  manager_last_read_message_id BIGINT UNSIGNED NULL,
  last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_internal_threads_technician (technician_id, last_message_at),
  KEY idx_internal_threads_manager (manager_id, last_message_at),
  CONSTRAINT fk_internal_threads_technician FOREIGN KEY (technician_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_internal_threads_manager FOREIGN KEY (manager_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body VARCHAR(4000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_internal_messages_thread (thread_id, id),
  CONSTRAINT fk_internal_messages_thread FOREIGN KEY (thread_id) REFERENCES internal_message_threads (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_internal_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
