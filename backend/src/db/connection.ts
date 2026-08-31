import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env";

const resolvedPath = path.resolve(process.cwd(), env.sqlitePath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new DatabaseSync(resolvedPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
