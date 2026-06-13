const ACTION_CONFIG = {
    bold: {
        prefix: '**',
        suffix: '**',
        placeholder: 'note',
    },
    italic: {
        prefix: '*',
        suffix: '*',
        placeholder: 'note',
    },
};

function clampIndex(value, length) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(length, number));
}

function normalizeSelection(value, selectionStart, selectionEnd) {
    const length = value.length;
    const start = clampIndex(selectionStart, length);
    const end = clampIndex(selectionEnd, length);
    return start <= end
        ? { start, end }
        : { start: end, end: start };
}

function replaceSelection(value, start, end, replacement, selectStart, selectEnd) {
    return {
        value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
        selectionStart: start + selectStart,
        selectionEnd: start + selectEnd,
    };
}

function applyInlineAction(value, start, end, config) {
    const selectedText = value.slice(start, end) || config.placeholder;
    const replacement = `${config.prefix}${selectedText}${config.suffix}`;
    return replaceSelection(
        value,
        start,
        end,
        replacement,
        config.prefix.length,
        config.prefix.length + selectedText.length,
    );
}

function applyListAction(value, start, end, ordered = false) {
    const selectedText = value.slice(start, end) || 'List item';
    const replacement = selectedText
        .split('\n')
        .map((line, index) => {
            const text = line.trim() || 'List item';
            return ordered ? `${index + 1}. ${text}` : `- ${text}`;
        })
        .join('\n');

    return replaceSelection(value, start, end, replacement, 0, replacement.length);
}

function applyLinkAction(value, start, end) {
    const selectedText = value.slice(start, end) || 'link';
    const replacement = `[${selectedText}](https://)`;
    const urlStart = selectedText.length + 3;
    const urlEnd = urlStart + 'https://'.length;
    return replaceSelection(value, start, end, replacement, urlStart, urlEnd);
}

export function applyMapNoteMarkdownAction({
    value = '',
    selectionStart = 0,
    selectionEnd = selectionStart,
    action,
} = {}) {
    const text = String(value || '');
    const { start, end } = normalizeSelection(text, selectionStart, selectionEnd);

    if (ACTION_CONFIG[action]) {
        return applyInlineAction(text, start, end, ACTION_CONFIG[action]);
    }

    if (action === 'bullet-list') {
        return applyListAction(text, start, end, false);
    }

    if (action === 'numbered-list') {
        return applyListAction(text, start, end, true);
    }

    if (action === 'link') {
        return applyLinkAction(text, start, end);
    }

    return {
        value: text,
        selectionStart: start,
        selectionEnd: end,
    };
}
