import React, { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

import { api } from '../lib/api.js';
import { normalizeRole } from '../lib/roles.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import PrivateFileViewer from './PrivateFileViewer.jsx';

function canRequestPrivateContent(user) {
    return ['partner', 'regional_admin', 'super_admin'].includes(normalizeRole(user?.role));
}

export default function PartnerPrivatePanel({ resourceType, resourceId, compact = false }) {
    const { user } = useAuth();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!resourceType || !resourceId || !canRequestPrivateContent(user)) {
                setContent(null);
                return;
            }

            setLoading(true);
            setError('');
            try {
                const data = await api.getPrivateResourceContent(resourceType, resourceId);
                if (!cancelled) setContent(data);
            } catch (err) {
                if (!cancelled) {
                    setContent(null);
                    if (!/partner-only content/i.test(err.message || '')) {
                        setError(err.message || 'Partner-only content could not be loaded.');
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [resourceType, resourceId, user]);

    if (!canRequestPrivateContent(user)) return null;
    if (loading) {
        return (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                Loading partner-only notes...
            </div>
        );
    }
    if (!content && !error) return null;

    const hasNotes = Boolean(content?.notes?.trim());
    const files = Array.isArray(content?.files) ? content.files : [];
    const shouldShow = hasNotes || files.length > 0 || error;
    if (!shouldShow) return null;

    return (
        <section className="mt-8 border-t border-slate-200 pt-6">
            <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <LockKeyhole size={18} />
                </span>
                <div>
                    <h2 className={compact ? 'text-base font-bold text-slate-900' : 'text-lg font-bold text-slate-900'}>Partner-only</h2>
                    <p className="text-sm text-slate-500">Visible only to authorised partner and admin accounts.</p>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
            ) : null}

            {hasNotes ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-4">
                    <MarkdownLiteText text={content.notes} className="text-sm leading-6 text-slate-700" />
                </div>
            ) : null}

            {files.length > 0 ? (
                <div className="mt-3 grid gap-3">
                    {files.map((file) => (
                        <PrivateFileViewer
                            key={file.id}
                            resourceType={resourceType}
                            resourceId={resourceId}
                            file={file}
                            compact={compact}
                        />
                    ))}
                </div>
            ) : null}
        </section>
    );
}
