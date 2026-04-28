import { db } from "@platform/db";
import { businessCases, demandReports, portfolioProjects, users } from "@shared/schema";
import type { User } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateBrainDraftArtifact } from "@domains/intelligence/application";
import { logger } from "@platform/logging/Logger";

interface TeamRole {
  role: string;
  count: number;
  duration: string;
  priority: "critical" | "high" | "medium" | "optional";
  skills: string[];
  experienceLevel: "junior" | "mid" | "senior" | "expert";
  estimatedFTEMonths: number;
  responsibilities: string[];
  availability: "available" | "limited" | "unavailable" | "unknown";
  availableCount?: number;
  gapCount?: number;
}

interface ExternalResource {
  type: string;
  description: string;
  priority: "critical" | "high" | "medium" | "optional";
  estimatedCost?: string;
  alternatives?: string[];
}

interface EquipmentResource {
  name: string;
  quantity: number;
  priority: "critical" | "high" | "medium" | "optional";
  availability: "available" | "procurement_needed" | "unavailable";
  leadTime?: string;
}

interface ResourceGap {
  type: "personnel" | "external" | "equipment";
  name: string;
  gapSize: number | string;
  impact: "critical" | "high" | "medium" | "low";
  recommendations: string[];
  riskLevel: "high" | "medium" | "low";
}

interface TeamRecommendation {
  projectId: string;
  projectName: string;
  generatedAt: string;
  summary: {
    totalRoles: number;
    totalHeadcount: number;
    totalFTEMonths: number;
    criticalRoles: number;
    resourceGaps: number;
    overallReadiness: "ready" | "needs_attention" | "critical_gaps";
  };
  teamStructure: {
    leadership: TeamRole[];
    core: TeamRole[];
    support: TeamRole[];
    external: ExternalResource[];
    equipment: EquipmentResource[];
  };
  resourceGaps: ResourceGap[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    contingency: string[];
  };
  riskAssessment: {
    overallRisk: "low" | "medium" | "high" | "critical";
    factors: Array<{
      factor: string;
      risk: "low" | "medium" | "high";
      mitigation: string;
    }>;
  };
}

