CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name),
  UNIQUE KEY uq_departments_slug (slug),
  KEY idx_departments_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS circles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_circles_name (name),
  UNIQUE KEY uq_circles_slug (slug),
  KEY idx_circles_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  circle_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_circle_name (circle_id, name),
  UNIQUE KEY uq_cities_circle_slug (circle_id, slug),
  KEY idx_cities_circle_active_sort (circle_id, is_active, sort_order),
  CONSTRAINT fk_cities_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  domain ENUM('consumer', 'employee') NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_domain_slug (domain, slug),
  KEY idx_categories_domain_department_active (domain, department_id, is_active, sort_order),
  CONSTRAINT fk_categories_department FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description VARCHAR(500) NULL,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_complaint_types_category_slug (category_id, slug),
  KEY idx_complaint_types_category_active (category_id, is_active, sort_order),
  CONSTRAINT fk_complaint_types_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS priorities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,
  color_token VARCHAR(40) NOT NULL,
  sla_target_hours INT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_priorities_name (name),
  UNIQUE KEY uq_priorities_slug (slug),
  KEY idx_priorities_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(70) NOT NULL,
  description VARCHAR(255) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_statuses_name (name),
  UNIQUE KEY uq_ticket_statuses_slug (slug),
  KEY idx_ticket_statuses_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(140) NOT NULL,
  username VARCHAR(80) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'suspended', 'inactive') NOT NULL DEFAULT 'active',
  status_reason VARCHAR(500) NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  password_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role_status (role_id, status),
  KEY idx_users_name (display_name),
  KEY idx_users_deleted (deleted_at),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumer_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  reference_number VARCHAR(32) NOT NULL,
  address VARCHAR(500) NOT NULL,
  circle_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  service_address VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_consumer_profiles_reference (reference_number),
  KEY idx_consumer_profiles_location (circle_id, city_id),
  CONSTRAINT fk_consumer_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumer_profiles_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumer_profiles_city FOREIGN KEY (city_id) REFERENCES cities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  employee_id VARCHAR(40) NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  designation VARCHAR(140) NOT NULL,
  work_location VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_employee_profiles_employee_id (employee_id),
  KEY idx_employee_profiles_department (department_id),
  CONSTRAINT fk_employee_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_employee_profiles_department FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  designation VARCHAR(140) NOT NULL,
  work_location VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_staff_profiles_department (department_id),
  CONSTRAINT fk_staff_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_staff_profiles_department FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  domain ENUM('consumer', 'employee') NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  circle_id BIGINT UNSIGNED NULL,
  can_self_assign BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_staff_scopes_user_domain (user_id, domain),
  KEY idx_staff_scopes_routing (domain, department_id, category_id, circle_id),
  CONSTRAINT fk_staff_scopes_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_staff_scopes_department FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_staff_scopes_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_staff_scopes_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id CHAR(36) NOT NULL,
  family_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_jti_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(255) NULL,
  replaced_by_session_id CHAR(36) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_sessions_jti_hash (token_jti_hash),
  KEY idx_refresh_sessions_user_active (user_id, revoked_at, expires_at),
  KEY idx_refresh_sessions_family (family_id),
  CONSTRAINT fk_refresh_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_number VARCHAR(40) NOT NULL,
  idempotency_key VARCHAR(100) NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  domain ENUM('consumer', 'employee') NOT NULL,
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  complaint_type_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  circle_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  other_category VARCHAR(180) NULL,
  other_complaint_type VARCHAR(255) NULL,
  location_details VARCHAR(500) NULL,
  priority_id BIGINT UNSIGNED NOT NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  current_assignee_id BIGINT UNSIGNED NULL,
  resolution_summary TEXT NULL,
  category_name_snapshot VARCHAR(160) NOT NULL,
  complaint_type_name_snapshot VARCHAR(180) NOT NULL,
  department_name_snapshot VARCHAR(160) NULL,
  circle_name_snapshot VARCHAR(120) NULL,
  city_name_snapshot VARCHAR(120) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  requester_confirmed_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  deleted_reason VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_number (ticket_number),
  UNIQUE KEY uq_tickets_requester_idempotency (requester_id, idempotency_key),
  KEY idx_tickets_requester_created (requester_id, created_at),
  KEY idx_tickets_queue (domain, department_id, status_id, priority_id, created_at),
  KEY idx_tickets_assignee_status (current_assignee_id, status_id, updated_at),
  KEY idx_tickets_location (circle_id, city_id),
  KEY idx_tickets_category_type (category_id, complaint_type_id),
  KEY idx_tickets_deleted (deleted_at),
  FULLTEXT KEY ftx_tickets_subject_description (subject, description),
  CONSTRAINT fk_tickets_requester FOREIGN KEY (requester_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_complaint_type FOREIGN KEY (complaint_type_id) REFERENCES complaint_types (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_department FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_circle FOREIGN KEY (circle_id) REFERENCES circles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_city FOREIGN KEY (city_id) REFERENCES cities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_priority FOREIGN KEY (priority_id) REFERENCES priorities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_status FOREIGN KEY (status_id) REFERENCES ticket_statuses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (current_assignee_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  reason VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ticket_history_ticket_created (ticket_id, created_at, id),
  KEY idx_ticket_history_actor (actor_id, created_at),
  CONSTRAINT fk_ticket_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ticket_history_actor FOREIGN KEY (actor_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  ended_reason VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_assignments_ticket_timeline (ticket_id, assigned_at),
  KEY idx_assignments_technician_active (technician_id, ended_at, assigned_at),
  CONSTRAINT fk_assignments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_assignments_technician FOREIGN KEY (technician_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_actor FOREIGN KEY (assigned_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  visibility ENUM('public', 'internal') NOT NULL DEFAULT 'public',
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_comments_ticket_created (ticket_id, created_at, id),
  KEY idx_comments_author (author_id, created_at),
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  comment_id BIGINT UNSIGNED NULL,
  uploader_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  extension VARCHAR(20) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attachments_stored_name (stored_name),
  KEY idx_attachments_ticket (ticket_id, created_at),
  CONSTRAINT fk_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_attachments_comment FOREIGN KEY (comment_id) REFERENCES comments (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_attachments_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  target_type VARCHAR(60) NULL,
  target_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_recipient_read (recipient_id, read_at, created_at),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_active_window (is_active, starts_at, ends_at),
  CONSTRAINT fk_announcements_author FOREIGN KEY (author_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcement_audiences (
  announcement_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (announcement_id, role_id),
  CONSTRAINT fk_announcement_audiences_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_announcement_audiences_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) NULL,
  result ENUM('success', 'failure') NOT NULL,
  request_id VARCHAR(128) NULL,
  ip_address VARCHAR(64) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_actor_created (actor_id, created_at),
  KEY idx_audit_logs_action_entity (action, entity_type, created_at),
  KEY idx_audit_logs_result_created (result, created_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
