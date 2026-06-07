import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

const TONE_META = {
    danger: {
        icon: Trash2,
        iconClassName: 'text-red-500',
        confirmClassName: 'btn-danger flex-1 justify-center disabled:opacity-50',
        cancelClassName: 'btn-ghost flex-1 justify-center disabled:opacity-50',
    },
    warning: {
        icon: AlertTriangle,
        iconClassName: 'text-amber-500',
        confirmClassName: 'btn-primary flex-1 justify-center bg-amber-600 border-amber-600 hover:bg-amber-700 disabled:opacity-50',
        cancelClassName: 'btn-ghost flex-1 justify-center disabled:opacity-50',
    },
    info: {
        icon: Info,
        iconClassName: 'text-brand-600',
        confirmClassName: 'btn-primary flex-1 justify-center disabled:opacity-50',
        cancelClassName: 'btn-ghost flex-1 justify-center disabled:opacity-50',
    },
};

function renderMessage(message) {
    if (Array.isArray(message)) {
        return message.map((line, index) => (
            <span key={`${line}-${index}`} className="block">
                {line}
            </span>
        ));
    }
    return message;
}

export default function ConfirmDialog({
    open,
    title = 'Confirm action?',
    message = 'Please confirm this action.',
    details = [],
    tone = 'danger',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    loading = false,
    loadingLabel = 'Deleting...',
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    const meta = TONE_META[tone] || TONE_META.danger;
    const Icon = meta.icon;
    const detailItems = Array.isArray(details)
        ? details.filter(Boolean)
        : [details].filter(Boolean);

    return (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="carearound-confirm-title"
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-2xl"
            >
                <Icon size={36} className={`mx-auto mb-3 ${meta.iconClassName}`} />
                <h2 id="carearound-confirm-title" className="mb-2 text-xl font-bold text-slate-900">
                    {title}
                </h2>
                <p className="mx-auto max-w-xs text-sm leading-6 text-slate-500">
                    {renderMessage(message)}
                </p>
                {detailItems.length ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs leading-5 text-slate-600">
                        {detailItems.map((detail, index) => (
                            <p key={`${detail}-${index}`}>{detail}</p>
                        ))}
                    </div>
                ) : null}
                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className={meta.cancelClassName}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={meta.confirmClassName}
                    >
                        {loading ? loadingLabel : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function useConfirmDialog() {
    const [options, setOptions] = useState(null);
    const resolveRef = useRef(null);

    const close = useCallback((confirmed) => {
        const resolve = resolveRef.current;
        resolveRef.current = null;
        setOptions(null);
        resolve?.(confirmed);
    }, []);

    const confirm = useCallback((nextOptions = {}) => new Promise((resolve) => {
        resolveRef.current = resolve;
        setOptions(nextOptions);
    }), []);

    return {
        confirm,
        confirmDialog: (
            <ConfirmDialog
                {...(options || {})}
                open={Boolean(options)}
                onCancel={() => close(false)}
                onConfirm={() => close(true)}
            />
        ),
    };
}
