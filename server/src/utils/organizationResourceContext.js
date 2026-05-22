import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import {
    organizationAgreements,
    organizationResourceLinks,
    partnerOrganizations,
} from '../db/schema.js';
import { buildAgreementCoverageSummary } from './governance.js';

const RESOURCE_TYPES = new Set(['hard', 'soft', 'template']);

function buildResourceKey(type, id) {
    return `${type}:${Number(id)}`;
}

function normalizeResourceRefs(refs = []) {
    const byType = new Map();
    for (const ref of refs) {
        const resourceType = String(ref?.resourceType || '').trim();
        const resourceId = Number(ref?.resourceId);
        if (!RESOURCE_TYPES.has(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) continue;
        if (!byType.has(resourceType)) byType.set(resourceType, new Set());
        byType.get(resourceType).add(resourceId);
    }
    return byType;
}

export async function loadOrganizationContextsForResources(db, refs = []) {
    const refsByType = normalizeResourceRefs(refs);
    if (refsByType.size === 0) return new Map();

    const clauses = [...refsByType.entries()].map(([resourceType, ids]) => and(
        eq(organizationResourceLinks.resourceType, resourceType),
        inArray(organizationResourceLinks.resourceId, [...ids]),
    ));

    const rows = await db.select({
        linkId: organizationResourceLinks.id,
        organizationId: organizationResourceLinks.organizationId,
        resourceType: organizationResourceLinks.resourceType,
        resourceId: organizationResourceLinks.resourceId,
        linkStatus: organizationResourceLinks.linkStatus,
        agreementCoverageStatus: organizationResourceLinks.agreementCoverageStatus,
        organizationName: partnerOrganizations.name,
        organizationGovernanceStatus: partnerOrganizations.governanceStatus,
    })
        .from(organizationResourceLinks)
        .innerJoin(partnerOrganizations, eq(organizationResourceLinks.organizationId, partnerOrganizations.id))
        .where(and(
            isNull(organizationResourceLinks.unlinkedAt),
            or(...clauses),
        ));

    if (rows.length === 0) return new Map();

    const organizationIds = [...new Set(rows.map((row) => row.organizationId).filter(Boolean))];
    const agreements = organizationIds.length > 0
        ? await db.select().from(organizationAgreements).where(inArray(organizationAgreements.organizationId, organizationIds))
        : [];
    const agreementsByOrganizationId = new Map();
    for (const agreement of agreements) {
        if (!agreementsByOrganizationId.has(agreement.organizationId)) agreementsByOrganizationId.set(agreement.organizationId, []);
        agreementsByOrganizationId.get(agreement.organizationId).push(agreement);
    }

    const contextsByResourceKey = new Map();
    for (const row of rows) {
        const key = buildResourceKey(row.resourceType, row.resourceId);
        if (!contextsByResourceKey.has(key)) contextsByResourceKey.set(key, []);
        contextsByResourceKey.get(key).push({
            linkId: row.linkId,
            organizationId: row.organizationId,
            organizationName: row.organizationName,
            governanceStatus: row.organizationGovernanceStatus,
            linkStatus: row.linkStatus,
            agreementCoverageStatus: row.agreementCoverageStatus,
            agreementCoverage: buildAgreementCoverageSummary(agreementsByOrganizationId.get(row.organizationId) || []),
        });
    }

    return contextsByResourceKey;
}
