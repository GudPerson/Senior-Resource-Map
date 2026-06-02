import { useAuth } from '../../contexts/AuthContext.jsx';
import AuditTrailPanel from '../../components/admin/AuditTrailPanel.jsx';
import { getOrganizationAccess, normalizeRole } from '../../lib/roles.js';

export default function AuditTrailPage() {
    const { user } = useAuth();
    const orgAccess = getOrganizationAccess(user).filter((entry) => entry.accessRole === 'admin');
    const isSuperAdmin = normalizeRole(user?.role) === 'super_admin';
    const subtitle = isSuperAdmin
        ? 'Review sensitive operational changes across CareAround SG.'
        : `Review governance and resource changes for ${orgAccess.map((entry) => entry.organizationName).join(', ') || 'your organisation'}.`;

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
            <AuditTrailPanel title="Audit Trail" subtitle={subtitle} />
        </div>
    );
}
