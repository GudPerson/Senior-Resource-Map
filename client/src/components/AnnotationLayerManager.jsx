import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { ANNOTATION_GROUP_MAX_LENGTH, normalizeAnnotationGroupName } from '../../../shared/annotationGroups.js';
import { annotationLayerType, annotationVisibilitySummary, filterAnnotationLayers, planAnnotationVisibilityChange, cleanOldAnnotationVisibility } from '../lib/annotationLayerManager.js';
import { annotationLayerMessage, getAnnotationLayerMessages } from '../lib/annotationLayerMessages.js';
import './AnnotationLayerManager.css';

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
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState('');
    const [visibilityOverflow, setVisibilityOverflow] = useState(false);
    const matches = filterAnnotationLayers(catalog, { query, type, group });
    const summary = annotationVisibilitySummary(matches, hiddenIds);
    const hidden = new Set(hiddenIds);
    const types = [...new Set(catalog.map(annotationLayerType))].sort();
    const groups = [...new Set(catalog.map(item => normalizeAnnotationGroupName(item.groupName)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const name = normalizeAnnotationGroupName(groupName);
    const changedCount = matches.filter(item => normalizeAnnotationGroupName(item.groupName) !== name).length;
    const resultKey = canRetryGroup ? 'failed' : result;
    const cleanedHiddenIds = cleanOldAnnotationVisibility(hiddenIds, catalog);
    const oldVisibilityCount = hiddenIds.length - cleanedHiddenIds.length;
    useEffect(() => { if (allRef.current) allRef.current.indeterminate = summary.mixed; }, [summary.mixed]);
    useEffect(() => {
        // Undo or a catalogue reload can remove the selected group/type. Keep
        // the native selector and its local filter in agreement without writes.
        if (group.startsWith('group:') && !catalog.some(item => `group:${normalizeAnnotationGroupName(item.groupName)}` === group)) setGroup('all');
        if (type !== 'all' && !catalog.some(item => annotationLayerType(item) === type)) setType('all');
    }, [catalog, group, type]);

    const applyGroup = async event => {
        event.preventDefault();
        if (disabled || groupsDisabled || saving || !changedCount || !onGroupChange) return;
        setSaving(true);
        setResult('');
        try {
            const saved = await onGroupChange(matches.map(item => item.id), name);
            setResult(saved === false ? 'failed' : 'saved');
            if (saved !== false && group !== 'all') setGroup(name ? `group:${name}` : 'ungrouped');
        } catch {
            setResult('failed');
        } finally { setSaving(false); }
    };
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
            <label className="annotation-layer-check annotation-layer-all">
                <input ref={allRef} type="checkbox" checked={summary.checked} aria-checked={summary.mixed ? 'mixed' : summary.checked}
                    onChange={event => changeVisibility(matches, event.target.checked)}
                    disabled={disabled || saving || !matches.length} />
                <span>{messages.showMatches}</span>
            </label>
            {visibilityOverflow ? <div className="annotation-layer-warning">
                <p role="alert">{messages.visibilityFull}</p>
                {oldVisibilityCount > 0 ? <><p>{messages.cleanupHelp}</p>
                    <button type="button" disabled={!catalogReady || disabled || saving} onClick={cleanVisibility}>
                        {annotationLayerMessage(messages.cleanup, { count: oldVisibilityCount })}
                    </button></> : null}
            </div> : null}
            {onGroupChange ? (
                <details className="annotation-layer-organise">
                    <summary>{messages.organise}</summary>
                    <form onSubmit={applyGroup}>
                        <p>{messages.groupHelp}</p>
                        <label htmlFor={`${id}-name`}><span>{messages.groupName}</span>
                            <input id={`${id}-name`} type="text" value={groupName} maxLength={ANNOTATION_GROUP_MAX_LENGTH}
                                list={`${id}-groups`} placeholder={messages.groupPlaceholder}
                                onChange={event => { setGroupName(event.target.value); setResult(''); }}
                                disabled={disabled || groupsDisabled || saving} />
                        </label>
                        <datalist id={`${id}-groups`}>{groups.map(value => <option key={value} value={value} />)}</datalist>
                        <button type="submit" disabled={disabled || groupsDisabled || saving || !changedCount}>
                            {saving ? messages.moving : annotationLayerMessage(name ? messages.move : messages.remove, { count: matches.length })}
                        </button>
                        <p>{messages.groupScope}</p>
                        {resultKey ? <p role={resultKey === 'failed' ? 'alert' : 'status'}>{messages[resultKey]}</p> : null}
                        {resultKey === 'failed' && onGroupRetry ? <button type="button" disabled={disabled || saving}
                            onClick={() => recoverGroup(onGroupRetry, 'saved')}>{messages.retry}</button> : null}
                        {canUndoGroup && onGroupUndo ? <button type="button" disabled={disabled || saving}
                            onClick={() => recoverGroup(onGroupUndo, 'undone')}>{messages.undo}</button> : null}
                    </form>
                </details>
            ) : null}
            <div className="annotation-layer-items">
                {!matches.length ? <p>{messages.noMatches}</p> : matches.map(annotation => (
                    <label key={annotation.id} className="annotation-layer-check" data-annotation-layer-item={annotation.id}>
                        <input type="checkbox" checked={!hidden.has(annotation.id)}
                            onChange={event => changeVisibility([annotation], event.target.checked)}
                            disabled={disabled || saving} />
                        <span className="annotation-layer-item-text"><span title={annotation.label}>{annotation.label}</span>
                            <small>{messages[annotationLayerType(annotation)] || messages.other}{annotation.groupName ? ` · ${annotation.groupName}` : ''}</small>
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
