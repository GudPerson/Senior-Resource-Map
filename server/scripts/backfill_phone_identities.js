import { getDb } from '../src/db/index.js';
import { userPhoneIdentities, users } from '../src/db/schema.js';
import {
    applyPhoneIdentityBackfillPlan,
    buildPhoneIdentityBackfillPlan,
    serializePhoneIdentityBackfillReport,
} from '../src/utils/phoneIdentityBackfill.js';

const APPLY = process.argv.includes('--apply');

async function fetchExistingIdentityRows(db) {
    try {
        const rows = await db.select({
            userId: userPhoneIdentities.userId,
            phoneE164: userPhoneIdentities.phoneE164,
            revokedAt: userPhoneIdentities.revokedAt,
        }).from(userPhoneIdentities);
        return { rows, tableAvailable: true };
    } catch (error) {
        if (error?.code !== '42P01') throw error;
        if (APPLY) {
            throw new Error('user_phone_identities table is missing. Deploy/bootstrap the Phase 2A schema before running --apply.');
        }
        return {
            rows: [],
            tableAvailable: false,
            warning: 'user_phone_identities table is missing. Dry-run used zero existing identity rows and did not modify data.',
        };
    }
}

async function main() {
    const db = getDb(process.env);

    const [userRows, identityResult] = await Promise.all([
        db.select({
            id: users.id,
            username: users.username,
            role: users.role,
            phone: users.phone,
            managerUserId: users.managerUserId,
        }).from(users),
        fetchExistingIdentityRows(db),
    ]);

    const plan = buildPhoneIdentityBackfillPlan(userRows, identityResult.rows);
    const result = await applyPhoneIdentityBackfillPlan(db, plan, { apply: APPLY });
    const report = serializePhoneIdentityBackfillReport(plan, result);
    report.identityTableAvailable = identityResult.tableAvailable;
    if (identityResult.warning) {
        report.warning = identityResult.warning;
    }

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error('Phone identity backfill failed:', error);
    process.exitCode = 1;
});
