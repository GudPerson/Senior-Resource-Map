import { cloneElement, useEffect, useId, useRef } from 'react';

export function CmsButton({ children, primary = false, danger = false, className = '', ...props }) {
    return <button type="button" className={`cms-button ${primary ? 'primary' : ''} ${danger ? 'danger' : ''} ${className}`} {...props}>{children}</button>;
}
export function CmsField({ label, value, onChange, multiline = false, hint, children, ...props }) {
    const id = useId();
    return <label className="cms-field" htmlFor={id}><span>{label}</span>{children ? cloneElement(children, { id }) : (multiline
        ? <textarea id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />
        : <input id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />)}{hint && <small>{hint}</small>}</label>;
}
export function CmsOrderButtons({ label, first, last, onMove }) {
    return <span className="cms-order"><CmsButton disabled={first} aria-label={`Move ${label} up`} onClick={() => onMove(-1)}>↑</CmsButton><CmsButton disabled={last} aria-label={`Move ${label} down`} onClick={() => onMove(1)}>↓</CmsButton></span>;
}
export function CmsDialog({ definition, onComplete }) {
    const ref = useRef(null), titleId = useId(), descriptionId = useId();
    useEffect(() => {
        if (!definition || !ref.current) return undefined;
        const dialog = ref.current, previous = document.activeElement;
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('input,select,textarea,button')?.focus();
        return () => { if (dialog.open) dialog.close(); if (previous?.isConnected) previous.focus(); };
    }, [definition]);
    if (!definition) return null;
    return <dialog ref={ref} className="cms-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onComplete(null); }}>
        <form onSubmit={(event) => { event.preventDefault(); onComplete(Object.fromEntries(new FormData(event.currentTarget))); }}>
            <h2 id={titleId}>{definition.title}</h2><p id={descriptionId} className="cms-muted" style={{ marginTop: 10 }}>{definition.description}</p>
            {definition.details?.length > 0 && <ul style={{ margin: '12px 0', paddingLeft: 18, fontSize: 13 }}>{definition.details.map((value, index) => <li key={index}>{value}</li>)}</ul>}
            {(definition.fields || []).map((field) => <label className="cms-field" key={field.name}><span>{field.label}</span>{field.options
                ? <select name={field.name} defaultValue={field.value || field.options[0]?.value}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : field.multiline ? <textarea name={field.name} defaultValue={field.value || ''} required={field.required} maxLength={field.maxLength || 2000} />
                    : <input name={field.name} defaultValue={field.value || ''} required={field.required} maxLength={field.maxLength || 240} />}</label>)}
            {definition.approval && <label className="cms-field" style={{ flexDirection: 'row', alignItems: 'start' }}><input name="approved" type="checkbox" required style={{ width: 18, minHeight: 18, marginTop: 3 }} /><span>{definition.approval}</span></label>}
            <div className="cms-actions"><CmsButton onClick={() => onComplete(null)}>Cancel</CmsButton><button type="submit" className={`cms-button ${definition.danger ? 'danger' : 'primary'}`}>{definition.confirm || 'Continue'}</button></div>
        </form>
    </dialog>;
}
