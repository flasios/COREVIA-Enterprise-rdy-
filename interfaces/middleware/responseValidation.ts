/**
 * Response Schema Validation Middleware
 *
 * Validates API responses against Zod schemas in development/test mode.
 * In production, logs warnings instead of blocking responses.
 *
 * This ensures API contract compliance and catches response drift early.
 *
 * Usage:
 *   router.get("/users", validateResponse(userListResponseSchema), handler);
 */

import { type Request, type Response, type NextFunction } from "express";
import { type ZodTypeAny, ZodError } from "zod";
import { z } from "zod";
import { logger } from "@platform/logging/Logger";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/* ─── Standard API Response Envelope ────────────────────────── */

/**
 * Standard success response envelope.
 * All API responses SHOULD follow this structure.
 */
export const apiSuccessEnvelope = z.object({
  success: z.literal(true).optional(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
  meta: z.record(z.unknown()).optional(),
}).passthrough();

/**
 * Standard error response envelope.
 */
export const apiErrorEnvelope = z.object({
  success: z.literal(false),
  error: z.string(),
  errors: z.array(z.object({
    path: z.string(),
    message: z.string(),
    code: z.string().optional(),
  })).optional(),
  statusCode: z.number().optional(),
}).passthrough();

/* ─── Middleware ─────────────────────────────────────────────── */

/**
 * Middleware that validates the response body against a Zod schema.
 *
 * In development: logs validation errors as warnings
 * In production: logs warnings (never blocks responses)
 *
 * @example
 * const usersResponseSchema = z.object({
 *   success: z.literal(true),
 *   data: z.array(userSchema),
 * });
 * router.get("/users", validateResponse(usersResponseSchema), handler);
 */
export function validateResponse(schema: ZodTypeAny) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Override res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Only validate successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const result = schema.safeParse(body);
        if (!result.success) {
          const errors = (result.error as ZodError).errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          }));

          logger.warn("[ResponseValidation] Response does not match schema", {
            path: _req.path,
            method: _req.method,
            statusCode: res.statusCode,
            errors,
          });

          // In non-production, add a header to flag validation issues
          if (!IS_PRODUCTION) {
            res.setHeader("X-Response-Validation", "failed");
            res.setHeader("X-Response-Validation-Errors", JSON.stringify(errors).slice(0, 500));
          }
        }
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Create a typed response schema from a data schema.
 * Wraps the data schema in the standard API envelope.
 */
export function createResponseSchema<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true).optional(),
    data: dataSchema,
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }).optional(),
  }).passthrough();
}
