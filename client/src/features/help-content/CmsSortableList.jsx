import { useEffect, useId, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cmsSortTarget } from './helpContentSortModel.js';
import './cmsSortable.css';

// Pointer and keyboard previews are local. Only an explicit drop calls onPlace.
export default function CmsSortableList({ items, label, getLabel = (item) => item.title || item.id, onPlace, onActiveChange, disabled = false, enabled = true, as: List = 'div', itemAs: Item = 'div', className = '', itemClassName = '', itemProps = () => ({}), children }) {
    const helpId = useId(), nodes = useRef(new Map()), handles = useRef(new Map());
    const gesture = useRef(null), timer = useRef(null), scrolling = useRef(null), latest = useRef(null), suppressClick = useRef(false), root = useRef(null);
    const [preview, setPreview] = useState(null), [announcement, announce] = useState(''), [menuId, setMenuId] = useState(null);
    const ids = items.map((item) => item.id), identity = ids.join('|');
    latest.current = { items, ids, disabled, enabled, onPlace, onActiveChange, getLabel, menuId };
    function stopScroll() { if (scrolling.current !== null) cancelAnimationFrame(scrolling.current); scrolling.current = null; }
    function release() {
        clearTimeout(timer.current); stopScroll();
        const current = gesture.current;
        gesture.current = null;
        if (current?.element.hasPointerCapture?.(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
        return current;
    }
    function finish(commit = false, restoreFocus = true) {
        const current = release();
        if (!current) return;
        const latestValue = latest.current;
        suppressClick.current = current.mode === 'pointer' && current.active;
        const valid = current.identity === latestValue.ids.join('|') && !latestValue.disabled && latestValue.enabled;
        if (current.active) {
            if (commit && valid && current.id !== current.target) {
                latestValue.onPlace(current.id, current.target, [...latestValue.ids]);
                announce(`${current.name} moved to position ${latestValue.ids.indexOf(current.target) + 1} of ${latestValue.ids.length}. Save draft to keep this order.`);
            } else announce(commit && valid ? 'Order unchanged.' : 'Reordering cancelled. The draft order is unchanged.');
            latestValue.onActiveChange?.(false);
        }
        setPreview(null);
        if (restoreFocus && current.mode === 'keyboard') requestAnimationFrame(() => handles.current.get(current.id)?.focus({ preventScroll: true }));
    }
    function updateTarget(y) {
        const current = gesture.current;
        if (!current?.active) return;
        const target = cmsSortTarget(latest.current.ids.flatMap((id) => {
            const node = nodes.current.get(id);
            if (!node) return [];
            const rect = node.getBoundingClientRect();
            return [{ id, top: rect.top, bottom: rect.bottom }];
        }), y);
        if (target && target !== current.target) {
            current.target = target; setPreview({ id: current.id, target });
            announce(`${current.name}, position ${latest.current.ids.indexOf(target) + 1} of ${latest.current.ids.length}.`);
        }
    }
    function autoScroll() {
        if (scrolling.current !== null) return;
        const frame = () => {
            const current = gesture.current;
            if (!current?.active || current.mode !== 'pointer') { scrolling.current = null; return; }
            const direction = current.y < 100 ? -1 : current.y > window.innerHeight - 120 ? 1 : 0;
            if (direction) { window.scrollBy(0, direction * 12); updateTarget(current.y); }
            scrolling.current = requestAnimationFrame(frame);
        };
        scrolling.current = requestAnimationFrame(frame);
    }
    function activate() {
        const current = gesture.current;
        if (!current || latest.current.disabled || !latest.current.enabled) return;
        setMenuId(null); current.active = true; setPreview({ id: current.id, target: current.id });
        latest.current.onActiveChange?.(true);
        announce(`${current.name} selected. Drag to its new position, or use arrow keys. Press Escape to cancel.`);
        if (current.mode === 'pointer') { updateTarget(current.y); autoScroll(); }
    }
    function pointerDown(event, item, index) {
        if (event.button !== 0 || !event.isPrimary || disabled || !enabled || items.length < 2 || gesture.current) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
        gesture.current = { id: item.id, target: item.id, name: getLabel(item, index), identity, mode: 'pointer', active: false, pointerId: event.pointerId, pointerType: event.pointerType, element: event.currentTarget, x: event.clientX, y: event.clientY, startY: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        timer.current = setTimeout(activate, event.pointerType === 'touch' ? 250 : 160);
    }
    function pointerMove(event) {
        const current = gesture.current;
        if (!current || event.pointerId !== current.pointerId) return;
        const distance = Math.hypot(event.clientX - current.x, event.clientY - current.startY);
        current.y = event.clientY;
        if (!current.active && distance > 8) {
            if (current.pointerType === 'touch') { finish(false); return; }
            clearTimeout(timer.current); activate();
        }
        if (current.active) { event.preventDefault(); updateTarget(event.clientY); }
    }
    function pointerUp(event) {
        const current = gesture.current;
        if (current?.mode !== 'pointer' || event.pointerId !== current.pointerId) return;
        const rects = [...nodes.current.values()].map((node) => node.getBoundingClientRect());
        const inDropRegion = rects.some((rect) => event.clientX >= rect.left - 24 && event.clientX <= rect.right + 24 && event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16);
        finish(inDropRegion);
    }
    function keyDown(event, item, index) {
        const current = gesture.current;
        if (disabled || !enabled || items.length < 2) return;
        if (!current && [' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            gesture.current = { id: item.id, target: item.id, name: getLabel(item, index), identity, mode: 'keyboard', active: false, element: event.currentTarget };
            activate(); return;
        }
        if (!current || current.id !== item.id) return;
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        else if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); finish(true); }
        else if (event.key === 'Tab') finish(false, false);
        else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const position = latest.current.ids.indexOf(current.target), next = event.key === 'Home' ? 0 : event.key === 'End' ? latest.current.ids.length - 1 : Math.max(0, Math.min(latest.current.ids.length - 1, position + (event.key === 'ArrowUp' ? -1 : 1)));
            current.target = latest.current.ids[next]; setPreview({ id: current.id, target: current.target });
            announce(`${current.name}, position ${next + 1} of ${latest.current.ids.length}. Press Space or Enter to apply, Escape to cancel.`);
        }
    }
    function clickHandle(event, id) {
        event.preventDefault();
        if (suppressClick.current) { suppressClick.current = false; return; }
        if (!gesture.current) setMenuId((current) => current === id ? null : id);
    }
    function menuMove(id, direction) {
        const value = latest.current, index = value.ids.indexOf(id), target = value.ids[index + direction];
        if (!value.disabled && value.enabled && target) {
            value.onPlace(id, target, [...value.ids]);
            announce(`${value.getLabel(value.items[index], index)} moved to position ${index + direction + 1} of ${value.ids.length}. Save draft to keep this order.`);
        }
        setMenuId(null); requestAnimationFrame(() => handles.current.get(id)?.focus({ preventScroll: true }));
    }
    useEffect(() => {
        if (gesture.current && (disabled || !enabled || gesture.current.identity !== identity)) finish(false);
        if (disabled || !enabled) setMenuId(null);
    }, [disabled, enabled, identity]);
    useEffect(() => {
        const cancel = () => finish(false);
        const escape = (event) => { if (event.key === 'Escape') { if (gesture.current) { event.preventDefault(); cancel(); } const id = latest.current.menuId; setMenuId(null); if (id) handles.current.get(id)?.focus({ preventScroll: true }); } };
        const outside = (event) => { if (!handles.current.get(latest.current.menuId)?.closest('.cms-sort-handle-wrap')?.contains(event.target)) setMenuId(null); };
        window.addEventListener('blur', cancel); document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside);
        return () => { window.removeEventListener('blur', cancel); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); const current = release(); if (current?.active) latest.current.onActiveChange?.(false); };
    }, []);
    return <>
        <p id={helpId} className="sr-only">Hold the handle to drag. With a keyboard, press Space or Enter, use Up and Down, then Space or Enter to apply. Escape cancels.</p>
        <List ref={root} className={className} aria-label={label} data-sort-list={label}>
            {items.map((item, index) => <Item key={item.id} {...itemProps(item, index)} ref={(node) => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }} className={`${itemClassName} ${preview?.id === item.id ? 'cms-sort-active' : ''} ${preview?.target === item.id && preview.id !== item.id ? ids.indexOf(preview.id) < index ? 'cms-sort-after' : 'cms-sort-before' : ''}`} data-sort-id={item.id}>
                {children(item, index, enabled && <span className="cms-sort-handle-wrap"><button type="button" className="cms-sort-handle" ref={(node) => { if (node) handles.current.set(item.id, node); else handles.current.delete(item.id); }} aria-label={`Reorder ${getLabel(item, index).toLowerCase()}`} aria-describedby={helpId} aria-pressed={preview?.id === item.id} aria-expanded={menuId === item.id} disabled={disabled || items.length < 2} onPointerDown={(event) => pointerDown(event, item, index)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={(event) => { if (gesture.current?.mode === 'pointer' && event.pointerId === gesture.current.pointerId) finish(false); }} onLostPointerCapture={() => { if (gesture.current?.mode === 'pointer') finish(false); }} onKeyDown={(event) => keyDown(event, item, index)} onClick={(event) => clickHandle(event, item.id)}><GripVertical size={18} aria-hidden="true" /></button>{menuId === item.id && <span className="cms-sort-menu" role="group" aria-label={`Order ${getLabel(item, index).toLowerCase()}`}><button type="button" disabled={disabled || index === 0} onClick={() => menuMove(item.id, -1)}>Move earlier</button><button type="button" disabled={disabled || index === items.length - 1} onClick={() => menuMove(item.id, 1)}>Move later</button></span>}</span>)}
            </Item>)}
        </List>
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    </>;
}
