/**
 * Operations Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for project operations, resource allocation,
 * and performance tracking.
 * No DB, HTTP, or I/O imports.
 */

import type { Money } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────

export type ResourceAllocationStatus = "available" | "partially_allocated" | "fully_allocated" | "overallocated";

export type PerformanceRating = "exceeds" | "meets" | "below" | "critical";

export type CostCategory = "labor" | "material" | "equipment" | "travel" | "overhead" | "contingency";

export interface ResourceCapacity {
  userId: string;
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
}

export interface CostEntry {
  projectId: string;
  category: CostCategory;
  amount: Money;
  description: string;
  recordedAt: Date;
  recordedBy: string;
}

// Re-export shared VOs
export type { Money };

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Determine resource allocation status based on capacity.
 */
export function computeAllocationStatus(
  allocatedHours: number,
  totalHours: number
): ResourceAllocationStatus {
  if (totalHours <= 0) return "available";
  const ratio = allocatedHours / totalHours;
  if (ratio <= 0) return "available";
  if (ratio < 0.8) return "partially_allocated";
  if (ratio <= 1.0) return "fully_allocated";
  return "overallocated";
}

/**
 * Rate performance based on planned vs actual metrics.
 * Uses earned value variance thresholds.
 */
export function ratePerformance(
  cpi: number,
  spi: number
): PerformanceRating {
  const combined = (cpi + spi) / 2;
  if (combined >= 1.05) return "exceeds";
  if (combined >= 0.9) return "meets";
  if (combined >= 0.75) return "below";
  return "critical";
}

/**
 * Calculate team velocity (story points or tasks per sprint).
 */
export function computeVelocity(
  completedItems: number,
  sprintDays: number
): number {
  if (sprintDays <= 0) return 0;
  return Math.round((completedItems / sprintDays) * 100) / 100;
}

/**
 * Check if a resource can be assigned to a new task.
 * Must have at least 4 hours available.
 */
export function canAssignResource(capacity: ResourceCapacity): boolean {
  return capacity.availableHours >= 4;
}

/**
 * Calculate schedule performance index from dates.
 */
export function computeSchedulePerformance(
  plannedDuration: number,
  actualElapsed: number,
  percentComplete: number
): number {
  if (actualElapsed <= 0 || plannedDuration <= 0) return 1;
  const expectedProgress = (actualElapsed / plannedDuration) * 100;
  return expectedProgress > 0 ? percentComplete / expectedProgress : 1;
}

/**
 * Calculate burn rate (spent per day) from total spent and elapsed days.
 */
export function computeBurnRate(totalSpent: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 0;
  return Math.round((totalSpent / elapsedDays) * 100) / 100;
}

/**
 * Estimate completion date based on current burn rate.
 * Returns Days Remaining.
 */
export function estimateDaysRemaining(
  totalBudget: number,
  totalSpent: number,
  dailyBurnRate: number,
): number {
  if (dailyBurnRate <= 0) return Infinity;
  const remaining = totalBudget - totalSpent;
  return remaining > 0 ? Math.ceil(remaining / dailyBurnRate) : 0;
}

/**
 * Check if a cost entry exceeds the per-transaction approval threshold.
 * Transactions over 50,000 AED require director approval.
 */
export function requiresCostApproval(
  amount: number,
  threshold: number = 50_000,
): boolean {
  return amount >= threshold;
}
