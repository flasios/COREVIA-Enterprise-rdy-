import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { logger } from "./platform/logging/Logger";

if (!process.env.DATABASE_URL) {
	throw new Error(
		"DATABASE_URL must be set. Did you forget to provision a database?",
	);
}

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
	logger.error("[Database] Pool error (will auto-recover):", err.message);
});

pool.on("connect", () => {
	logger.info("[Database] New connection established");
});

export const db = drizzle({ client: pool, schema });

export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	delayMs: number = 1000,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			const isConnectionError = lastError.message.includes("terminating connection") ||
				lastError.message.includes("connection") ||
				lastError.message.includes("57P01");

			if (isConnectionError && attempt < maxRetries) {
				logger.warn(`[Database] Connection error, retrying (${attempt}/${maxRetries})...`);
				await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
				continue;
			}
			throw lastError;
		}
	}

	throw lastError;
}
