#!/usr/bin/env node

/**
 * Simple database cleanup script
 * Run with: node cleanup-system-data.js
 */

import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupDatabase() {
  const client = await pool.connect();

  try {
    console.log("Starting database cleanup...");

    // Read the SQL file
    const sqlFile = join(__dirname, "cleanup-system-data.sql");
    const sql = readFileSync(sqlFile, "utf8");

    // Execute the SQL
    await client.query(sql);

    console.log("✅ Database cleanup completed successfully!");
    console.log("Note: Super admin user has been preserved.");
    console.log("Note: To recreate demo users, run: npx tsx infrastructure/scripts/reset-and-seed-demo.ts");

  } catch (error) {
    console.error("❌ Database cleanup failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDatabase();