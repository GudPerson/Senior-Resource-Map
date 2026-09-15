import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

import {
    applyResourcePublicationPolicy,
    collectResourcePublicationRefs,
    loadApprovedResourcePublicationFields,
} from '../src/utils/resourcePublicationPolicy.js';

async function migrateThroughPermissionPolicy(pg) {
    const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) {
        await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        if (tag === '0010_permission_first_publishing') break;
    }
}

function publicDirectoryFixture() {
    return {
        name: 'Curator-authored care map',
        description: 'A map description written by the curator.',
        assets: [{ resourceType: 'hard', resourceId: 10 }],
        pins: [{
            title: 'Example Centre',
            categoryIconUrl: 'https://provider.example/pin-category.png',
            mapCategoryIconUrl: 'https://provider.example/pin-map-category.png',
        }],
        places: [{
            name: 'Example Centre',
            address: '10 Example Street',
            rows: [{
                resourceType: 'hard',
                resourceId: 10,
                name: 'Example Centre',
                contactPhone: '61234567',
                categoryIconUrl: 'https://provider.example/category.png',
                mapCategoryIconUrl: 'https://provider.example/map-category.png',
                logoUrl: 'https://provider.example/logo.png',
                bannerUrl: 'https://provider.example/banner.png',
                galleryUrls: ['https://provider.example/gallery.png'],
                descriptor: 'Provider-supplied description.',
                website: 'https://provider.example',
                socialLinks: { facebook: 'https://facebook.com/provider' },
                ctaUrl: 'https://provider.example/register',
                sourceUrl: 'https://source.example/internal',
                mapShortDescriptor: 'Curator note.',
            }],
        }],
    };
}

test('unverified references retain care facts and curator content while provider content fails closed', () => {
    const directory = publicDirectoryFixture();
    assert.deepEqual(collectResourcePublicationRefs(directory), [{ resourceType: 'hard', resourceId: 10 }]);

    const sanitized = applyResourcePublicationPolicy(directory);
    const row = sanitized.places[0].rows[0];
    assert.equal(sanitized.description, 'A map description written by the curator.');
    assert.equal(sanitized.pins[0].categoryIconUrl, null);
    assert.equal(sanitized.pins[0].mapCategoryIconUrl, null);
    assert.equal(sanitized.places[0].address, '10 Example Street');
    assert.equal(row.name, 'Example Centre');
    assert.equal(row.contactPhone, '61234567');
    assert.equal(row.mapShortDescriptor, 'Curator note.');
    assert.equal(row.categoryIconUrl, null);
    assert.equal(row.mapCategoryIconUrl, null);
    assert.equal(row.logoUrl, null);
    assert.equal(row.bannerUrl, null);
    assert.deepEqual(row.galleryUrls, []);
    assert.equal(row.descriptor, null);
    assert.equal(row.website, null);
    assert.deepEqual(row.socialLinks, {});
    assert.equal(row.ctaUrl, null);
    assert.equal(row.sourceUrl, null);
    assert.equal(directory.places[0].rows[0].logoUrl, 'https://provider.example/logo.png');
});

test('database approval is resource, field and public-use specific', async () => {
    const pg = new PGlite();
    try {
        await migrateThroughPermissionPolicy(pg);
        await pg.exec(`
            INSERT INTO users (id, username, email, password_hash, name)
                VALUES (1, 'owner', 'owner@example.test', 'fixture', 'Resource Owner');
            INSERT INTO partner_organizations (id, name, governance_status)
                VALUES (1, 'Example Organisation', 'active');
            INSERT INTO organization_agreements (
                id, organization_id, agreement_reference, status, expires_at, allowed_uses, approved_at
            ) VALUES (1, 1, 'OWNER-TERMS-1', 'active', '2099-01-01T00:00:00Z', '{"publicListing":true,"externalSharing":true}', now());
            INSERT INTO organization_resource_links (
                organization_id, resource_type, resource_id, link_status
            ) VALUES (1, 'hard', 10, 'active');
            INSERT INTO resource_publication_permissions (
                organization_id, agreement_id, resource_type, resource_id, status,
                approved_fields, allowed_uses, terms_version, requested_by_user_id,
                reviewed_by_user_id, approved_at
            ) VALUES (
                1, 1, 'hard', 10, 'publishing_approved',
                '["logoUrl", "website"]', '{"sharedMaps":true,"embeds":false}',
                'owner-terms-v1', 1, 1, now()
            )
        `);
        const db = drizzle(pg);
        const directory = publicDirectoryFixture();

        const sharedApprovals = await loadApprovedResourcePublicationFields(db, directory, 'sharedMaps');
        assert.deepEqual([...sharedApprovals.get('hard:10')].sort(), ['logoUrl', 'website']);
        const shared = applyResourcePublicationPolicy(directory, sharedApprovals);
        assert.equal(shared.places[0].rows[0].logoUrl, 'https://provider.example/logo.png');
        assert.equal(shared.places[0].rows[0].website, 'https://provider.example');
        assert.equal(shared.places[0].rows[0].bannerUrl, null);

        const embedApprovals = await loadApprovedResourcePublicationFields(db, directory, 'embeds');
        assert.equal(embedApprovals.size, 0);
        const embedded = applyResourcePublicationPolicy(directory, embedApprovals);
        assert.equal(embedded.places[0].rows[0].logoUrl, null);
        assert.equal(embedded.places[0].rows[0].website, null);

        await pg.exec("UPDATE organization_agreements SET effective_at = CURRENT_TIMESTAMP + interval '1 hour'");
        assert.equal((await loadApprovedResourcePublicationFields(db, directory, 'sharedMaps')).size, 0);
        await pg.exec("UPDATE organization_agreements SET effective_at = NULL, expires_at = CURRENT_TIMESTAMP - interval '1 hour'");
        assert.equal((await loadApprovedResourcePublicationFields(db, directory, 'sharedMaps')).size, 0);
        await pg.exec("UPDATE organization_agreements SET expires_at = '2099-01-01T00:00:00Z'");
        await pg.exec("UPDATE organization_resource_links SET link_status = 'unlinked', unlinked_at = now()");
        const withdrawnLinkApprovals = await loadApprovedResourcePublicationFields(db, directory, 'sharedMaps');
        assert.equal(withdrawnLinkApprovals.size, 0);
    } finally {
        await pg.close();
    }
});

test('missing permission schema leaves every resource unverified instead of exposing content', async () => {
    const pg = new PGlite();
    try {
        const db = drizzle(pg);
        const approvals = await loadApprovedResourcePublicationFields(db, publicDirectoryFixture(), 'sharedMaps');
        assert.equal(approvals.size, 0);
    } finally {
        await pg.close();
    }
});
