import { Fragment, useLayoutEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { MapLayerReadout } from './MapLayerInspector.jsx';

export default function OwnerCanvasToolMenu({ menu, menuRef, label, items, onChoose, onDismiss,
    layerMessages, layerResult, showLayers, onToggleLayers }) {
    const [position, setPosition] = useState({ x: menu.x, y: menu.y });
    useLayoutEffect(() => {
        const node = menuRef.current;
        if (!node) return;
        const bounds = node.getBoundingClientRect();
        setPosition({
            x: Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8)),
            y: Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8)),
        });
        node.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }, [menu, menuRef]);
    const handleKey = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDismiss(true);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        if (event.target.closest('[data-map-layer-scroll]')) return;
        event.preventDefault();
        event.stopPropagation();
        const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')];
        const current = buttons.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index]?.focus({ preventScroll: true });
        buttons[index]?.scrollIntoView({ block: 'nearest' });
    };
    return (
        <div ref={menuRef} role="menu" aria-label={label} data-owner-canvas-context-menu="true"
            data-care-map-gesture-ui="true" className="owner-canvas-context-menu"
            style={{ left: position.x, top: position.y }} onKeyDown={handleKey}>
            {items.map(({ name, text, Icon, disabled, guidance }) => (
                <Fragment key={name}>
                {name === 'share' ? <button type="button" role="menuitemcheckbox" aria-checked={showLayers}
                    data-map-layer-toggle="true" onClick={onToggleLayers}>
                    <Eye size={18} aria-hidden="true" /><span>{layerMessages.showLayers}</span>
                </button> : null}
                <button type="button" role="menuitem" disabled={disabled}
                    data-owner-canvas-menu-action={name} title={guidance || undefined}
                    onClick={() => onChoose(name)}><Icon size={18} aria-hidden="true" /><span>{text}</span></button>
                </Fragment>
            ))}
            <section className="owner-canvas-context-layers" aria-label={layerMessages.here}>
                <h2>{layerMessages.here}</h2>
                <div tabIndex={0} role="region" aria-label={layerMessages.here} data-map-layer-scroll="true">
                    <MapLayerReadout result={layerResult} messages={layerMessages} />
                </div>
            </section>
        </div>
    );
}
