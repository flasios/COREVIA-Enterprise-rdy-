/**
 * OpenAPI Schema Registry
 *
 * Auto-converts Zod schemas to OpenAPI 3.0 component schemas using zod-to-json-schema.
 * These are merged into the swagger-jsdoc config at startup.
 *
 * @module config
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

import { insertUserSchema, updateUserSchema } from "@shared/schema/platform";
import { insertDemandReportSchema, updateDemandReportSchema, insertTeamSchema, updateTeamSchema, insertTeamMemberSchema } from "@shared/schema/demand";
import { paginationSchema } from "@interfaces/middleware/pagination";

// Auth schemas (inline — mirrors auth.routes.ts)
import { z } from "zod";
const loginSchema = z.object({
  username: z.string().min(1).max(128).trim().optional(),
  email: z.string().email("Invalid email format").max(256).trim().toLowerCase().optional(),
  password: z.string().min(1, "Password is required"),
}).refine(data => data.username || data.email, {
  message: "Either username or email is required",
});
const registerSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/).trim(),
  email: z.string().email().max(256).trim().toLowerCase(),
  password: z.string().min(8).max(256),
  displayName: z.string().min(2).max(128),
  department: z.string().max(128).optional(),
});

// ── Convert a Zod schema to a clean OpenAPI 3.0 component schema ──────────

function zodToOpenApi(schema: ZodTypeAny, name: string): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3", name });
  // zodToJsonSchema wraps in { $ref, definitions } — extract the actual schema
  const defs = (jsonSchema as Record<string, unknown>).definitions as
    | Record<string, unknown>
    | undefined;
  if (defs?.[name]) {
    return defs[name] as Record<string, unknown>;
  }
  // Fallback: return as-is minus $ref wrapper
  const { $ref: _ref, definitions: _defs, ...rest } = jsonSchema as Record<string, unknown>;
  return rest;
}

// ── Schema registry ────────────────────────────────────────────────────────

export const openApiSchemas: Record<string, Record<string, unknown>> = {
  // Auth
  LoginRequest: zodToOpenApi(loginSchema, "LoginRequest"),
  RegisterRequest: zodToOpenApi(registerSchema, "RegisterRequest"),

  // Users
  InsertUser: zodToOpenApi(insertUserSchema, "InsertUser"),
  UpdateUser: zodToOpenApi(updateUserSchema, "UpdateUser"),

  // Teams
  InsertTeam: zodToOpenApi(insertTeamSchema, "InsertTeam"),
  UpdateTeam: zodToOpenApi(updateTeamSchema, "UpdateTeam"),
  InsertTeamMember: zodToOpenApi(insertTeamMemberSchema, "InsertTeamMember"),

  // Demand Reports
  InsertDemandReport: zodToOpenApi(insertDemandReportSchema, "InsertDemandReport"),
  UpdateDemandReport: zodToOpenApi(updateDemandReportSchema, "UpdateDemandReport"),

  // Pagination
  PaginationParams: zodToOpenApi(paginationSchema, "PaginationParams"),

  // Standard response envelopes
  PaginatedResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: { type: "array", items: {} },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          pageSize: { type: "integer", example: 50 },
          total: { type: "integer", example: 120 },
          totalPages: { type: "integer", example: 3 },
          hasMore: { type: "boolean", example: true },
        },
      },
    },
  },
  SuccessResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {},
      message: { type: "string" },
    },
  },
  ErrorResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string", example: "Error message" },
      status: { type: "integer", example: 400 },
      details: {},
    },
  },
};
