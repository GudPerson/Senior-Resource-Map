import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery.js';
import { ANNOTATION_RESOURCE_PULSE_MS, buildAnnotationLinkIndex, buildAnnotationResourceEffects,
    buildAnnotationResourceCatalog, resolveAnnotationResourceActivation,
    resourceLinksForGroup } from '../lib/annotationResourceLinks.js';
const NO_VISIBLE_ANNOTATIONS = [];

export default function useAnnotationResourceActivation({ mapId, viewId = '', directory,
    annotations = [], visibleAnnotationIds = null, enabled = true } = {}) {
    const [selection, setSelection] = useState(null);
    const version = useRef(0);
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const contextKey = `${mapId || ''}:${viewId || ''}`;
    const scopeMatches = Boolean(mapId && String(directory?.id) === String(mapId));
    const catalog = useMemo(() => scopeMatches ? buildAnnotationResourceCatalog(directory) : [], [directory, scopeMatches]);
    const scopedVisibleIds = scopeMatches ? visibleAnnotationIds : NO_VISIBLE_ANNOTATIONS;
    const index = useMemo(() => buildAnnotationLinkIndex(annotations, catalog, scopedVisibleIds), [annotations, catalog, scopedVisibleIds]);
    const linkSignature = JSON.stringify([...index.byAnnotation].map(([id, item]) => [id, item.resourceLinks, item.resourceBehaviour]));
    const current = enabled && scopeMatches && selection?.contextKey === contextKey && selection?.linkSignature === linkSignature ? selection : null;
    const clearActivation = useCallback(() => setSelection(null), []);
    useEffect(clearActivation, [clearActivation, contextKey, enabled, linkSignature]);

    const activate = useCallback((next) => {
        if (!enabled || !scopeMatches) return;
        const resolved = resolveAnnotationResourceActivation(index, next);
        if (!resolved.annotationIds.length) { setSelection(null); return; }
        version.current += 1;
        setSelection({ ...next, contextKey, linkSignature, activationVersion: version.current, pulseActive: true });
    }, [contextKey, enabled, index, linkSignature, scopeMatches]);
    const activateAnnotation = useCallback((annotationId) => activate({ origin: 'annotation', annotationId }), [activate]);
    const activateResources = useCallback((resourceLinks) => activate({ origin: 'resources', resourceLinks }), [activate]);
    const activateResourceGroup = useCallback((group) => activateResources(resourceLinksForGroup(group)), [activateResources]);

    useEffect(() => {
        if (!current?.pulseActive || reducedMotion) return undefined;
        const activationVersion = current.activationVersion;
        const timer = window.setTimeout(() => setSelection((value) => value?.activationVersion === activationVersion
            ? { ...value, pulseActive: false } : value), ANNOTATION_RESOURCE_PULSE_MS);
        return () => window.clearTimeout(timer);
    }, [current?.activationVersion, current?.pulseActive, reducedMotion]);

    const { activeIds, pulseIds, visibleIds, resourceKeys } = useMemo(() => buildAnnotationResourceEffects({
        annotations, index, selection: current, visibleAnnotationIds: scopedVisibleIds, enabled,
        pulseActive: Boolean(current?.pulseActive), reducedMotion,
    }), [annotations, current, enabled, index, reducedMotion, scopedVisibleIds]);
    const resourceCardInteraction = useMemo(() => ({ onActivateResources: activateResources,
        taggedResourceKeys: new Set(enabled && scopeMatches ? index.byResource.keys() : []), activeResourceKeys: new Set(resourceKeys),
        pulsingResourceKeys: new Set(pulseIds.size ? resourceKeys : []), activationVersion: current?.activationVersion || 0,
    }), [activateResources, current?.activationVersion, enabled, index, pulseIds, resourceKeys, scopeMatches]);
    return { activateAnnotation, activateResources, activateResourceGroup, clearActivation,
        annotationEffects: { activeIds, pulseIds, visibleIds, activationVersion: current?.activationVersion || 0 },
        visibleAnnotations: annotations.filter((annotation) => visibleIds.has(annotation.id)), resourceCardInteraction };
}
