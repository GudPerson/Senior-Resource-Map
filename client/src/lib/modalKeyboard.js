const MODAL_FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getModalFocusableElements(dialog) {
    if (!dialog?.querySelectorAll) return [];

    return Array.from(dialog.querySelectorAll(MODAL_FOCUSABLE_SELECTOR))
        .filter((element) => (
            !element.hidden
            && element.getAttribute?.('aria-hidden') !== 'true'
        ));
}

export function handleModalKeyboardEvent(event, { onEscape } = {}) {
    if (event?.key === 'Escape') {
        if (typeof onEscape !== 'function') return false;
        event.preventDefault?.();
        onEscape();
        return true;
    }

    if (event?.key !== 'Tab') return false;

    const dialog = event.currentTarget;
    const focusable = getModalFocusableElements(dialog);
    if (!focusable.length) {
        event.preventDefault?.();
        dialog?.focus?.();
        return true;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = dialog?.ownerDocument?.activeElement;
    const focusIsOutside = !dialog?.contains?.(activeElement);

    if (event.shiftKey && (activeElement === first || focusIsOutside)) {
        event.preventDefault?.();
        last.focus?.();
        return true;
    }

    if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
        event.preventDefault?.();
        first.focus?.();
        return true;
    }

    return false;
}
