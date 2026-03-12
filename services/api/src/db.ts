/**
 * TransitIQ — Database Connection
 * ==================================
 * Shared PostgreSQL connection pool used across all routes.
 */

import { Pool } from "pg";
import dotenv from "dotenv";
import { logger } from "./logger";

dotenv.config({ path: "../../.env" });

export const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "postgresql://transitiq:localdev123@localhost:5432/transitiq",
  max:             10,   // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Verify connection on startup
db.connect()
  .then(client => {
    logger.info("Database connection: ✓ OK");
    client.release();
  })
  .catch(err => {
    logger.error(`Database connection failed: ${err.message}`);
  });

export default db;
