import React, { useId, useState } from 'react';
import { regionalDiscoveryCopy } from './regionalDiscoveryPresentation.js';

export default function RegionalPostalForm({ postalInput = '', onPostalInputChange, evaluating = false, onEvaluate, onClearPostal, copy: overrides }) {
    const copy = regionalDiscoveryCopy(overrides);
    const id = useId();
    const [invalid, setInvalid] = useState(false);
    return <form className="space-y-2" onSubmit={event => {
        event.preventDefault();
        if (!/^\d{6}$/.test(postalInput)) { setInvalid(true); return; }
        setInvalid(false); onEvaluate?.(postalInput);
    }}>
        <label htmlFor={id} className="block text-sm font-semibold">{copy.postalLabel}</label>
        <p id={`${id}-hint`} className="text-sm text-slate-600">{copy.postalHint}</p>
        <div className="flex flex-wrap gap-2">
            <input id={id} value={postalInput} onChange={event => { setInvalid(false); onPostalInputChange?.(event.target.value); }}
                type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" required
                aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`} aria-invalid={invalid || undefined}
                className="min-h-[44px] w-32 rounded border border-slate-400 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" />
            <button type="submit" disabled={evaluating || !onEvaluate} className="min-h-[44px] rounded bg-teal-800 px-3 text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{evaluating ? copy.evaluating : copy.evaluate}</button>
            <button type="button" className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2" onClick={() => { setInvalid(false); onPostalInputChange?.(''); onClearPostal?.(); }}>{copy.clearPostal}</button>
        </div>
        {invalid && <p id={`${id}-error`} role="alert">{copy.invalidPostal}</p>}
    </form>;
}
