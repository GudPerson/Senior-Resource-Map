import { CmsButton } from './CmsControls.jsx';

const labels = { queued: 'Waiting to publish', prepared: 'Ready for release verification', dispatched: 'Publication started', 'dispatch-unconfirmed': 'Publication needs confirmation', failed: 'Publication failed', 'partially-released': 'Publication incomplete', published: 'Published and verified' };
export default function HelpContentPublications({ releases = [], publishingAvailable = false, disabled = false, activeReleaseId = null, onRetry, onCheck }) {
    return releases.map((value, index) => {
        const state = value.state || value.status;
        const finishingRecovery = state === 'published' && activeReleaseId === (value.releaseId || value.id);
        const needsCheck = finishingRecovery || ['queued', 'prepared', 'dispatched', 'dispatch-unconfirmed'].includes(state) && value.jobReconciled !== true;
        const canRetry = ['failed', 'partially-released'].includes(state) || state === 'dispatch-unconfirmed' && value.jobReconciled === true;
        return <div className="cms-release" key={value.releaseId || value.id || index}>
            <strong>{value.version || value.contentVersion || 'Content publication'}</strong>
            <p className="cms-muted">{labels[state] || 'Pending'}{value.createdAt ? ` · ${value.createdAt}` : ''}</p>
            {value.message && <p className="cms-muted">{value.message}</p>}
            {publishingAvailable && needsCheck && <><p className="cms-muted">{finishingRecovery ? 'This release is verified. Check its job to finish recovery.' : 'Check the release job before retrying this publication.'}</p><CmsButton disabled={disabled} onClick={() => onCheck(value)}>Check release job</CmsButton></>}
            {publishingAvailable && canRetry && <CmsButton disabled={disabled} onClick={() => onRetry(value)}>Retry same publication</CmsButton>}
        </div>;
    });
}
