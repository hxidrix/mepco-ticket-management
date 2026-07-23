UPDATE users
SET phone = REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', '')
WHERE phone IS NOT NULL;

ALTER TABLE users
  MODIFY phone CHAR(11) NULL,
  ADD COLUMN cnic CHAR(13) NULL AFTER phone,
  ADD UNIQUE KEY uq_users_cnic (cnic),
  ADD CONSTRAINT chk_users_phone_format
    CHECK (phone IS NULL OR phone REGEXP '^03[0-9]{9}$'),
  ADD CONSTRAINT chk_users_cnic_format
    CHECK (cnic IS NULL OR cnic REGEXP '^[0-9]{13}$');
