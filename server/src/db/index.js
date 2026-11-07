import { sql as pg } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const MAINTENANCE_READ = Symbol('maintenance-read');

export function getDb(envVars = {}, purpose) {
  // Support passing Hono context directly, or a plain env object
  const vars = purpose === MAINTENANCE_READ ? envVars : (envVars?.env ?? envVars);
  const envUrl = vars.DATABASE_URL
    || (purpose !== MAINTENANCE_READ && typeof globalThis.process !== 'undefined' ? globalThis.process.env?.DATABASE_URL : null);
  if (!envUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = purpose === MAINTENANCE_READ
    ? neon(envUrl, { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(5000) } })
    : neon(envUrl);
  return drizzle(sql, { schema });
}

// Only the private purpose token can change connection options. Never fall back to a process URL for this observation.
export async function readMaintenanceDatabaseIdentity(workerEnv) {
  const db = getDb(workerEnv, MAINTENANCE_READ);
  const results = await db.batch([
    db.execute(pg`SET LOCAL statement_timeout = '1500ms'`),
    db.execute(pg`SET LOCAL lock_timeout = '500ms'`),
    db.execute(pg`SELECT current_setting('neon.branch_id', true) AS branch_id,
                         current_database() AS database,
                         current_user AS effective_role,
                         session_user AS session_role;`),
  ]);
  const rows = results?.[2]?.rows;
  return results?.length === 3 && rows?.length === 1 ? rows[0] : null;
}
