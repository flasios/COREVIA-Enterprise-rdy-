-- COREVIA System Data Cleanup Script
-- This script wipes all work data while preserving the super admin account
-- Run this against your PostgreSQL database

-- Order matters — delete leaf tables first to respect FK constraints

-- Agile tables
DELETE FROM "agile_work_item_comments";
DELETE FROM "agile_work_items";
DELETE FROM "agile_epics";
DELETE FROM "agile_sprints";
DELETE FROM "agile_project_members";

-- Portfolio tables
DELETE FROM "task_evidence";
DELETE FROM "wbs_approvals";
DELETE FROM "wbs_versions";
DELETE FROM "wbs_tasks";
DELETE FROM "project_change_requests";
DELETE FROM "project_documents";
DELETE FROM "project_communications";
DELETE FROM "project_stakeholders";
DELETE FROM "risk_evidence";
DELETE FROM "project_risks";
DELETE FROM "project_issues";
DELETE FROM "project_approvals";
DELETE FROM "project_gates";
DELETE FROM "phase_history";
DELETE FROM "project_kpis";
DELETE FROM "project_milestones";
DELETE FROM "project_phases";
DELETE FROM "portfolio_projects";

-- Demand / business cases
DELETE FROM "branch_merges";
DELETE FROM "version_branches";
DELETE FROM "section_assignments";
DELETE FROM "version_activity";
DELETE FROM "version_audit_logs";
DELETE FROM "report_versions";
DELETE FROM "demand_conversion_requests";
DELETE FROM "business_cases";
DELETE FROM "demand_reports";

-- Teams (will be re-created by seed)
DELETE FROM "team_members";
DELETE FROM "teams";

-- Operations
DELETE FROM "procurement_payments";
DELETE FROM "procurement_items";
DELETE FROM "cost_entries";

-- Intelligence / compliance
DELETE FROM "tender_sla_assignments";
DELETE FROM "tender_notifications";
DELETE FROM "tender_alerts";
DELETE FROM "tender_packages";
DELETE FROM "synergy_opportunities";
DELETE FROM "innovation_recommendations";
DELETE FROM "portfolio_recommendations";
DELETE FROM "portfolio_runs";
DELETE FROM "agent_feedback";

-- Chat & notifications
DELETE FROM "chat_channel_members";
DELETE FROM "chat_messages";
DELETE FROM "chat_channels";
DELETE FROM "notifications";

-- Audit logs
DELETE FROM "audit_logs";

-- Delete all users EXCEPT super admin (assuming super admin ID is known)
-- You'll need to replace 'SUPER_ADMIN_ID_HERE' with the actual super admin user ID
-- DELETE FROM "users" WHERE id != 'SUPER_ADMIN_ID_HERE';

-- Alternative: If you want to keep a specific user, uncomment and modify:
-- DELETE FROM "users" WHERE id != 'your-super-admin-id-here';

COMMIT;