import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { myMapRegionalDiscoveryDocuments, subregionEnquiryContactFields, regionalEmbedEmailGrants } from '../db/schema.js';

const stores = [myMapRegionalDiscoveryDocuments, subregionEnquiryContactFields, regionalEmbedEmailGrants];
const rows = result => Array.isArray(result) ? result : result?.rows || [];

/** Read-only verification. No request path installs or repairs schema. */
export async function verifyRegionalDiscoverySchema(db) {
    const columns = rows(await db.execute(sql`SELECT table_name, column_name, is_nullable, data_type
        FROM information_schema.columns WHERE table_schema = current_schema()
        AND table_name IN ('my_map_regional_discovery_documents', 'subregion_enquiry_contact_fields', 'regional_embed_email_grants')`));
    const constraints = rows(await db.execute(sql`SELECT rel.relname AS table_name, con.conname AS name, con.contype AS kind, con.confdeltype AS delete_rule
        FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = current_schema() AND rel.relname IN ('my_map_regional_discovery_documents', 'subregion_enquiry_contact_fields', 'regional_embed_email_grants')`));
    const missing = [];
    for (const store of stores) {
        const expected = getTableConfig(store);
        for (const column of expected.columns) {
            const actual = columns.find(row => row.table_name === expected.name && row.column_name === column.name);
            const expectedType = column.getSQLType().replace(/^varchar(?:\(\d+\))?$/, 'character varying');
            if (!actual || actual.data_type !== expectedType || (column.notNull && actual.is_nullable !== 'NO')) missing.push(`${expected.name}.${column.name}`);
        }
        if (!constraints.some(row => row.table_name === expected.name && row.kind === 'p')) missing.push(`${expected.name}.primary_key`);
        for (const check of expected.checks) if (!constraints.some(row => row.table_name === expected.name && row.name === check.name && row.kind === 'c')) missing.push(check.name);
        for (const foreign of expected.foreignKeys) {
            const action = foreign.onDelete === 'cascade' ? 'c' : foreign.onDelete === 'set null' ? 'n' : 'a';
            if (!constraints.some(row => row.table_name === expected.name && row.name === foreign.getName().slice(0, 63) && row.kind === 'f' && row.delete_rule === action)) missing.push(foreign.getName());
        }
    }
    if (missing.length) throw Object.assign(new Error(`Regional discovery schema verification failed: ${missing.join(', ')}`), { status: 503 });
    return { tables: stores.map(store => getTableConfig(store).name), verified: true };
}
