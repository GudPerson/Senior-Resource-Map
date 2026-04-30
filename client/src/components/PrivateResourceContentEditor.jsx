import React, { useEffect, useId, useMemo, useState } from 'react';
import Select from 'react-select';
import { FileText, Loader2, LockKeyhole, Save, Trash2, UploadCloud, Users } from 'lucide-react';

import { api } from '../lib/api.js';
import MarkdownDescriptionField from './MarkdownDescriptionField.jsx';
import PrivateFileViewer from './PrivateFileViewer.jsx';

const ACCEPTED_PRIVATE_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
].join(',');

export default function PrivateResourceContentEditor({ resourceType, resourceId }) {
    const inputId = useId();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingFileId, setDeletingFileId] = useState(null);
    const [content, setContent] = useState(null);
    const [notes, setNotes] = useState('');
    const [accessUserIds, setAccessUserIds] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!resourceType || !resourceId) return;

            setLoading(true);
            setError('');
            setNotice('');
            try {
                const [contentData, candidateData] = await Promise.all([
                    api.getPrivateResourceContent(resourceType, resourceId),
                    api.getPrivateResourceAccessCandidates(resourceType, resourceId).catch(() => []),
                ]);
                if (cancelled) return;
                setContent(contentData);
                setNotes(contentData.notes || '');
                setAccessUserIds(contentData.accessUserIds || []);
                setCandidates(Array.isArray(candidateData) ? candidateData : []);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load partner-only content.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [resourceType, resourceId]);

    const accessOptions = useMemo(() => candidates.map((candidate) => ({
        value: candidate.id,
        label: `${candidate.name} (@${candidate.username})`,
    })), [candidates]);
    const selectedAccessOptions = accessOptions.filter((option) => accessUserIds.includes(option.value));
    const files = Array.isArray(content?.files) ? content.files : [];

    async function handleSave() {
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const updated = await api.updatePrivateResourceContent(resourceType, resourceId, {
                notes,
                accessUserIds,
            });
            setContent(updated);
            setNotes(updated.notes || '');
            setAccessUserIds(updated.accessUserIds || []);
            setNotice('Partner-only content saved.');
        } catch (err) {
            setError(err.message || 'Failed to save partner-only content.');
        } finally {
            setSaving(false);
        }
    }

    async function handleUpload(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setUploading(true);
        setError('');
        setNotice('');
        try {
            const updated = await api.uploadPrivateResourceFile(resourceType, resourceId, file);
            setContent((prev) => ({
                ...(prev || updated),
                files: updated.files || [],
                hasContent: true,
            }));
            setNotice('Private file uploaded.');
        } catch (err) {
            setError(err.message || 'Failed to upload private file.');
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteFile(file) {
        setDeletingFileId(file.id);
        setError('');
        setNotice('');
        try {
            const updated = await api.deletePrivateResourceFile(resourceType, resourceId, file.id);
            setContent((prev) => ({
                ...(prev || updated),
                files: updated.files || [],
                hasContent: Boolean((prev?.notes || notes || '').trim() || updated.files?.length),
            }));
            setNotice('Private file removed.');
        } catch (err) {
            setError(err.message || 'Failed to remove private file.');
        } finally {
            setDeletingFileId(null);
        }
    }

    if (!resourceType || !resourceId) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Save this resource first, then add partner-only notes and files.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
                Loading partner-only content...
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="mb-4 flex items-start gap-2">
                <LockKeyhole size={17} className="mt-0.5 text-amber-700" />
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Partner-only notes and files</h3>
                    <p className="text-xs leading-5 text-slate-600">
                        Hidden from guests, basic users, and unauthorised partners. File previews are loaded only after a server permission check.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <MarkdownDescriptionField
                    id={`${resourceType}-${resourceId}-private-notes`}
                    label="Partner-only notes"
                    value={notes}
                    onChange={setNotes}
                    placeholder="Reference notes, pricing details, service checklist, partner instructions..."
                    rows={5}
                />

                <div>
                    <div className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <Users size={13} />
                        Extra partner viewers
                    </div>
                    <Select
                        isMulti
                        options={accessOptions}
                        value={selectedAccessOptions}
                        onChange={(selected) => setAccessUserIds(Array.isArray(selected) ? selected.map((item) => item.value) : [])}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder={accessOptions.length ? 'Select partner accounts...' : 'No other partner accounts in this subregion'}
                    />
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        Resource editors already have access. Add partner accounts here only when they need read-only reference access.
                    </p>
                </div>

                <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                <FileText size={13} />
                                Private files
                            </p>
                            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, WEBP, or HEIC. Maximum 10 MB each. Images and PDFs appear directly in the partner-only card.</p>
                        </div>
                        <label
                            htmlFor={inputId}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                        >
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            Upload
                        </label>
                        <input
                            id={inputId}
                            type="file"
                            accept={ACCEPTED_PRIVATE_FILE_TYPES}
                            onChange={handleUpload}
                            className="sr-only"
                        />
                    </div>

                    {files.length > 0 ? (
                        <div className="grid gap-3">
                            {files.map((file) => (
                                <PrivateFileViewer
                                    key={file.id}
                                    resourceType={resourceType}
                                    resourceId={resourceId}
                                    file={file}
                                    compact
                                    actions={(
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteFile(file)}
                                            disabled={deletingFileId === file.id}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            title="Delete private file"
                                            aria-label="Delete private file"
                                        >
                                            {deletingFileId === file.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    )}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                            No private files uploaded yet.
                        </div>
                    )}
                </div>

                {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                {notice ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div> : null}

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary w-full justify-center"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Partner-only Content
                </button>
            </div>
        </section>
    );
}
