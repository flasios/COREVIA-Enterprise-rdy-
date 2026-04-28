import type { ToolSpec } from "./aiAssistantService.types";

// Agentic AI System Prompt - Conversational & Human-like
export const getSystemPrompt = (userName: string = 'there', isFirstMessage: boolean = false) => `You are COREVIA, a friendly British AI advisor with FULL SYSTEM AWARENESS. You're warm, conversational, and CONCISE - like chatting with a trusted senior colleague from a prestigious London consultancy.

User: ${userName}

${isFirstMessage ? `Greet warmly: "Hello ${userName}! I'm COREVIA, your Strategic Intelligence Advisor. Delighted to assist you today."` : `DO NOT greet again. Just respond naturally like a friend continuing a chat.`}

## CRITICAL: Response Protocol (MUST FOLLOW)
1. Keep responses SHORT - maximum 2-3 sentences
2. Give the key insight or number FIRST
3. ALWAYS end with a question like "Shall I tell you more?" or "Would you like details?"
4. WAIT for user to say yes before elaborating
5. Never dump all information at once - have a conversation!

## Example Responses (Follow This Style):
- "Right, we've got 5 projects running - 3 on track, 2 need attention. Shall I tell you about the ones needing attention?"
- "Spotted 2 issues in the portfolio - one budget overrun, one delay. Want me to go through them?"
- "All looking rather good today! No critical alerts. Anything specific you'd like me to check?"
- "Brilliant - the business case shows a TCO of AED 2.5M with a 3-year payback. Shall I break down the CAPEX and OPEX?"

## Your Personality
- British and warm - use "Right", "Lovely", "Brilliant", "Shall we", "Rather", "Quite right", "Splendid"
- Talk like a human friend, not a report generator
- Be helpful but BRIEF
- Ask follow-up questions to understand what they need
- Respect their time - don't over-explain

## Your Capabilities (Full System Awareness)
You have access to the ENTIRE system across all project phases (initiation, planning, execution, monitoring, closure):
- **Portfolio & Projects**: Health status, progress, budgets, timelines, resources
- **Demands**: Business objectives, requirements, stakeholders, strategic alignment
- **Business Cases**: TCO breakdown (CAPEX/OPEX/Maintenance), ROI, NPV, payback periods
- **WBS & Tasks**: Phases, durations, resources, dependencies, critical path, schedules
- **Cost Analysis**: Budget utilization, variances, savings opportunities, cost optimization
- **Strategic Fit**: UAE Vision 2071 alignment, strategic objectives, implementation routes
- **Knowledge Base**: Policies, procedures, standards, guidelines via RAG search
- **Specialized Agents**: Finance, Security, Technical, Business domain experts

Use the appropriate tools to retrieve real data. Never make up numbers.

## Tools Available
Use tools proactively to get accurate data, but SUMMARIZE results in 1-2 sentences max. Never show raw data or JSON.

Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

// Define tools Coveria can use
export const AGENT_TOOLS: ToolSpec[] = [
  {
    name: "get_system_overview",
    description: "Get a complete overview of the system including all demands, projects, and key metrics. Use this to understand the current state.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "search_demands",
    description: "Search for specific demands by status, department, urgency, or keywords.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by workflow status (generated, acknowledged, under_review, approved, rejected, deferred)" },
        urgency: { type: "string", description: "Filter by urgency (Low, Medium, High, Critical)" },
        department: { type: "string", description: "Filter by department name" },
        keyword: { type: "string", description: "Search in business objective" }
      },
      required: []
    }
  },
  {
    name: "search_projects",
    description: "Search for specific projects by status, phase, health, or keywords.",
    input_schema: {
      type: "object" as const,
      properties: {
        healthStatus: { type: "string", description: "Filter by health (on_track, at_risk, critical, blocked)" },
        phase: { type: "string", description: "Filter by phase (intake, planning, execution, monitoring, closure)" },
        keyword: { type: "string", description: "Search in project name" }
      },
      required: []
    }
  },
  {
    name: "create_task",
    description: "Create a new task for the user or assign to someone.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Task priority" },
        dueDate: { type: "string", description: "Due date in ISO format" }
      },
      required: ["title"]
    }
  },
  {
    name: "create_reminder",
    description: "Set a reminder for the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Reminder message" },
        remindAt: { type: "string", description: "When to remind (ISO date or relative like 'tomorrow 9am')" }
      },
      required: ["message", "remindAt"]
    }
  },
  {
    name: "generate_status_report",
    description: "Generate a formatted status report for projects or demands.",
    input_schema: {
      type: "object" as const,
      properties: {
        reportType: { type: "string", enum: ["executive_summary", "project_health", "demand_pipeline", "budget_overview", "risk_analysis"], description: "Type of report to generate" },
        projectId: { type: "string", description: "Optional: specific project ID for detailed report" }
      },
      required: ["reportType"]
    }
  },
  {
    name: "analyze_risks",
    description: "Analyze and identify risks across the portfolio.",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", enum: ["all", "critical_only", "budget", "timeline", "resources"], description: "Scope of risk analysis" }
      },
      required: []
    }
  },
  {
    name: "send_notification",
    description: "Send a notification or alert to users.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification message" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Notification priority" }
      },
      required: ["title", "message"]
    }
  },
  {
    name: "detect_anomalies",
    description: "Proactively scan the entire portfolio for problems - budget overruns, schedule delays, stalled items, critical health issues. Returns prioritized list of anomalies with suggested actions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "predict_risks",
    description: "Calculate AI-powered risk scores for all projects. Predicts which projects are likely to fail based on health status, budget utilization, timeline pressure, and execution phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        minRiskLevel: { type: "string", enum: ["all", "medium", "high", "critical"], description: "Minimum risk level to include in results" }
      },
      required: []
    }
  },
  {
    name: "generate_daily_briefing",
    description: "Generate a comprehensive intelligence briefing with executive summary, critical alerts, top risks, key metrics, recommendations, and action items.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "execute_workflow",
    description: "Execute a multi-step automated workflow. Can chain multiple actions together like detecting anomalies, creating tasks, and sending notifications in sequence.",
    input_schema: {
      type: "object" as const,
      properties: {
        steps: {
          type: "array",
          description: "Array of workflow steps to execute",
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["detect_anomalies", "calculate_risks", "create_task", "send_notification", "generate_briefing"], description: "Action to perform" },
              params: { type: "object", description: "Parameters for the action" }
            }
          }
        }
      },
      required: ["steps"]
    }
  },
  {
    name: "auto_generate_alerts",
    description: "Automatically scan for critical issues and generate alerts/notifications for each one found. Use this to proactively notify stakeholders of problems.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "get_business_case_details",
    description: "Get detailed business case information including TCO breakdown (CAPEX/OPEX/Maintenance), budget estimates, implementation costs, operational costs, requirements, strategic fit analysis, and financial metrics like ROI, NPV, and payback period.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand ID to get business case for" },
        projectId: { type: "string", description: "The project ID to get business case for" }
      },
      required: []
    }
  },
  {
    name: "get_wbs_details",
    description: "Get Work Breakdown Structure details including all tasks, phases, durations, resources, dependencies, costs, and schedule information for a project.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID to get WBS for" },
        includeResources: { type: "boolean", description: "Include resource allocation details" },
        includeCosts: { type: "boolean", description: "Include cost breakdown per task" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "analyze_cost_optimization",
    description: "Analyze costs and identify potential savings opportunities. Provides recommendations for cost reduction, budget optimization, resource efficiency, and identifies areas of overspend or waste.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "Specific project ID to analyze, or leave empty for portfolio-wide analysis" },
        focusArea: { type: "string", enum: ["all", "capex", "opex", "resources", "timeline", "vendors"], description: "Area to focus cost optimization on" }
      },
      required: []
    }
  },
  {
    name: "get_demand_details",
    description: "Get comprehensive demand details including business objective, requirements analysis, strategic fit, stakeholders, risks, and all associated documents and assessments.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand ID to get details for" }
      },
      required: ["demandId"]
    }
  },
  {
    name: "get_phase_insights",
    description: "Get insights and recommendations for a specific project phase (initiation, planning, execution, monitoring, closure). Includes phase-specific metrics, risks, and suggested actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID to analyze" },
        phase: { type: "string", enum: ["initiation", "planning", "execution", "monitoring", "closure"], description: "The phase to get insights for" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "search_knowledge_base",
    description: "Search the knowledge base using RAG (Retrieval-Augmented Generation). Finds relevant policies, procedures, standards, guidelines, and organizational knowledge. Use this for questions about UAE government regulations, digital transformation strategies, procurement rules, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query or question to answer" },
        category: { type: "string", enum: ["all", "policies", "procedures", "standards", "guidelines", "templates", "legal"], description: "Category to search within" }
      },
      required: ["query"]
    }
  },
  {
    name: "consult_specialized_agents",
    description: "Consult specialized domain agents for expert analysis. Agents available: finance (budgets, ROI, TCO, costs), security (compliance, risks, cybersecurity), technical (architecture, integration, scalability), business (strategy, stakeholders, UAE Vision 2071).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The question or analysis request" },
        agents: { 
          type: "array", 
          items: { type: "string", enum: ["finance", "security", "technical", "business"] },
          description: "Which specialized agents to consult (can be multiple)" 
        },
        demandId: { type: "string", description: "Optional demand ID for context" },
        projectId: { type: "string", description: "Optional project ID for context" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_project_workspace",
    description: "Get COMPLETE project workspace data including all phases, milestones, KPIs, risks, tasks, costs, timeline, resources, and deliverables. Use this for comprehensive project analysis covering initiation, planning, execution, monitoring, and closure phases.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID to get full workspace data for" },
        includePhases: { type: "boolean", description: "Include all phase details with entry/exit conditions" },
        includeMilestones: { type: "boolean", description: "Include all project milestones" },
        includeRisks: { type: "boolean", description: "Include risk register" },
        includeKpis: { type: "boolean", description: "Include KPI metrics" },
        includeTasks: { type: "boolean", description: "Include WBS tasks" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "get_gate_readiness",
    description: "Get the Quantum Gate readiness status for a project. Shows phase transition readiness, critical checks passed/failed, blockers preventing transition, and recommendations. Use this to brief on project phase governance and approval status.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID to check gate readiness for" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "request_gate_approval",
    description: "Submit a gate approval request for PMO review to transition a project to the next phase. Only use when the gate readiness score is sufficient and user explicitly requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID to request gate approval for" },
        userId: { type: "string", description: "The user ID of the person requesting approval" }
      },
      required: ["projectId", "userId"]
    }
  },
  {
    name: "search_decision_knowledge_graph",
    description: "Search the AI Decision Knowledge Graph for related decisions, patterns, and contextual recommendations. Use this to find similar past decisions, understand decision patterns, and get AI-powered insights based on historical decision outcomes.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query to find related decisions (e.g., 'smart city infrastructure', 'digital transformation', 'procurement optimization')" },
        limit: { type: "number", description: "Maximum number of related decisions to return (default: 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_decision_explanation",
    description: "Get SHAP-style explainability breakdown for a decision text. Shows what factors positively or negatively influence the predicted success of a decision, with detailed feature contributions.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The decision text or proposal to analyze (e.g., 'Implement smart traffic management system with AI sensors for urban mobility')" }
      },
      required: ["text"]
    }
  },
  {
    name: "get_ai_health_status",
    description: "Get the current health status of the AI Intelligence Engine including accuracy trends, active alerts, and system performance metrics. Use this to brief on AI system health and any issues that need attention.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },

  // ── PMO ACTION TOOLS (real DB mutations) ─────────────────────────────────
  {
    name: "approve_demand",
    description: "Approve a demand request and advance its workflow status to manager_approved. Use this when the PMO officer decides to approve a demand after review. Records the decision with justification.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand UUID to approve" },
        justification: { type: "string", description: "Approval justification or decision notes (required for audit trail)" }
      },
      required: ["demandId", "justification"]
    }
  },
  {
    name: "reject_demand",
    description: "Reject a demand request with a category and reason. Use this when the PMO officer decides to reject a demand. Records the rejection with mandatory justification.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand UUID to reject" },
        reason: { type: "string", description: "Clear reason for rejection (required)" },
        category: { type: "string", enum: ["Budget", "Resource", "Strategic", "Technical", "Timeline", "Duplicate", "OutOfScope"], description: "Rejection category for classification" }
      },
      required: ["demandId", "reason", "category"]
    }
  },
  {
    name: "defer_demand",
    description: "Defer a demand to a future date for re-evaluation. Use when a demand has merit but conditions aren't right yet.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand UUID to defer" },
        deferUntil: { type: "string", description: "ISO date string for when to re-evaluate (e.g. '2026-07-01')" },
        reason: { type: "string", description: "Reason for deferral" }
      },
      required: ["demandId", "deferUntil", "reason"]
    }
  },
  {
    name: "acknowledge_demand",
    description: "Acknowledge a new demand, moving it from 'generated' to 'acknowledged' status. This signals the PMO has received and is reviewing the demand.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandId: { type: "string", description: "The demand UUID to acknowledge" },
        note: { type: "string", description: "Optional acknowledgment note to the requestor" }
      },
      required: ["demandId"]
    }
  },
  {
    name: "update_project_health",
    description: "Update the health status of a project and record the reason. Use this when a project's situation changes (e.g., from on_track to at_risk due to a discovered blocker).",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The portfolio project UUID" },
        healthStatus: { type: "string", enum: ["on_track", "at_risk", "critical", "blocked"], description: "New health status" },
        reason: { type: "string", description: "Reason for the health status change (required for audit)" },
        riskScore: { type: "number", description: "Optional updated risk score 0-100" }
      },
      required: ["projectId", "healthStatus", "reason"]
    }
  },
  {
    name: "escalate_project",
    description: "Escalate a project as critical — sends urgent notifications, creates a PMO intervention task, and flags the project health to critical. Use when a project needs immediate executive attention.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The portfolio project UUID to escalate" },
        escalationReason: { type: "string", description: "Description of why escalation is needed" },
        urgency: { type: "string", enum: ["high", "urgent"], description: "Escalation urgency level", default: "urgent" }
      },
      required: ["projectId", "escalationReason"]
    }
  },
  {
    name: "bulk_approve_demands",
    description: "Approve multiple demands in one action. Use when the PMO wants to batch-process a group of demands that all meet approval criteria.",
    input_schema: {
      type: "object" as const,
      properties: {
        demandIds: { type: "array", items: { type: "string" }, description: "Array of demand UUIDs to approve" },
        justification: { type: "string", description: "Batch approval justification" }
      },
      required: ["demandIds", "justification"]
    }
  },
  {
    name: "get_pending_approvals",
    description: "Get all demands currently awaiting PMO decision — includes under_review, acknowledged, and generated statuses. Sorted by urgency and age. Essential for daily PMO workflow.",
    input_schema: {
      type: "object" as const,
      properties: {
        urgencyFilter: { type: "string", enum: ["all", "Critical", "High", "Medium", "Low"], description: "Filter by urgency level", default: "all" },
        limitDays: { type: "number", description: "Only show demands older than N days (to surface stalled items)" }
      },
      required: []
    }
  },
  {
    name: "add_project_note",
    description: "Add a PMO note or recommendation to a project record. Use this to log interventions, decisions, and observations directly into the project.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The portfolio project UUID" },
        note: { type: "string", description: "Note or recommendation to add" },
        noteType: { type: "string", enum: ["observation", "recommendation", "decision", "risk_flag", "intervention"], description: "Type of note" }
      },
      required: ["projectId", "note", "noteType"]
    }
  },
  {
    name: "generate_governance_report",
    description: "Generate a PMO governance report covering demand pipeline health, project portfolio status, overdue approvals, SLA compliance, and recommendations. Suitable for executive presentations.",
    input_schema: {
      type: "object" as const,
      properties: {
        format: { type: "string", enum: ["executive_brief", "detailed", "sla_focus", "risk_focus"], description: "Report format and focus area" }
      },
      required: []
    }
  },

  // ── Document Export Tools ─────────────────────────────────────────────────
  {
    name: "export_pdf_report",
    description: "Generate and export a real PDF report file that the user can download. Can produce: portfolio status PDF, demand pipeline PDF, risk analysis PDF, governance brief PDF, or custom executive report. Always call this when the user asks for a PDF, report to download, or document export.",
    input_schema: {
      type: "object" as const,
      properties: {
        reportType: {
          type: "string",
          enum: ["portfolio_status", "demand_pipeline", "risk_analysis", "governance_brief", "executive_summary", "project_detail"],
          description: "Type of PDF report to generate"
        },
        title: { type: "string", description: "Custom title for the report (optional, auto-generated if not provided)" },
        projectId: { type: "string", description: "Specific project ID for project_detail report" },
        dateRange: { type: "string", description: "Date range label for the report (e.g. 'April 2026')" }
      },
      required: ["reportType"]
    }
  },
  {
    name: "export_excel_report",
    description: "Generate and export a real Excel (.xlsx) file that the user can download. Can produce multi-sheet workbooks with: demand list, project portfolio, budget analysis, risk register, or combined dashboard. Always call this when the user asks for Excel, spreadsheet, data export, or .xlsx.",
    input_schema: {
      type: "object" as const,
      properties: {
        reportType: {
          type: "string",
          enum: ["demand_list", "project_portfolio", "budget_analysis", "risk_register", "combined_dashboard"],
          description: "Type of Excel workbook to generate"
        },
        title: { type: "string", description: "Workbook title / filename prefix" },
        filterStatus: { type: "string", description: "Optional: filter data by status (e.g. 'under_review', 'critical')" }
      },
      required: ["reportType"]
    }
  },
  {
    name: "deep_analyze",
    description: "Perform a deep multi-step analysis using extended reasoning. Use this for complex questions that require: synthesizing data from multiple sources, causal analysis, what-if scenarios, strategic recommendations, or root-cause investigation. This runs slower but produces more thorough, structured insights than a normal answer.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: { type: "string", description: "The complex question or analysis request" },
        focus: {
          type: "string",
          enum: ["portfolio_health", "demand_governance", "budget_optimization", "risk_mitigation", "strategic_alignment", "capacity_planning"],
          description: "Analysis domain to focus on"
        },
        includeRecommendations: { type: "boolean", description: "Whether to include actionable recommendations (default: true)" }
      },
      required: ["question"]
    }
  }
];
