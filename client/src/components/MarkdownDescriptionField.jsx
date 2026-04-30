import React from 'react';
import { FileText } from 'lucide-react';

import { DESCRIPTION_MARKDOWN_HINT } from '../lib/markdownLite.js';
import MarkdownLiteText from './MarkdownLiteText.jsx';

export default function MarkdownDescriptionField({
    id,
    label = 'Description',
    value,
    onChange,
    placeholder = 'Brief description...',
    rows = 4,
}) {
    const text = value || '';
    const hasPreview = Boolean(text.trim());

    return (
        <div>
            <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700">
                <FileText size={13} />
                {label}
            </label>
            <textarea
                id={id}
                rows={rows}
                value={text}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                className="input-field resize-none"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">{DESCRIPTION_MARKDOWN_HINT}</p>

            {hasPreview ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Preview</p>
                    <MarkdownLiteText text={text} compact className="mt-2 text-sm leading-6 text-slate-700" />
                </div>
            ) : null}
        </div>
    );
}
