import type { Request, Response } from "express";
import { createBasicHealthResponse } from "../contracts";

export function healthController(_req: Request, res: Response): void {
  res.json(createBasicHealthResponse());
}

export const getHealthStatus = healthController;
