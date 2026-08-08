import { useEffect, useState } from 'react';

import {
    ArrowDown,
    ArrowUp,
    Check,
    Circle,
    CircleDot,
    Copy,
    CornerUpLeft,
    Minus,
    Move,
    MousePointer2,
    Pentagon,
    Redo2,
    RotateCw,
    Square,
    Trash2,
    Undo2,
    X,
} from 'lucide-react';

import {
    PRINT_ANNOTATION_COLORS,
    PRINT_ANNOTATION_DRAW_TOOLS,
    PRINT_ANNOTATION_MAX_CONTROL_POINTS,
    PRINT_ANNOTATION_TRANSFORM_TOOLS,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_LINE,
    PRINT_ANNOTATION_TOOL_MOVE,
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_ROTATE,
    PRINT_ANNOTATION_TOOL_SELECT,
    getPrintAnnotationMinimumPointCount,
    isPrintAnnotationRotationSupported,
} from '../lib/printAnnotations.js';

const TOOL_OPTIONS = [
    { value: PRINT_ANNOTATION_TOOL_SELECT, label: 'Select or adjust', Icon: MousePointer2 },
    { value: PRINT_ANNOTATION_TOOL_MOVE, label: 'Move annotation', Icon: Move },
    { value: PRINT_ANNOTATION_TOOL_ROTATE, label: 'Rotate annotation', Icon: RotateCw },
    { value: PRINT_ANNOTATION_TOOL_LINE, label: 'Draw line', Icon: Minus },
    { value: PRINT_ANNOTATION_TOOL_RECTANGLE, label: 'Draw box', Icon: Square },
    { value: PRINT_ANNOTATION_TOOL_CIRCLE, label: 'Draw circle', Icon: Circle },
    { value: PRINT_ANNOTATION_TOOL_POLYGON, label: 'Draw boundary', Icon: Pentagon },
];

function getToolHelp(tool, draftPointCount, selectedAnnotation = null) {
    if (tool === PRINT_ANNOTATION_TOOL_SELECT) {
        return 'Select an annotation to edit it or change its layer.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_MOVE) {
        if (!selectedAnnotation) {
            return 'Click an annotation, then drag its highlighted centre handle to move the whole item.';
        }
        if (selectedAnnotation.type === PRINT_ANNOTATION_TOOL_PIN) {
            return 'Drag the selected pin to move it. Undo reverses the completed move.';
        }
        return 'Drag the highlighted centre handle to move the whole annotation. Undo reverses the completed move.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_ROTATE) {
        if (!selectedAnnotation) {
            return 'Click a line, box, circle, or boundary, then drag its highlighted rotation handle.';
        }
        if (!isPrintAnnotationRotationSupported(selectedAnnotation.type)) {
            return 'Rotation is available for lines and area shapes. Saved pins can still be moved, duplicated, or removed.';
        }
        if (selectedAnnotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
            return 'Drag the highlighted rotation handle to turn the note; the circle outline stays unchanged. Undo reverses the completed rotation.';
        }
        return 'Drag the highlighted rotation handle around the annotation centre. Undo reverses the completed rotation.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_PIN) {
        return 'Enter a label, then click the map to place the pin.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_LINE) {
        return draftPointCount
            ? 'Step 2 of 2 — Move the pointer to preview the line, then click its end point. Drag either handle afterward to adjust it.'
            : 'Step 1 of 2 — Click the line start point. Move the pointer to preview before placing its end.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        return draftPointCount
            ? 'Step 2 of 2 — Move the pointer to preview the box, then click its opposite corner. Drag either handle afterward to adjust it.'
            : 'Step 1 of 2 — Click the first box corner. Move the pointer to preview its size and position.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_CIRCLE) {
        return draftPointCount
            ? 'Step 2 of 2 — Move the pointer to preview the circle, then click its outer edge. Drag its handles afterward to adjust it.'
            : 'Step 1 of 2 — Click the circle centre. Move the pointer to preview its radius.';
    }
    if (tool === PRINT_ANNOTATION_TOOL_POLYGON) {
        if (draftPointCount >= 3) {
            return `${draftPointCount} points set — Move the pointer to preview the next edge. Click to add it, or press Enter or choose Done to finish.`;
        }
        if (draftPointCount > 0) {
            return `Point ${draftPointCount + 1} — Move the pointer to preview the next edge, then click to add it.`;
        }
        return `Click the first boundary point, then move the pointer to preview each next edge. Add up to ${PRINT_ANNOTATION_MAX_CONTROL_POINTS} points.`;
    }
    return '';
}

