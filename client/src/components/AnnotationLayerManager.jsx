import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Minus } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { ANNOTATION_GROUP_MAX_LENGTH, normalizeAnnotationGroupName } from '../../../shared/annotationGroups.js';
import { annotationLayerType, annotationVisibilitySummary, annotationSelectionSummary, setAnnotationMatchesSelected,
    reconcileAnnotationSelection, selectedAnnotationLayers, groupAnnotationLayers, filterAnnotationLayers,
    planAnnotationVisibilityChange, cleanOldAnnotationVisibility } from '../lib/annotationLayerManager.js';
import { annotationLayerMessage, getAnnotationLayerMessages } from '../lib/annotationLayerMessages.js';
import './AnnotationLayerManager.css';

function VisibilityButton({ summary, label, disabled, onClick, ...attributes }) {
    const Icon = summary.visible ? Eye : EyeOff;
    return <button type="button" className="annotation-layer-eye" aria-label={label} title={label}
        aria-pressed={summary.mixed ? 'mixed' : summary.checked} disabled={disabled} onClick={onClick} {...attributes}>
        <Icon size={18} aria-hidden="true" />
        {summary.mixed ? <Minus size={11} className="annotation-layer-eye-mixed" aria-hidden="true" /> : null}
    </button>;
}

export default function AnnotationLayerManager({
    catalog = [], hiddenIds = [], onVisibilityChange, onGroupChange = null,
    onGroupUndo = null, canUndoGroup = false, onGroupRetry = null, canRetryGroup = false,
    catalogReady = false,
    groupsDisabled = true, disabled = false,
}) {
    const { locale } = useLocale();
    const messages = getAnnotationLayerMessages(locale);
    const id = useId();
    const allRef = useRef(null);
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [group, setGroup] = useState('all');
    const [groupName, setGroupName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [organiseOpen, setOrganiseOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState('');
    const [visibilityOverflow, setVisibilityOverflow] = useState(false);
    const matches = filterAnnotationLayers(catalog, { query, type, group });
    const summary = annotationVisibilitySummary(matches, hiddenIds);
    const selection = annotationSelectionSummary(matches, selectedIds);
    const selected = new Set(selectedIds);
    const selectedItems = selectedAnnotationLayers(catalog, selectedIds);
    const matchIds = new Set(matches.map(item => item.id));
    const outsideCount = selectedItems.filter(item => !matchIds.has(item.id)).length;
    const hidden = new Set(hiddenIds);
    const types = [...new Set(catalog.map(annotationLayerType))].sort();
    const groupedItems = groupAnnotationLayers(catalog);
    const groups = groupedItems.filter(item => item.name).map(item => item.name);
    const name = normalizeAnnotationGroupName(groupName);
    const changedCount = selectedItems.filter(item => normalizeAnnotationGroupName(item.groupName) !== name).length;
    const groupedSelectionCount = selectedItems.filter(item => normalizeAnnotationGroupName(item.groupName)).length;
    const resultKey = canRetryGroup ? 'failed' : result;
    const cleanedHiddenIds = cleanOldAnnotationVisibility(hiddenIds, catalog);
    const oldVisibilityCount = hiddenIds.length - cleanedHiddenIds.length;
    useEffect(() => { if (allRef.current) allRef.current.indeterminate = selection.mixed; }, [selection.mixed]);
    useEffect(() => {
        setSelectedIds(previous => reconcileAnnotationSelection(previous, catalog, catalogReady));
    }, [catalog, catalogReady]);
    useEffect(() => {
        // Undo or a catalogue reload can remove the selected group/type. Keep
        // the native selector and its local filter in agreement without writes.
        if (group.startsWith('group:') && !catalog.some(item => `group:${normalizeAnnotationGroupName(item.groupName)}` === group)) setGroup('all');
        if (type !== 'all' && !catalog.some(item => annotationLayerType(item) === type)) setType('all');
    }, [catalog, group, type]);

    const applySelectedGroup = async targetName => {
        const changes = selectedItems.some(item => normalizeAnnotationGroupName(item.groupName) !== targetName);
        if (disabled || groupsDisabled || saving || !selectedItems.length || !changes || !onGroupChange) return;
        // Capture the explicit selection. Filters and visibility never supply group targets.
        const ids = selectedItems.map(item => item.id);
        setSaving(true);
        setResult('');
        try {
            const saved = await onGroupChange(ids, targetName);
            setResult(saved === true ? 'saved' : 'failed');
            if (saved === true) {
                setSelectedIds([]);
                setOrganiseOpen(false);
            }
        } catch {
            setResult('failed');
        } finally { setSaving(false); }
    };
    const applyGroup = event => {
        event.preventDefault();
        if (name) return applySelectedGroup(name);
    };
    const changeSelection = (items, checked) => {
        if (disabled || saving || !catalogReady) return;
        setSelectedIds(previous => setAnnotationMatchesSelected(previous, items, checked));
        setResult('');
    };
    const clearSelection = () => {
        setSelectedIds([]);
        setOrganiseOpen(false);
    };
    const toggleGroup = key => setCollapsedGroups(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
    const recoverGroup = async (action, success) => {
        if (disabled || saving || !action) return;
        setSaving(true);
        try { setResult(await action() === true ? success : 'failed'); }
        catch { setResult('failed'); }
        finally { setSaving(false); }
    };
    const changeVisibility = (items, visible) => {
        if (disabled || saving) return;
        const planned = planAnnotationVisibilityChange(hiddenIds, items, visible);
        setVisibilityOverflow(!planned.allowed);
        if (planned.allowed) onVisibilityChange?.(planned.hiddenIds);
    };
    const cleanVisibility = () => {
        if (!catalogReady || disabled || saving || !oldVisibilityCount) return;
        // Only the full, loaded owner catalogue can establish that an id is old.
        // Search and type/group filters never decide what cleanup removes.
        onVisibilityChange?.(cleanedHiddenIds);
        setVisibilityOverflow(false);
    };

    return (
        <div className="annotation-layer-manager" data-annotation-layer-manager="true">
            <label htmlFor={`${id}-search`}>
                <span>{messages.search}</span>
                <input id={`${id}-search`} type="search" value={query} placeholder={messages.searchPlaceholder}
                    onChange={event => setQuery(event.target.value)} disabled={saving} />
            </label>
            <div className="annotation-layer-filters">
                <label htmlFor={`${id}-type`}>
                    <span>{messages.type}</span>
                    <select id={`${id}-type`} value={type} onChange={event => setType(event.target.value)} disabled={saving}>
                        <option value="all">{messages.allTypes}</option>
                        {types.map(value => <option key={value} value={value}>{messages[value] || messages.other}</option>)}
                    </select>
                </label>
                <label htmlFor={`${id}-group`}>
                    <span>{messages.group}</span>
                    <select id={`${id}-group`} value={group} onChange={event => setGroup(event.target.value)} disabled={saving}>
                        <option value="all">{messages.allGroups}</option>
                        <option value="ungrouped">{messages.ungrouped}</option>
                        {groups.map(value => <option key={value} value={`group:${value}`}>{value}</option>)}
                    </select>
                </label>
            </div>
            <p className="annotation-layer-count" role="status">{annotationLayerMessage(messages.results, summary)}</p>
            <div className="annotation-layer-selection">
                <div className="annotation-layer-selection-heading">
                    <strong data-annotation-selection-count="true">{annotationLayerMessage(messages.selectedCount, { count: selectedItems.length })}</strong>
                    <button type="button" className="annotation-layer-clear" data-annotation-selection-clear="true"
                        onClick={clearSelection} disabled={disabled || saving || !selectedIds.length}>{messages.clearSelection}</button>
                </div>
                <label className="annotation-layer-select-matches">
                    <input ref={allRef} type="checkbox" data-annotation-select-all="true" checked={selection.checked}
                        aria-checked={selection.mixed ? 'mixed' : selection.checked}
                        onChange={event => changeSelection(matches, event.target.checked)}
                        disabled={disabled || saving || !catalogReady || !onGroupChange || !matches.length} />
                    <span>{messages.selectMatches}</span>
                </label>
                {outsideCount ? <p className="annotation-layer-selection-hint">
                    {annotationLayerMessage(messages.selectedOutside, { count: outsideCount })}
                </p> : null}
                {onGroupChange ? <div className="annotation-layer-selection-actions">
                    <button type="button" className="annotation-layer-primary" data-annotation-group-selected="true"
                        disabled={disabled || groupsDisabled || saving || !selectedItems.length}
                        aria-expanded={organiseOpen} onClick={() => setOrganiseOpen(true)}>
                        {annotationLayerMessage(messages.groupSelected, { count: selectedItems.length })}
                    </button>
                    <button type="button" className="annotation-layer-secondary" data-annotation-group-ungroup="true"
                        aria-label={annotationLayerMessage(messages.ungroupSelectedCount, { count: selectedItems.length })}
                        title={selectedItems.length ? (groupedSelectionCount ? messages.ungroupSelected : messages.alreadyUngrouped) : undefined}
                        disabled={disabled || groupsDisabled || saving || !groupedSelectionCount}
                        onClick={() => applySelectedGroup('')}>{messages.ungroupSelected}</button>
                </div> : null}
                {organiseOpen && onGroupChange ? <form className="annotation-layer-organise" onSubmit={applyGroup}>
                    <p>{messages.groupHelp}</p>
                    <label htmlFor={`${id}-name`}><span>{messages.groupName}</span>
                        <input id={`${id}-name`} type="text" value={groupName} maxLength={ANNOTATION_GROUP_MAX_LENGTH}
                            list={`${id}-groups`} placeholder={messages.groupPlaceholder}
                            onChange={event => { setGroupName(event.target.value); setResult(''); }}
                            disabled={disabled || groupsDisabled || saving} required />
                    </label>
                    <datalist id={`${id}-groups`}>{groups.map(value => <option key={value} value={value} />)}</datalist>
                    {name && !changedCount && selectedItems.length ? <p>{messages.alreadyGrouped}</p> : null}
                    <div className="annotation-layer-selection-actions">
                        <button type="submit" className="annotation-layer-primary" data-annotation-group-apply="true"
                            disabled={disabled || groupsDisabled || saving || !name || !changedCount}>
                            {saving ? messages.moving : annotationLayerMessage(messages.applySelected, { count: selectedItems.length })}
                        </button>
                        <button type="button" className="annotation-layer-secondary" data-annotation-group-cancel="true"
                            onClick={() => setOrganiseOpen(false)} disabled={saving}>{messages.cancel}</button>
                    </div>
                </form> : null}
                <p className="annotation-layer-selection-hint">{messages.selectionHelp}</p>
                {resultKey || canUndoGroup ? <div className="annotation-layer-group-status">
                    {resultKey ? <p role={resultKey === 'failed' ? 'alert' : 'status'}>{messages[resultKey]}</p> : null}
                    {resultKey === 'failed' && onGroupRetry ? <button type="button" className="annotation-layer-secondary"
                        disabled={disabled || saving} onClick={() => recoverGroup(onGroupRetry, 'saved')}>{messages.retry}</button> : null}
                    {canUndoGroup && onGroupUndo ? <button type="button" className="annotation-layer-secondary"
                        disabled={disabled || saving} onClick={() => recoverGroup(onGroupUndo, 'undone')}>{messages.undo}</button> : null}
                </div> : null}
            </div>
            {visibilityOverflow ? <div className="annotation-layer-warning">
                <p role="alert">{messages.visibilityFull}</p>
                {oldVisibilityCount > 0 ? <><p>{messages.cleanupHelp}</p>
                    <button type="button" disabled={!catalogReady || disabled || saving} onClick={cleanVisibility}>
                        {annotationLayerMessage(messages.cleanup, { count: oldVisibilityCount })}
                    </button></> : null}
            </div> : null}
            <p className="annotation-layer-count">{messages.groupScope}</p>
            <div className="annotation-layer-groups">
                {!matches.length ? <p>{messages.noMatches}</p> : groupedItems.map((bucket, index) => {
                    const filtered = bucket.items.filter(item => matchIds.has(item.id));
                    if (!filtered.length) return null;
                    const label = bucket.name || messages.ungrouped;
                    const visible = annotationVisibilitySummary(bucket.items, hiddenIds);
                    const collapsed = collapsedGroups.has(bucket.key);
                    const membersId = `${id}-members-${index}`;
                    const eyeLabel = annotationLayerMessage(visible.checked ? messages.hideGroup : messages.showGroup,
                        { name: label, count: bucket.items.length });
                    return <section key={bucket.key} className="annotation-layer-group" data-annotation-group={bucket.key}>
                        <div className="annotation-layer-group-heading">
                            <button type="button" className="annotation-layer-group-toggle" data-annotation-group-toggle={bucket.key}
                                aria-expanded={!collapsed} aria-controls={membersId}
                                aria-label={annotationLayerMessage(collapsed ? messages.expandGroup : messages.collapseGroup, { name: label })}
                                onClick={() => toggleGroup(bucket.key)}>
                                <ChevronDown size={17} className={collapsed ? 'annotation-layer-chevron-collapsed' : ''} aria-hidden="true" />
                                <span><strong>{label} <span className="annotation-layer-group-total">({bucket.items.length})</span></strong>
                                    <small>{annotationLayerMessage(messages.groupVisible, visible)}
                                        {filtered.length !== bucket.items.length ? ` · ${annotationLayerMessage(messages.matchingCount, { count: filtered.length })}` : ''}</small>
                                </span>
                            </button>
                            <VisibilityButton summary={visible} label={eyeLabel} data-annotation-group-visibility={bucket.key}
                                disabled={disabled || saving || !catalogReady}
                                onClick={() => changeVisibility(bucket.items, !visible.checked)} />
                        </div>
                        <div id={membersId} className="annotation-layer-items" hidden={collapsed}>
                            {filtered.map(annotation => {
                                const isVisible = !hidden.has(annotation.id);
                                return <div key={annotation.id} className="annotation-layer-row" data-annotation-layer-item={annotation.id}>
                                    <label className="annotation-layer-check">
                                        <input type="checkbox" checked={selected.has(annotation.id)}
                                            aria-label={annotationLayerMessage(messages.selectItem, { name: annotation.label })}
                                            onChange={event => changeSelection([annotation], event.target.checked)}
                                            disabled={disabled || saving || !catalogReady || !onGroupChange} />
                                        <span className="annotation-layer-item-text"><span title={annotation.label}>{annotation.label}</span>
                                            <small>{messages[annotationLayerType(annotation)] || messages.other}</small>
                                        </span>
                                    </label>
                                    <VisibilityButton summary={{ visible: isVisible ? 1 : 0, total: 1, checked: isVisible, mixed: false }}
                                        label={annotationLayerMessage(isVisible ? messages.hideItem : messages.showItem, { name: annotation.label })}
                                        data-annotation-visibility={annotation.id} disabled={disabled || saving || !catalogReady}
                                        onClick={() => changeVisibility([annotation], !isVisible)} />
                                </div>;
                            })}
                        </div>
                    </section>;
                })}
            </div>
        </div>
    );
}
