ALTER TABLE intelligence_plans
  ADD COLUMN IF NOT EXISTS iplan_hash TEXT;

UPDATE intelligence_plans
SET iplan_hash = md5(
  COALESCE(request_id, '') || '|' ||
  COALESCE(mode::text, '') || '|' ||
  COALESCE(selected_engines::text, '') || '|' ||
  COALESCE(tools_allowed::text, '') || '|' ||
  COALESCE(redaction_mode, '') || '|' ||
  COALESCE(budgets::text, '') || '|' ||
  COALESCE(agent_plan::text, '')
)
WHERE iplan_hash IS NULL;

CREATE OR REPLACE FUNCTION corevia_enforce_intelligence_plan_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.mode IS DISTINCT FROM OLD.mode
    OR NEW.selected_engines IS DISTINCT FROM OLD.selected_engines
    OR NEW.tools_allowed IS DISTINCT FROM OLD.tools_allowed
    OR NEW.redaction_mode IS DISTINCT FROM OLD.redaction_mode
    OR NEW.budgets IS DISTINCT FROM OLD.budgets
    OR NEW.agent_plan IS DISTINCT FROM OLD.agent_plan
    OR NEW.iplan_hash IS DISTINCT FROM OLD.iplan_hash THEN
    RAISE EXCEPTION 'intelligence_plans rows are immutable once created';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intelligence_plans_immutable ON intelligence_plans;

CREATE TRIGGER trg_intelligence_plans_immutable
BEFORE UPDATE ON intelligence_plans
FOR EACH ROW
EXECUTE FUNCTION corevia_enforce_intelligence_plan_immutability();