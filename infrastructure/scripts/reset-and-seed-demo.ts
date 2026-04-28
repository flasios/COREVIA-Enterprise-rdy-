/**
 * COREVIA Demo Reset & Seed Script
 *
 * 1. Wipes all work data (projects, demands, risks, chat, notifications, audit logs)
 *    while preserving the super admin user account.
 * 2. Creates 25 demo user accounts across all available roles.
 * 3. Creates 4 teams with meaningful names and assigns users to each.
 *
 * Run:
 *   npx tsx infrastructure/scripts/reset-and-seed-demo.ts
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../../platform/db";
import { users, teams, teamMembers } from "@shared/schema";
import { BcryptPasswordHasher } from "../../domains/identity/infrastructure/passwordHasher";
import { SUPERADMIN_USER_ID } from "../../platform/notifications";

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[reset-seed] ${msg}`);
}

// ── Step 1: Wipe all work data ─────────────────────────────────────────────

async function wipeWorkData() {
  log("Wiping work data (preserving super admin)...");

  // Order matters — delete leaf tables first to respect FK constraints
  const tablesToWipe: string[] = [
    // Agile
    "agile_work_item_comments",
    "agile_work_items",
    "agile_epics",
    "agile_sprints",
    "agile_project_members",
    // Portfolio
    "task_evidence",
    "wbs_approvals",
    "wbs_versions",
    "wbs_tasks",
    "project_change_requests",
    "project_documents",
    "project_communications",
    "project_stakeholders",
    "risk_evidence",
    "project_risks",
    "project_issues",
    "project_approvals",
    "project_gates",
    "phase_history",
    "project_kpis",
    "project_milestones",
    "project_phases",
    "portfolio_projects",
    // Demand / business cases
    "branch_merges",
    "version_branches",
    "section_assignments",
    "version_activity",
    "version_audit_logs",
    "report_versions",
    "demand_conversion_requests",
    "business_cases",
    "demand_reports",
    // Teams (will be re-created by seed)
    "team_members",
    "teams",
    // Operations
    "procurement_payments",
    "procurement_items",
    "cost_entries",
    // Intelligence / compliance
    "tender_sla_assignments",
    "tender_notifications",
    "tender_alerts",
    "tender_packages",
    "synergy_opportunities",
    "innovation_recommendations",
    "portfolio_recommendations",
    "portfolio_runs",
    "agent_feedback",
    // Chat & notifications
    "chat_channel_members",
    "chat_messages",
    "chat_channels",
    "notifications",
    // Audit logs
    "audit_logs",
  ];

  for (const table of tablesToWipe) {
    try {
      await db.execute(sql.raw(`DELETE FROM "${table}"`));
      log(`  cleared: ${table}`);
    } catch {
      log(`  skipped (does not exist or already empty): ${table}`);
    }
  }

  // Delete all users EXCEPT super admin
  await db.execute(
    sql`DELETE FROM "users" WHERE id != ${SUPERADMIN_USER_ID}`
  );
  log("  cleared: users (kept super admin)");
  log("Wipe complete.");
}

// ── Step 2: Create 25 demo users ───────────────────────────────────────────

const hasher = new BcryptPasswordHasher();
const DEFAULT_PASSWORD = "Corevia@2025!";

interface DemoUser {
  username: string;
  email: string;
  displayName: string;
  role: string;
  department: string;
  customPermissions?: {
    enabled?: string[];
    disabled?: string[];
  };
}

const demoUsers: DemoUser[] = [
  // Directors (4)
  {
    username: "layla.hassan",
    email: "layla.hassan@corevia.demo",
    displayName: "Layla Hassan",
    role: "director",
    department: "Strategy & Governance",
    customPermissions: {
      disabled: [
        "knowledge:read",
        "requirements:generate",
        "integration:hub:view",
      ],
    },
  },
  {
    username: "omar.al-rashid",
    email: "omar.al-rashid@corevia.demo",
    displayName: "Omar Al-Rashid",
    role: "pmo_director",
    department: "Project Management Office",
  },
  {
    username: "sara.ibrahim",
    email: "sara.ibrahim@corevia.demo",
    displayName: "Sara Ibrahim",
    role: "financial_director",
    department: "Finance & Budgeting",
  },
  {
    username: "khalid.mansoor",
    email: "khalid.mansoor@corevia.demo",
    displayName: "Khalid Mansoor",
    role: "director",
    department: "Digital Transformation",
  },
  // Project Managers (5)
  {
    username: "fatima.al-zahrawi",
    email: "fatima.al-zahrawi@corevia.demo",
    displayName: "Fatima Al-Zahrawi",
    role: "project_manager",
    department: "Project Management Office",
  },
  {
    username: "ahmed.nouri",
    email: "ahmed.nouri@corevia.demo",
    displayName: "Ahmed Nouri",
    role: "project_manager",
    department: "Project Management Office",
  },
  {
    username: "noor.saleh",
    email: "noor.saleh@corevia.demo",
    displayName: "Noor Saleh",
    role: "project_manager",
    department: "Infrastructure",
  },
  {
    username: "hassan.al-farsi",
    email: "hassan.al-farsi@corevia.demo",
    displayName: "Hassan Al-Farsi",
    role: "portfolio_manager",
    department: "Project Management Office",
  },
  {
    username: "reem.yusuf",
    email: "reem.yusuf@corevia.demo",
    displayName: "Reem Yusuf",
    role: "project_manager",
    department: "Digital Services",
  },
  // Business Analysts (4)
  {
    username: "maryam.al-shehhi",
    email: "maryam.al-shehhi@corevia.demo",
    displayName: "Maryam Al-Shehhi",
    role: "business_analyst",
    department: "Demand & Strategy",
  },
  {
    username: "tariq.bin-laden",
    email: "tariq.binladen@corevia.demo",
    displayName: "Tariq Bin Laden",
    role: "business_analyst",
    department: "Demand & Strategy",
  },
  {
    username: "hana.al-blooshi",
    email: "hana.al-blooshi@corevia.demo",
    displayName: "Hana Al-Blooshi",
    role: "pmo_analyst",
    department: "Project Management Office",
  },
  {
    username: "yousef.khoury",
    email: "yousef.khoury@corevia.demo",
    displayName: "Yousef Khoury",
    role: "data_analyst",
    department: "Data & Intelligence",
  },
  // Technical (4)
  {
    username: "ali.al-hamdan",
    email: "ali.al-hamdan@corevia.demo",
    displayName: "Ali Al-Hamdan",
    role: "technical_analyst",
    department: "Engineering",
  },
  {
    username: "dina.mahmoud",
    email: "dina.mahmoud@corevia.demo",
    displayName: "Dina Mahmoud",
    role: "infrastructure_engineer",
    department: "Infrastructure",
  },
  {
    username: "ziad.al-amin",
    email: "ziad.al-amin@corevia.demo",
    displayName: "Ziad Al-Amin",
    role: "technical_analyst",
    department: "Engineering",
  },
  {
    username: "lina.nasser",
    email: "lina.nasser@corevia.demo",
    displayName: "Lina Nasser",
    role: "qa_analyst",
    department: "Quality Assurance",
  },
  // Security & Compliance (3)
  {
    username: "sultan.al-mazrouei",
    email: "sultan.al-mazrouei@corevia.demo",
    displayName: "Sultan Al-Mazrouei",
    role: "security_analyst",
    department: "Cybersecurity",
  },
  {
    username: "abeer.al-jaber",
    email: "abeer.al-jaber@corevia.demo",
    displayName: "Abeer Al-Jaber",
    role: "compliance_analyst",
    department: "Governance & Compliance",
  },
  {
    username: "fahad.bin-salman",
    email: "fahad.bin-salman@corevia.demo",
    displayName: "Fahad Bin Salman",
    role: "security_analyst",
    department: "Cybersecurity",
  },
  // Finance (2)
  {
    username: "wafa.al-hashimi",
    email: "wafa.al-hashimi@corevia.demo",
    displayName: "Wafa Al-Hashimi",
    role: "finance_analyst",
    department: "Finance & Budgeting",
  },
  {
    username: "ibrahim.al-nuaimi",
    email: "ibrahim.al-nuaimi@corevia.demo",
    displayName: "Ibrahim Al-Nuaimi",
    role: "finance_analyst",
    department: "Finance & Budgeting",
  },
  // Procurement (1)
  {
    username: "mariam.al-ketbi",
    email: "mariam.al-ketbi@corevia.demo",
    displayName: "Mariam Al-Ketbi",
    role: "tender_manager",
    department: "Procurement",
  },
  // Managers / Specialists (2)
  {
    username: "jasim.al-mansoori",
    email: "jasim.al-mansoori@corevia.demo",
    displayName: "Jasim Al-Mansoori",
    role: "manager",
    department: "Operations",
  },
  {
    username: "sheikha.al-shamsi",
    email: "sheikha.al-shamsi@corevia.demo",
    displayName: "Sheikha Al-Shamsi",
    role: "specialist",
    department: "Digital Transformation",
  },
];

async function createUsers(): Promise<Map<string, string>> {
  log(`Creating ${demoUsers.length} demo users (password: ${DEFAULT_PASSWORD})...`);
  const hashedPwd = await hasher.hash(DEFAULT_PASSWORD);
  const userIdMap = new Map<string, string>();

  for (const u of demoUsers) {
    const [created] = await db
      .insert(users)
      .values({
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        role: u.role as Parameters<typeof db.insert>[0] extends unknown ? string : never,
        department: u.department,
        customPermissions: u.customPermissions ?? null,
        password: hashedPwd,
        isActive: true,
      })
      .returning({ id: users.id });
    userIdMap.set(u.username, created!.id);
    log(`  created: ${u.displayName} (${u.role}) — ${u.email}`);
  }

  log(`Users created: ${demoUsers.length}`);
  return userIdMap;
}

// ── Step 3: Create 4 teams ─────────────────────────────────────────────────

async function createTeams(userIdMap: Map<string, string>) {
  log("Creating 4 teams...");

  // We need a valid createdBy user — use the first director
  const layla = userIdMap.get("layla.hassan")!;
  const omar = userIdMap.get("omar.al-rashid")!;
  const _sara = userIdMap.get("sara.ibrahim")!;
  const sultan = userIdMap.get("sultan.al-mazrouei")!;

  const teamDefs = [
    {
      name: "Executive Leadership",
      description: "C-suite directors and executive sponsors responsible for strategic governance and portfolio oversight.",
      color: "#7C3AED",
      createdBy: layla,
      members: [
        { username: "layla.hassan", role: "lead" as const },
        { username: "omar.al-rashid", role: "lead" as const },
        { username: "sara.ibrahim", role: "lead" as const },
        { username: "khalid.mansoor", role: "lead" as const },
      ],
    },
    {
      name: "PMO & Delivery",
      description: "Project managers and PMO analysts who plan, execute, and govern project delivery across the portfolio.",
      color: "#2563EB",
      createdBy: omar,
      members: [
        { username: "fatima.al-zahrawi", role: "lead" as const },
        { username: "ahmed.nouri", role: "member" as const },
        { username: "noor.saleh", role: "member" as const },
        { username: "hassan.al-farsi", role: "lead" as const },
        { username: "reem.yusuf", role: "member" as const },
        { username: "hana.al-blooshi", role: "member" as const },
        { username: "jasim.al-mansoori", role: "member" as const },
      ],
    },
    {
      name: "Business Analysis & Intelligence",
      description: "Business analysts, data analysts, and domain specialists who drive demand analysis, business case development, and intelligence insights.",
      color: "#059669",
      createdBy: layla,
      members: [
        { username: "maryam.al-shehhi", role: "lead" as const },
        { username: "tariq.bin-laden", role: "member" as const },
        { username: "yousef.khoury", role: "member" as const },
        { username: "wafa.al-hashimi", role: "member" as const },
        { username: "ibrahim.al-nuaimi", role: "member" as const },
        { username: "mariam.al-ketbi", role: "member" as const },
        { username: "sheikha.al-shamsi", role: "member" as const },
      ],
    },
    {
      name: "Technology, Security & Compliance",
      description: "Technical analysts, engineers, security specialists, and compliance officers ensuring robust, secure, and compliant delivery.",
      color: "#DC2626",
      createdBy: sultan,
      members: [
        { username: "ali.al-hamdan", role: "lead" as const },
        { username: "dina.mahmoud", role: "member" as const },
        { username: "ziad.al-amin", role: "member" as const },
        { username: "lina.nasser", role: "member" as const },
        { username: "sultan.al-mazrouei", role: "lead" as const },
        { username: "abeer.al-jaber", role: "member" as const },
        { username: "fahad.bin-salman", role: "member" as const },
        { username: "sara.ibrahim", role: "member" as const }, // Financial director as advisory member
      ],
    },
  ];

  for (const t of teamDefs) {
    const [created] = await db
      .insert(teams)
      .values({
        name: t.name,
        description: t.description,
        color: t.color,
        createdBy: t.createdBy,
      })
      .returning({ id: teams.id });

    const teamId = created!.id;
    log(`  created team: "${t.name}" (${teamId})`);

    for (const m of t.members) {
      const userId = userIdMap.get(m.username);
      if (!userId) {
        log(`    WARNING: user ${m.username} not found, skipping`);
        continue;
      }
      await db.insert(teamMembers).values({
        teamId,
        userId,
        role: m.role,
        addedBy: t.createdBy,
      });
      log(`    + ${m.username} [${m.role}]`);
    }
  }

  log("Teams created.");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("=== COREVIA Demo Reset & Seed ===");
  log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);
  log("");

  try {
    await wipeWorkData();
    log("");
    const userIdMap = await createUsers();
    log("");
    await createTeams(userIdMap);
    log("");
    log("=== Done ===");
    log(`  Users created : ${demoUsers.length}`);
    log(`  Teams created : 4`);
    log(`  Default password: ${DEFAULT_PASSWORD}`);
    log("");
    log("Super admin account preserved — reset password with: npm run admin:create");
  } catch (err) {
    console.error("[reset-seed] FAILED:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