function IconButton({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
                active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
            } disabled:cursor-not-allowed disabled:opacity-35`}
        >
            {children}
        </button>
    );
}

export default function PrintAnnotationToolbar({
    tool,
    draftText,
    draftStyle,
    draftPointCount = 0,
    selectedAnnotation = null,
    status = 'idle',
    error = '',
    canUndo = false,
    canRedo = false,
    canMoveSelectedBackward = false,
    canMoveSelectedForward = false,
    canDuplicateSelected = false,
    onToolChange,
    onDraftTextChange,
    onDraftStyleChange,
    onSelectedChange,
    onFinishDrawing,
    onUndoDraftPoint,
    onCancelDraft,
    onMoveSelected,
    onDuplicateSelected,
    onDeleteSelected,
    onUndo,
    onRedo,
    onClose,
}) {
    const [textBuffer, setTextBuffer] = useState(selectedAnnotation?.text ?? draftText);
    const [styleBuffer, setStyleBuffer] = useState(selectedAnnotation?.style ?? draftStyle);

    useEffect(() => {
        setTextBuffer(selectedAnnotation?.text ?? draftText);
    }, [draftText, selectedAnnotation?.id, selectedAnnotation?.text]);

    useEffect(() => {
        setStyleBuffer(selectedAnnotation?.style ?? draftStyle);
    }, [draftStyle, selectedAnnotation?.id, selectedAnnotation?.style]);

    const activeText = textBuffer;
    const activeStyle = styleBuffer;
    const updateStyle = (patch) => {
        setStyleBuffer((current) => ({ ...current, ...patch }));
        if (selectedAnnotation) {
            onSelectedChange?.({ style: { ...selectedAnnotation.style, ...patch } });
        } else {
            onDraftStyleChange?.({ ...draftStyle, ...patch });
        }
    };

    const activeMinimumPointCount = getPrintAnnotationMinimumPointCount(tool);
    const isDrawingShape = [
        PRINT_ANNOTATION_TOOL_LINE,
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ].includes(tool);
    const canFinishDrawing = tool === PRINT_ANNOTATION_TOOL_POLYGON
        && draftPointCount >= activeMinimumPointCount;
    const canUndoDraftPoint = isDrawingShape && draftPointCount > 0;
    const labelledTypes = [
        PRINT_ANNOTATION_TOOL_PIN,
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ];
    const showTextField = selectedAnnotation
        ? labelledTypes.includes(selectedAnnotation.type)
        : labelledTypes.includes(tool);
    const activeAnnotationType = selectedAnnotation?.type || tool;
    const showStyleControls = Boolean(selectedAnnotation || PRINT_ANNOTATION_DRAW_TOOLS.has(tool));
    const showLineControls = [
        PRINT_ANNOTATION_TOOL_LINE,
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ].includes(activeAnnotationType);
    const showFillControls = [
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ].includes(activeAnnotationType);
    const isPinLabel = selectedAnnotation?.type === PRINT_ANNOTATION_TOOL_PIN
        || (!selectedAnnotation && tool === PRINT_ANNOTATION_TOOL_PIN);
    const helperText = PRINT_ANNOTATION_TRANSFORM_TOOLS.has(tool)
        ? getToolHelp(tool, draftPointCount, selectedAnnotation)
        : (selectedAnnotation
            ? selectedAnnotation.type === PRINT_ANNOTATION_TOOL_PIN
                ? 'Drag the selected pin to move it. Edit its label or use the layer controls below.'
                : 'Drag the highlighted control points to adjust this shape. Undo reverses one adjustment at a time.'
            : getToolHelp(tool, draftPointCount, selectedAnnotation));

    return (
        <div
            className="absolute left-3 top-3 z-[1100] max-h-[calc(100%-1.5rem)] w-[320px] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"
            data-print-annotation-toolbar="true"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <CircleDot size={17} className="text-brand-700" aria-hidden="true" />
                    <span className="text-sm font-bold text-slate-900">Annotations</span>
                </div>
                <IconButton label="Close annotations" onClick={onClose}>
                    <X size={16} />
                </IconButton>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1">
                {TOOL_OPTIONS.map(({ value, label, Icon }) => (
                    <IconButton
                        key={value}
                        label={label}
                        active={tool === value}
                        onClick={() => onToolChange?.(value)}
                    >
                        <Icon size={16} />
                    </IconButton>
                ))}
            </div>

            {helperText ? (
                <p
                    className="mt-3 rounded-md border border-brand-100 bg-brand-50 px-2.5 py-2 text-xs font-semibold leading-4 text-brand-800"
                    data-print-annotation-helper="true"
                >
                    {helperText}
                </p>
            ) : null}

            {showTextField ? (
                <label className="mt-3 block">
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                        {isPinLabel ? 'Pin label' : 'Note inside shape'}
                    </span>
                    <textarea
                        rows={2}
                        maxLength={240}
                        placeholder={isPinLabel ? 'Required label' : 'Optional note'}
                        value={activeText}
                        onChange={(event) => {
                            setTextBuffer(event.target.value);
                            if (!selectedAnnotation) {
                                onDraftTextChange?.(event.target.value);
                            }
                        }}
                        onBlur={() => {
                            if (
                                selectedAnnotation
                                && (selectedAnnotation.type !== PRINT_ANNOTATION_TOOL_PIN || activeText.trim())
                            ) {
                                onSelectedChange?.({ text: activeText });
                            }
                        }}
                        className="mt-1 min-h-12 w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                </label>
            ) : null}

            {showStyleControls ? (
                <div className="mt-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">Shape colour</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PRINT_ANNOTATION_COLORS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            title={color}
                            aria-label={`Use ${color}`}
                            aria-pressed={activeStyle.color === color}
                            onClick={() => updateStyle({ color, fillColor: color })}
                            className={`h-7 w-7 rounded-full border-2 ${
                                activeStyle.color === color
                                    ? 'border-slate-900 ring-2 ring-slate-200'
                                    : 'border-white shadow-sm'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <label
                        className="relative flex h-8 min-w-[126px] cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                        title="Choose custom shape colour"
                    >
                        <span
                            className="h-4 w-4 shrink-0 rounded border border-slate-300"
                            style={{ backgroundColor: activeStyle.color }}
                            aria-hidden="true"
                        />
                        <span>Custom</span>
                        <span className="ml-auto font-mono text-[10px] text-slate-500">
                            {activeStyle.color}
                        </span>
                        <input
                            type="color"
                            value={activeStyle.color}
                            aria-label="Shape colour picker"
                            data-print-annotation-shape-color-picker="true"
                            onChange={(event) => {
                                const color = event.target.value.toUpperCase();
                                if (selectedAnnotation) {
                                    setStyleBuffer((current) => ({
                                        ...current,
                                        color,
                                        fillColor: color,
                                    }));
                                } else {
                                    updateStyle({ color, fillColor: color });
                                }
                            }}
                            onBlur={(event) => {
                                if (!selectedAnnotation) return;
                                const color = event.currentTarget.value.toUpperCase();
                                onSelectedChange?.({
                                    style: {
                                        ...selectedAnnotation.style,
                                        color,
                                        fillColor: color,
                                    },
                                });
                            }}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                    </label>
                </div>
                </div>
            ) : null}

            {showTextField ? (
                <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                    <label className="block">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Text</span>
                        <input
                            type="color"
                            value={activeStyle.textColor}
                            aria-label="Text colour"
                            onChange={(event) => {
                                const textColor = event.target.value.toUpperCase();
                                if (selectedAnnotation) {
                                    setStyleBuffer((current) => ({ ...current, textColor }));
                                } else {
                                    updateStyle({ textColor });
                                }
                            }}
                            onBlur={(event) => {
                                if (!selectedAnnotation) return;
                                onSelectedChange?.({
                                    style: {
                                        ...selectedAnnotation.style,
                                        textColor: event.currentTarget.value.toUpperCase(),
                                    },
                                });
                            }}
                            className="mt-1 h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                        />
                    </label>
                    <label className="block">
                        <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-500">
                            <span>Font size</span>
                            <span>{activeStyle.fontSize}px</span>
                        </span>
                        <input
                            type="range"
                            min="10"
                            max="32"
                            step="1"
                            value={activeStyle.fontSize}
                            onChange={(event) => {
                                const fontSize = Number(event.target.value);
                                if (selectedAnnotation) {
                                    setStyleBuffer((current) => ({ ...current, fontSize }));
                                } else {
                                    updateStyle({ fontSize });
                                }
                            }}
                            onPointerUp={(event) => {
                                if (!selectedAnnotation) return;
                                onSelectedChange?.({
                                    style: {
                                        ...selectedAnnotation.style,
                                        fontSize: Number(event.currentTarget.value),
                                    },
                                });
                            }}
                            onKeyUp={(event) => {
                                if (!selectedAnnotation) return;
                                onSelectedChange?.({
                                    style: {
                                        ...selectedAnnotation.style,
                                        fontSize: Number(event.currentTarget.value),
                                    },
                                });
                            }}
                            className="mt-2 w-full accent-brand-600"
                        />
                    </label>
                </div>
            ) : null}

            {showLineControls || showFillControls ? (
                <div className={`mt-3 grid gap-3 ${showLineControls && showFillControls ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {showLineControls ? (
                    <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Line</span>
                    <input
                        type="range"
                        min="1"
                        max="12"
                        value={activeStyle.weight}
                        onChange={(event) => {
                            const weight = Number(event.target.value);
                            if (selectedAnnotation) {
                                setStyleBuffer((current) => ({ ...current, weight }));
                            } else {
                                updateStyle({ weight });
                            }
                        }}
                        onPointerUp={(event) => {
                            if (selectedAnnotation) {
                                updateStyle({ weight: Number(event.currentTarget.value) });
                            }
                        }}
                        onKeyUp={(event) => {
                            if (selectedAnnotation) {
                                updateStyle({ weight: Number(event.currentTarget.value) });
                            }
                        }}
                        className="mt-1 w-full accent-brand-600"
                    />
                    </label>
                ) : null}
                {showFillControls ? (
                    <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Fill</span>
                    <input
                        type="range"
                        min="0"
                        max="0.6"
                        step="0.05"
                        value={activeStyle.fillOpacity}
                        onChange={(event) => {
                            const fillOpacity = Number(event.target.value);
                            if (selectedAnnotation) {
                                setStyleBuffer((current) => ({ ...current, fillOpacity }));
                            } else {
                                updateStyle({ fillOpacity });
                            }
                        }}
                        onPointerUp={(event) => {
                            if (selectedAnnotation) {
                                updateStyle({ fillOpacity: Number(event.currentTarget.value) });
                            }
                        }}
                        onKeyUp={(event) => {
                            if (selectedAnnotation) {
                                updateStyle({ fillOpacity: Number(event.currentTarget.value) });
                            }
                        }}
                        className="mt-1 w-full accent-brand-600"
                    />
                    </label>
                ) : null}
                </div>
            ) : null}

            {showLineControls ? (
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                    type="checkbox"
                    checked={activeStyle.dashed}
                    onChange={(event) => updateStyle({ dashed: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Dashed line
                </label>
            ) : null}

            {selectedAnnotation ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-brand-100 bg-brand-50 px-2.5 py-2 text-xs text-brand-900">
                    <input
                        type="checkbox"
                        checked={Boolean(selectedAnnotation.isShared)}
                        onChange={(event) => onSelectedChange?.({ isShared: event.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                    />
                    <span>
                        <span className="block font-bold">Share this annotation</span>
                        <span className="mt-0.5 block leading-4 text-brand-800">
                            It becomes public only after you update the shared link.
                        </span>
                    </span>
                </label>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                <IconButton label="Undo" disabled={!canUndo} onClick={onUndo}>
                    <Undo2 size={16} />
                </IconButton>
                <IconButton label="Redo" disabled={!canRedo} onClick={onRedo}>
                    <Redo2 size={16} />
                </IconButton>
                {canUndoDraftPoint ? (
                    <IconButton label="Undo last point" onClick={onUndoDraftPoint}>
                        <CornerUpLeft size={16} />
                    </IconButton>
                ) : null}
                {tool === PRINT_ANNOTATION_TOOL_POLYGON ? (
                    <IconButton
                        label="Done drawing"
                        disabled={!canFinishDrawing}
                        onClick={onFinishDrawing}
                    >
                        <Check size={16} />
                    </IconButton>
                ) : null}
                {tool !== PRINT_ANNOTATION_TOOL_SELECT ? (
                    <IconButton label="Cancel tool" onClick={onCancelDraft}>
                        <X size={16} />
                    </IconButton>
                ) : null}
                {selectedAnnotation ? (
                    <>
                        <IconButton
                            label="Duplicate annotation"
                            disabled={!canDuplicateSelected}
                            onClick={onDuplicateSelected}
                        >
                            <Copy size={16} />
                        </IconButton>
                        <IconButton
                            label="Send backward"
                            disabled={!canMoveSelectedBackward}
                            onClick={() => onMoveSelected?.('backward')}
                        >
                            <ArrowDown size={16} />
                        </IconButton>
                        <IconButton
                            label="Bring forward"
                            disabled={!canMoveSelectedForward}
                            onClick={() => onMoveSelected?.('forward')}
                        >
                            <ArrowUp size={16} />
                        </IconButton>
                    </>
                ) : null}
                <IconButton
                    label="Delete annotation"
                    disabled={!selectedAnnotation}
                    onClick={onDeleteSelected}
                >
                    <Trash2 size={16} />
                </IconButton>
                <div className="ml-auto min-w-0 text-right text-[11px] font-semibold">
                    {status === 'saving' ? <span className="text-brand-700">Saving...</span> : null}
                    {status === 'unsaved' ? <span className="text-amber-700">Pending</span> : null}
                    {status === 'saved' ? <span className="text-emerald-700">Saved</span> : null}
                    {status === 'error' ? (
                        <span className="block max-w-[110px] truncate text-red-600" title={error}>
                            Save failed
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
