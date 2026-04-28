import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@platform/db";
import {
	intelligentWorkspaces,
	type WorkspaceServiceType,
} from "@shared/schema/workspace";

export type WorkspaceRecord = typeof intelligentWorkspaces.$inferSelect;
export type WorkspaceInsert = typeof intelligentWorkspaces.$inferInsert;

export async function countWorkspaces(): Promise<number> {
	const existing = await db.select({ count: sql<number>`count(*)::int` }).from(intelligentWorkspaces);
	return existing[0]?.count || 0;
}

export async function insertWorkspace(values: WorkspaceInsert): Promise<WorkspaceRecord> {
	const [workspace] = await db.insert(intelligentWorkspaces).values(values).returning();
	return workspace!;
}

export async function findWorkspaceBySlug(slug: string) {
	return db.query.intelligentWorkspaces.findFirst({
		where: eq(intelligentWorkspaces.slug, slug),
		columns: { id: true },
	});
}

export async function listWorkspaces(filters?: { search?: string; status?: string; serviceType?: string }) {
	const clauses = [];
	if (filters?.search) {
		clauses.push(ilike(intelligentWorkspaces.name, `%${filters.search}%`));
	}
	if (filters?.status) {
		clauses.push(eq(intelligentWorkspaces.status, filters.status));
	}
	if (filters?.serviceType) {
		clauses.push(eq(intelligentWorkspaces.serviceType, filters.serviceType as WorkspaceServiceType));
	}

	return db.query.intelligentWorkspaces.findMany({
		where: clauses.length > 0 ? and(...clauses) : undefined,
		orderBy: [desc(intelligentWorkspaces.updatedAt)],
	});
}

export async function getWorkspaceById(id: string) {
	return db.query.intelligentWorkspaces.findFirst({
		where: eq(intelligentWorkspaces.id, id),
	});
}

export async function updateWorkspaceById(id: string, changes: Partial<WorkspaceInsert>) {
	const [workspace] = await db.update(intelligentWorkspaces)
		.set(changes)
		.where(eq(intelligentWorkspaces.id, id))
		.returning();

	return workspace;
}

export type { WorkspaceClassification, WorkspaceServiceType } from "@shared/schema/workspace";