export async function generateTeamRecommendation(projectId: string): Promise<TeamRecommendation> {
  // Fetch project data
  const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, projectId));
  if (!project) {
    throw new Error("Project not found");
  }

  // Fetch business case
  const [businessCase] = await db
    .select()
    .from(businessCases)
    .where(eq(businessCases.demandReportId, project.demandReportId || ""));

  // Fetch demand report
  const [demandReport] = project.demandReportId
    ? await db.select().from(demandReports).where(eq(demandReports.id, project.demandReportId))
    : [null];

  // Fetch available resources (users in the system)
  const availableUsers = await db
    .select()
    .from(users);

  // Build context for AI
  const projectContext = {
    projectName: project.projectName,
    projectType: project.projectType,
    description: project.projectDescription,
    totalBudget: project.approvedBudget,
    timeline: {
      startDate: project.plannedStartDate,
      endDate: project.plannedEndDate,
    },
    priority: project.priority,
    currentPhase: project.currentPhase,
    healthStatus: project.healthStatus,
  };

  const businessCaseContext = businessCase
    ? {
        executiveSummary: businessCase.executiveSummary,
        scope: businessCase.scopeDefinition,
        implementationPhases: businessCase.implementationPhases,
        timeline: businessCase.timeline,
        resourceRequirements: businessCase.resourceRequirements,
        totalCost: businessCase.totalCostEstimate,
        riskLevel: businessCase.riskLevel,
        identifiedRisks: businessCase.identifiedRisks,
      }
    : null;

  const demandContext = demandReport
    ? {
        businessObjective: demandReport.businessObjective,
        expectedOutcomes: demandReport.expectedOutcomes,
        department: demandReport.department,
        estimatedBudget: demandReport.estimatedBudget,
        urgency: demandReport.urgency,
      }
    : null;

  // Count available resources by role type
  const availableResourcesByRole: Record<string, number> = {};
  availableUsers.forEach((user: User) => {
    const role = user.role || "Unknown";
    availableResourcesByRole[role] = (availableResourcesByRole[role] || 0) + 1;
  });

  const prompt = `You are an expert project resource planning AI for UAE government digital transformation projects. Analyze the following project and generate comprehensive team recommendations.

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

BUSINESS CASE:
${businessCaseContext ? JSON.stringify(businessCaseContext, null, 2) : "Not yet generated"}

DEMAND REPORT:
${demandContext ? JSON.stringify(demandContext, null, 2) : "Not available"}

AVAILABLE ORGANIZATION RESOURCES:
${JSON.stringify(availableResourcesByRole, null, 2)}
Total available staff: ${availableUsers.length}

Based on this information, generate a comprehensive team recommendation in the following JSON format. Be specific about UAE government context, Arabic language requirements, and local compliance needs.

{
  "summary": {
    "totalRoles": <number>,
    "totalHeadcount": <number>,
    "totalFTEMonths": <number>,
    "criticalRoles": <number>,
    "resourceGaps": <number>,
    "overallReadiness": "ready" | "needs_attention" | "critical_gaps"
  },
  "teamStructure": {
    "leadership": [
      {
        "role": "Role name",
        "count": <number>,
        "duration": "Full project" or "Months X-Y",
        "priority": "critical" | "high" | "medium" | "optional",
        "skills": ["skill1", "skill2"],
        "experienceLevel": "junior" | "mid" | "senior" | "expert",
        "estimatedFTEMonths": <number>,
        "responsibilities": ["responsibility1", "responsibility2"],
        "availability": "available" | "limited" | "unavailable" | "unknown",
        "availableCount": <number or null>,
        "gapCount": <number or null>
      }
    ],
    "core": [...],
    "support": [...],
    "external": [
      {
        "type": "Vendor/Contractor/Consultant",
        "description": "Description of external resource",
        "priority": "critical" | "high" | "medium" | "optional",
        "estimatedCost": "AED X,XXX - X,XXX",
        "alternatives": ["alternative1", "alternative2"]
      }
    ],
    "equipment": [
      {
        "name": "Equipment name",
        "quantity": <number>,
        "priority": "critical" | "high" | "medium" | "optional",
        "availability": "available" | "procurement_needed" | "unavailable",
        "leadTime": "X weeks/months"
      }
    ]
  },
  "resourceGaps": [
    {
      "type": "personnel" | "external" | "equipment",
      "name": "Resource name",
      "gapSize": <number or description>,
      "impact": "critical" | "high" | "medium" | "low",
      "recommendations": ["recommendation1", "recommendation2"],
      "riskLevel": "high" | "medium" | "low"
    }
  ],
  "recommendations": {
    "immediate": ["Action to take now"],
    "shortTerm": ["Action for next 2-4 weeks"],
    "contingency": ["Backup plans if resources unavailable"]
  },
  "riskAssessment": {
    "overallRisk": "low" | "medium" | "high" | "critical",
    "factors": [
      {
        "factor": "Risk factor description",
        "risk": "low" | "medium" | "high",
        "mitigation": "Mitigation strategy"
      }
    ]
  }
}

IMPORTANT GUIDELINES:
1. For UAE government projects, always include Arabic language specialists if the project has user-facing components
2. Include cybersecurity/ISR compliance roles for any project handling sensitive data
3. Consider local regulations and UAE Vision 2031/2071 alignment
4. Prioritize roles based on project phases and critical path
5. Identify gaps by comparing required roles against available organization resources
6. Provide actionable recommendations for each gap
7. Be realistic about FTE estimates based on project scope and timeline

Return ONLY valid JSON, no additional text.`;

  try {
    const artifact = await generateBrainDraftArtifact({
      decisionSpineId: `DSP-TEAMREC-${projectId}`,
      serviceId: "portfolio",
      routeKey: "team.recommendation.generate",
      artifactType: "TEAM_RECOMMENDATION",
      userId: "system",
      inputData: {
        projectId,
        projectContext,
        businessCaseContext,
        demandContext,
        availableResourcesByRole,
        totalAvailableStaff: availableUsers.length,
        instructionPrompt: prompt,
      },
    });

    const aiRecommendation = (artifact.content || {}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const result: TeamRecommendation = {
      projectId,
      projectName: project.projectName,
      generatedAt: new Date().toISOString(),
      summary: aiRecommendation.summary,
      teamStructure: aiRecommendation.teamStructure,
      resourceGaps: aiRecommendation.resourceGaps,
      recommendations: aiRecommendation.recommendations,
      riskAssessment: aiRecommendation.riskAssessment,
    };

    return result;
  } catch (error) {
    logger.error("Error generating team recommendation:", error);
    
    // Return a fallback recommendation based on existing resource requirements
    const existingRequirements = businessCase?.resourceRequirements as {
      personnel?: Array<{ role: string; count: number; duration: string }>;
      external?: string[];
      equipment?: string[];
    };

    const personnelRoles: TeamRole[] = (existingRequirements?.personnel || []).map((p) => ({
      role: p.role,
      count: p.count,
      duration: p.duration,
      priority: "high" as const,
      skills: [],
      experienceLevel: "mid" as const,
      estimatedFTEMonths: p.count * 12,
      responsibilities: [],
      availability: "unknown" as const,
    }));

    return {
      projectId,
      projectName: project.projectName,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRoles: personnelRoles.length,
        totalHeadcount: personnelRoles.reduce((sum, r) => sum + r.count, 0),
        totalFTEMonths: personnelRoles.reduce((sum, r) => sum + r.estimatedFTEMonths, 0),
        criticalRoles: personnelRoles.filter((r) => r.priority === "critical").length,
        resourceGaps: 0,
        overallReadiness: "needs_attention",
      },
      teamStructure: {
        leadership: personnelRoles.filter((r) => r.role.toLowerCase().includes("manager")),
        core: personnelRoles.filter((r) => !r.role.toLowerCase().includes("manager")),
        support: [],
        external: (existingRequirements?.external || []).map((e) => ({
          type: "Vendor",
          description: e,
          priority: "high" as const,
        })),
        equipment: (existingRequirements?.equipment || []).map((e) => ({
          name: e,
          quantity: 1,
          priority: "high" as const,
          availability: "procurement_needed" as const,
        })),
      },
      resourceGaps: [],
      recommendations: {
        immediate: ["Review and validate AI-generated team recommendations"],
        shortTerm: ["Identify internal resources that can fill required roles"],
        contingency: ["Prepare procurement process for external resources"],
      },
      riskAssessment: {
        overallRisk: "medium",
        factors: [
          {
            factor: "Resource availability uncertainty",
            risk: "medium",
            mitigation: "Conduct detailed resource assessment",
          },
        ],
      },
    };
  }
}

export type { TeamRecommendation, TeamRole, ExternalResource, EquipmentResource, ResourceGap };
