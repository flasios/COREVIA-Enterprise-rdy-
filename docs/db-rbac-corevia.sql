-- Corevia DB RBAC hardening (example)
-- Goal: only the Brain service can write to corevia governance tables.
--
-- NOTE: adjust schema/table names and application connection strings for your environment.

-- Assumed DB name: heliumdb
-- Assumed schema: public

-- Create roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'corevia_brain_rw') THEN
    CREATE ROLE corevia_brain_rw;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'corevia_services_ro') THEN
    CREATE ROLE corevia_services_ro;
  END IF;
END $$;

-- Example login users (recommended): one DB user for brain, one for other services.
-- Set passwords via your secrets manager; these statements are safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'corevia_brain_app') THEN
    CREATE ROLE corevia_brain_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'corevia_services_app') THEN
    CREATE ROLE corevia_services_app LOGIN;
  END IF;
END $$;

GRANT corevia_brain_rw TO corevia_brain_app;
GRANT corevia_services_ro TO corevia_services_app;

-- Revoke defaults
REVOKE ALL ON SCHEMA public FROM corevia_services_ro;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM corevia_services_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM corevia_services_ro;

-- Read-only for non-brain services
GRANT USAGE ON SCHEMA public TO corevia_services_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO corevia_services_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO corevia_services_ro;

-- Brain read/write
GRANT USAGE ON SCHEMA public TO corevia_brain_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO corevia_brain_rw;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO corevia_brain_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO corevia_brain_rw;

-- Hardening: ensure non-brain services cannot write even if granted via defaults elsewhere
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM corevia_services_ro;
