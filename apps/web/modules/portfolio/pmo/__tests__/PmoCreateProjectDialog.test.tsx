/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user-1",
      displayName: "PMO Tester",
      email: "pmo.tester@example.com",
    },
  }),
}));

import { PmoCreateProjectDialog, extractBudgetRange, type PipelineItem } from "../PMOOfficePage";

describe("PmoCreateProjectDialog", () => {
  function renderDialog(props: Parameters<typeof PmoCreateProjectDialog>[0]) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(PmoCreateProjectDialog, props),
      ),
    );
  }

  const eligibleItem: PipelineItem = {
    id: "demand-1",
    workflowStatus: "manager_approved",
    hasPortfolioProject: false,
    businessObjective: "Validate PMO Add Project end-to-end flow",
    suggestedProjectName: "Validate PMO Add Project end-to-end flow Initiative",
    organizationName: "COREVIA Validation Office",
    department: "PMO",
    urgency: "high",
    strategicAlignment: "75",
    estimatedBudget: "250000",
    budgetRange: "250000",
    expectedTimeline: "6-12 months",
    createdAt: "2026-04-02T16:11:49.682Z",
  };

  it("renders an eligible PMO demand with populated defaults", () => {
    renderDialog({
      open: true,
      onOpenChange: vi.fn(),
      pipelineItems: [eligibleItem],
      onConfirm: vi.fn(),
      isPending: false,
    });

    expect(screen.getByText("Add Project From PMO")).toBeInTheDocument();
    expect(screen.getByTestId("input-pmo-project-name")).toHaveValue("Validate PMO Add Project end-to-end flow Initiative");
    expect(screen.getByDisplayValue("AED 250000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Validate PMO Add Project end-to-end flow")).toBeInTheDocument();
  });

  it("normalizes plain numeric budget text", () => {
    expect(extractBudgetRange("250000")).toBe("AED 250000");
    expect(extractBudgetRange("AED 300000")).toBe("AED 300000");
    expect(extractBudgetRange(undefined)).toBe("TBD");
  });

  it("allows direct project creation when no eligible demands exist", () => {
    renderDialog({
      open: true,
      onOpenChange: vi.fn(),
      pipelineItems: [],
      onConfirm: vi.fn(),
      isPending: false,
    });

    expect(screen.getByText("Create Directly")).toBeInTheDocument();
    expect(screen.getByText("Convert Demand")).toBeInTheDocument();
    expect(screen.getByText("Start with the core project details below. COREVIA will create the project directly in the PMO workspace.")).toBeInTheDocument();
    expect(screen.getByText("Create project now")).toBeInTheDocument();
  });
});
