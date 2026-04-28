/**
 * Request body validation middleware factory.
 *
 * Usage:
 *   import { validateBody } from "@interfaces/middleware/validateBody";
 *   import { insertFooSchema } from "@shared/schema";
 *
 *   router.post("/foo", auth.requireAuth, validateBody(insertFooSchema), handler);
 *
 * Throws a structured ValidationError (400) on invalid input.
 * Generic errors re-throw and are caught by the centralized errorHandler.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "@platform/logging/ErrorHandler";

/**
 * Validates `req.body` against a Zod schema.
 * On success: replaces `req.body` with the parsed (coerced/stripped) value.
 * On failure: throws `ValidationError` (400) with detailed error info.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid request body", {
          errors: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code,
          })),
        });
      }
      throw error;
    }
  };
}

/** Minimum body validation — asserts req.body is a non-null object. */
export const requireObjectBody = validateBody(
  z.record(z.unknown()).refine((v) => v !== null, { message: "Request body must be a non-null object" })
);
