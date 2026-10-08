// Activation is temporary and independent of map/card selection.
export function annotationActivationKey(selection) {
    const identity = selection.origin === 'annotation' ? selection.annotationId
        : [...new Set((selection.resourceLinks || []).map(link => `${link.type}:${link.id}`))].sort().join(',');
    return `${selection.origin}:${identity}:${selection.channel || 'pointer'}`;
}

export function beginAnnotationActivation(slots, next) {
    return [...slots.filter(slot => slot.key !== next.key
        && !(next.channel === 'touch' && slot.channel === 'touch')), next];
}

export function endAnnotationActivation(slots, key, token) {
    return slots.filter(slot => slot.key !== key || (token != null && slot.activationVersion !== token));
}

export function isAnnotationTouchEvent(event, lastPointerType) {
    const original = event?.originalEvent || event?.nativeEvent || event;
    if (original?.key || String(original?.type || '').startsWith('key')) return false;
    if (original?.detail === 0 && !original?.pointerType) return false;
    return original?.pointerType === 'touch' || lastPointerType === 'touch'
        || original?.sourceCapabilities?.firesTouchEvents === true;
}

export function staysWithinAnnotationTarget(event) {
    return Boolean(event?.relatedTarget && event.currentTarget?.contains?.(event.relatedTarget));
}

// Leaflet paths and image overlays have no React focus props; attach to their DOM element.
export function bindAnnotationHoverElement(element, { label, onActivate, onDeactivate }) {
    const tokens = {};
    let pointerType;
    let pointerDown = false;
    const previous = new Map(['tabindex', 'aria-label'].map(name => [name, element.getAttribute(name)]));
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', label);
    const begin = channel => { tokens[channel] = onActivate?.(channel); };
    const end = channel => {
        if (tokens[channel] == null) return;
        onDeactivate?.(channel, tokens[channel]);
        delete tokens[channel];
    };
    const handlers = {
        pointerdown: event => { pointerType = event.pointerType; pointerDown = true; },
        pointerup: () => { pointerDown = false; },
        pointercancel: () => { pointerDown = false; },
        pointerenter: event => { pointerType = event.pointerType; if (pointerType !== 'touch') begin('pointer'); },
        pointerleave: () => { pointerDown = false; end('pointer'); },
        focus: () => { if (!pointerDown) begin('focus'); },
        blur: () => end('focus'),
    };
    for (const [name, handler] of Object.entries(handlers)) element.addEventListener(name, handler);
    return {
        activateTouch: event => { if (isAnnotationTouchEvent(event, pointerType)) begin('touch'); },
        cleanup: () => {
            for (const [name, handler] of Object.entries(handlers)) element.removeEventListener(name, handler);
            for (const channel of Object.keys(tokens)) end(channel);
            for (const [name, value] of previous) {
                if (value == null) element.removeAttribute(name);
                else element.setAttribute(name, value);
            }
        },
    };
}
