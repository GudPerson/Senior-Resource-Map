import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

let dbInstance = null;

export function getDb(envVars = {}) {
  if (dbInstance) return dbInstance;

  const envUrl = envVars.DATABASE_URL || (typeof process !== 'undefined' ? process.env?.DATABASE_URL : null);
  const sql = neon(envUrl || 'postgres://postgres:postgres@localhost:5432/seniorcare');

  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}
