/**
 * Admin API — Thin client wrappers for user/team management endpoints.
 */
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

/** Fetch all users. */
export async function fetchUsers(): Promise<User[]> {
  const res = await apiRequest("GET", "/api/users");
  return res.json();
}

/** Create a new user. */
export async function createUser(data: Record<string, unknown>): Promise<User> {
  const res = await apiRequest("POST", "/api/users", data);
  return res.json();
}

/** Update an existing user. */
export async function updateUser(id: number, data: Record<string, unknown>): Promise<User> {
  const res = await apiRequest("PATCH", `/api/users/${id}`, data);
  return res.json();
}

/** Delete a user by ID. */
export async function deleteUser(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/users/${id}`);
}

/** Fetch all teams. */
export async function fetchTeams(): Promise<unknown[]> {
  const res = await apiRequest("GET", "/api/teams");
  return res.json();
}
