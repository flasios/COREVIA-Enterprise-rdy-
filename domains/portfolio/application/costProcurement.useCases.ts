/**
 * Portfolio Module — costProcurement use-cases
 */

import type {
  CostProcDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function getCostEntries(deps: Pick<CostProcDeps, "costs">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.costs.getByProject(projectId) };
}


export async function createCostEntry(deps: Pick<CostProcDeps, "costs">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.costs.create(validatedData) };
}


export async function updateCostEntry(deps: Pick<CostProcDeps, "costs">, id: string, updates: Record<string, unknown>): Promise<PortResult> {
  await deps.costs.update(id, updates);
  return { success: true, data: null, message: "Cost entry updated" };
}


export async function deleteCostEntry(deps: Pick<CostProcDeps, "costs">, id: string): Promise<PortResult> {
  await deps.costs.delete(id);
  return { success: true, data: null, message: "Cost entry deleted" };
}


export async function getProcurementItems(deps: Pick<CostProcDeps, "procurement">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.procurement.getByProject(projectId) };
}


export async function createProcurementItem(deps: Pick<CostProcDeps, "procurement">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.procurement.create(validatedData) };
}


export async function updateProcurementItem(deps: Pick<CostProcDeps, "procurement">, id: string, updates: Record<string, unknown>): Promise<PortResult> {
  await deps.procurement.update(id, updates);
  return { success: true, data: null, message: "Procurement item updated" };
}


export async function deleteProcurementItem(deps: Pick<CostProcDeps, "procurement">, id: string): Promise<PortResult> {
  await deps.procurement.delete(id);
  return { success: true, data: null, message: "Procurement item deleted" };
}


export async function getPayments(deps: Pick<CostProcDeps, "payments">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.payments.getByProject(projectId) };
}


export async function createPayment(deps: Pick<CostProcDeps, "payments">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.payments.create(validatedData) };
}


export async function updatePayment(deps: Pick<CostProcDeps, "payments">, id: string, updates: Record<string, unknown>): Promise<PortResult> {
  await deps.payments.update(id, updates);
  return { success: true, data: null, message: "Payment updated" };
}


export async function deletePayment(deps: Pick<CostProcDeps, "payments">, id: string): Promise<PortResult> {
  await deps.payments.delete(id);
  return { success: true, data: null, message: "Payment deleted" };
}


export async function updateWbsTaskActualCost(deps: Pick<CostProcDeps, "wbs">, taskId: string, actualCost: string): Promise<PortResult> {
  await deps.wbs.update(taskId, { actualCost: String(actualCost) });
  return { success: true, data: null, message: "Actual cost updated" };
}

