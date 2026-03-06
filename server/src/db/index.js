import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';


let dbInstance = null;

export function getDb(envVars = {}) {
  if (dbInstance) return dbInstance;

  const envUrl = envVars.DATABASE_URL || (typeof globalThis.process !== 'undefined' ? globalThis.process.env?.DATABASE_URL : null);
  const sql = neon(envUrl || 'postgres://postgres:postgres@localhost:5432/seniorcare');

  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}
