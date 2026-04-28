ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id varchar(128),
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS organization_type varchar(50),
  ADD COLUMN IF NOT EXISTS department_id varchar(128),
  ADD COLUMN IF NOT EXISTS department_name text;

UPDATE users
SET department_name = department
WHERE department_name IS NULL
  AND department IS NOT NULL;

