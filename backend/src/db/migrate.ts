import fs from "node:fs";
import path from "node:path";
import { db } from "./connection";
import { logger } from "../logging/logger";

export function runMigrations(): void {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  logger.info("Database migrations applied");
}
