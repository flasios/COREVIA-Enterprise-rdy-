import { z } from "zod";
import { Clock, CheckCircle2, AlertCircle, Loader2, type LucideIcon } from "lucide-react";

// Professional Section Assignment Status System
// Centralized configuration for type-safety and consistency

export const ASSIGNMENT_STATUSES = {
  PENDING_CONFIRMATION: "pending_confirmation",
  IN_PROGRESS: "in_progress",
  UNDER_REVIEW: "under_review",
  COMPLETED: "completed",
} as const;

export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[keyof typeof ASSIGNMENT_STATUSES];

export interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: LucideIcon;
  color: string;
  description: string;
  ariaLabel: string;
}

export const STATUS_CONFIG: Record<AssignmentStatus, StatusConfig> = {
  [ASSIGNMENT_STATUSES.PENDING_CONFIRMATION]: {
    label: "Pending Confirmation",
    variant: "outline",
    icon: Clock,
    color: "text-yellow-600 dark:text-yellow-500",
    description: "Awaiting team or user confirmation",
    ariaLabel: "Assignment status: Pending confirmation from assigned party",
  },
  [ASSIGNMENT_STATUSES.IN_PROGRESS]: {
    label: "In Progress",
    variant: "default",
    icon: Loader2,
    color: "text-blue-600 dark:text-blue-500",
    description: "Actively being worked on",
    ariaLabel: "Assignment status: Work in progress",
  },
  [ASSIGNMENT_STATUSES.UNDER_REVIEW]: {
    label: "Under Review",
    variant: "secondary",
    icon: AlertCircle,
    color: "text-purple-600 dark:text-purple-500",
    description: "Submitted for review",
    ariaLabel: "Assignment status: Under review by stakeholders",
  },
  [ASSIGNMENT_STATUSES.COMPLETED]: {
    label: "Completed",
    variant: "default",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-500",
    description: "Work completed and approved",
    ariaLabel: "Assignment status: Completed and approved",
  },
};

// Validation Schemas
export const assignSectionSchema = z.object({
  sectionName: z.string().min(1, "Section is required"),
  assignmentType: z.enum(["team", "user"], { required_error: "Assignment type is required" }),
  assignedToTeamId: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  status: z.enum([
    ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
    ASSIGNMENT_STATUSES.IN_PROGRESS,
    ASSIGNMENT_STATUSES.UNDER_REVIEW,
    ASSIGNMENT_STATUSES.COMPLETED,
  ]).default(ASSIGNMENT_STATUSES.PENDING_CONFIRMATION),
}).refine(
  (data) => {
    // Validate that the correct ID is provided based on assignment type
    if (data.assignmentType === "team") {
      return !!data.assignedToTeamId;
    }
    if (data.assignmentType === "user") {
      return !!data.assignedToUserId;
    }
    return false;
  },
  {
    message: "Team or user must be selected based on assignment type",
    path: ["assignmentType"],
  }
);

export const updateStatusSchema = z.object({
  status: z.enum([
    ASSIGNMENT_STATUSES.PENDING_CONFIRMATION,
    ASSIGNMENT_STATUSES.IN_PROGRESS,
    ASSIGNMENT_STATUSES.UNDER_REVIEW,
    ASSIGNMENT_STATUSES.COMPLETED,
  ]),
  notes: z.string().max(500).optional(),
});

export type AssignSectionFormData = z.infer<typeof assignSectionSchema>;
export type UpdateStatusFormData = z.infer<typeof updateStatusSchema>;
