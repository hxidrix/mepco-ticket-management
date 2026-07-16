CREATE TABLE IF NOT EXISTS ticket_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  issue_resolved BOOLEAN NOT NULL,
  satisfaction_rating TINYINT UNSIGNED NOT NULL,
  review_text VARCHAR(2000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_reviews_ticket (ticket_id),
  KEY idx_ticket_reviews_requester_created (requester_id, created_at),
  CONSTRAINT chk_ticket_reviews_rating CHECK (satisfaction_rating BETWEEN 1 AND 5),
  CONSTRAINT fk_ticket_reviews_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ticket_reviews_requester FOREIGN KEY (requester_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
