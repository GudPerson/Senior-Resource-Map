import GovernanceOrganizationsPanel from '../../components/admin/GovernanceOrganizationsPanel.jsx';
import ResourceClaimsPanel from '../../components/ResourceClaimsPanel.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getOrganizationAccess } from '../../lib/roles.js';
import { RESOURCE_CLAIMS_UI_ENABLED } from '../../lib/governedPilotRelease.js';
import OrganizationJoinRequestsPanel from '../../components/admin/OrganizationJoinRequestsPanel.jsx';

export default function OrganizationWorkspacePage() {
    const { user } = useAuth();
    const canManage = getOrganizationAccess(user)
        .some((entry) => String(entry?.accessRole || '').trim().toLowerCase() === 'admin');

    return (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            {canManage ? <OrganizationJoinRequestsPanel /> : null}
            {RESOURCE_CLAIMS_UI_ENABLED && canManage ? (
                <div className="mb-8">
                    <ResourceClaimsPanel />
                </div>
            ) : null}
            <GovernanceOrganizationsPanel
                workspaceMode="organization"
                readOnly={!canManage}
                showCreateControls={false}
                resourceClaimsEnabled={RESOURCE_CLAIMS_UI_ENABLED}
            />
        </main>
    );
}
