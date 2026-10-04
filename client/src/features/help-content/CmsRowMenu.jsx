import { useEffect, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';

export default function CmsRowMenu({ label, disabled, children }) {
    const [open, setOpen] = useState(false), root = useRef(null), trigger = useRef(null);
    useEffect(() => {
        const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
        const escape = (event) => { if (event.key === 'Escape' && open) { setOpen(false); trigger.current?.focus(); } };
        document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [open]);
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
    return <div className="cms-row-menu" ref={root}>
        <button ref={trigger} type="button" className="cms-row-menu-trigger" aria-label={label} aria-expanded={open} disabled={disabled} onClick={() => setOpen((value) => !value)}><Ellipsis size={18} aria-hidden="true" /></button>
        {open && <div className="cms-row-menu-panel" role="group" aria-label={label} onClick={(event) => { if (event.target.closest('button')) setOpen(false); }}>{children}</div>}
    </div>;
}
