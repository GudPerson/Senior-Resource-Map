import { getDb } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { buildPhoneIdentityDuplicateAudit } from '../src/utils/phoneIdentityAudit.js';

async function main() {
    const db = getDb();
    const rows = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        managerUserId: users.managerUserId,
        postalCode: users.postalCode,
        createdAt: users.createdAt,
    }).from(users);

    const audit = buildPhoneIdentityDuplicateAudit(rows, { maskPhones: true });
    console.log(JSON.stringify(audit, null, 2));
}

main().catch((error) => {
    console.error('Phone identity audit failed:', error);
    process.exitCode = 1;
});
