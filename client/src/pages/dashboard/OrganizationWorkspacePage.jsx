import GovernanceOrganizationsPanel from '../../components/admin/GovernanceOrganizationsPanel.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getOrganizationAccess } from '../../lib/roles.js';

export default function OrganizationWorkspacePage() {
    const { user } = useAuth();
    const canManage = getOrganizationAccess(user)
        .some((entry) => String(entry?.accessRole || '').trim().toLowerCase() === 'admin');

    return (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <GovernanceOrganizationsPanel
                workspaceMode="organization"
                readOnly={!canManage}
                showCreateControls={false}
            />
        </main>
    );
}
