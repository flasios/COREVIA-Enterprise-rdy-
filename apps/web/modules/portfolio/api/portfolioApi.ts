/**
 * Portfolio API — Thin client wrappers for portfolio/project endpoints.
 */
import { apiRequest } from "@/lib/queryClient";
import type { PortfolioProject } from "@shared/schema";

/** Fetch all portfolio projects. */
export async function fetchPortfolioProjects(): Promise<PortfolioProject[]> {
  const res = await apiRequest("GET", "/api/portfolio/projects");
  return res.json();
}

/** Fetch portfolio-level statistics. */
export async function fetchPortfolioStats(): Promise<{
  totalProjects: number;
  activeProjects: number;
  totalBudget: number;
  avgProgress: number;
}> {
  const res = await apiRequest("GET", "/api/portfolio/stats");
  return res.json();
}

/** Fetch a single project by ID. */
export async function fetchProjectDetail(id: number): Promise<PortfolioProject> {
  const res = await apiRequest("GET", `/api/portfolio/projects/${id}`);
  return res.json();
}
