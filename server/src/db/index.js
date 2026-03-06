import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export function getDb(envVars = {}) {
  const envUrl = envVars.DATABASE_URL || (typeof globalThis.process !== 'undefined' ? globalThis.process.env?.DATABASE_URL : null);
  if (!envUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(envUrl);
  return drizzle(sql, { schema });
}
