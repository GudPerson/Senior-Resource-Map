import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery.js';
import { ANNOTATION_RESOURCE_PULSE_MS, buildAnnotationLinkIndex, buildAnnotationResourceEffects,
    buildAnnotationResourceCatalog, resolveAnnotationResourceActivation,
    resourceLinksForGroup } from '../lib/annotationResourceLinks.js';
import { annotationActivationKey, beginAnnotationActivation, endAnnotationActivation } from '../lib/annotationResourceHover.js';
const NO_VISIBLE_ANNOTATIONS = [];

export default function useAnnotationResourceActivation({ mapId, viewId = '', directory,
    annotations = [], visibleAnnotationIds = null, enabled = true } = {}) {
    const [inputSlots, setInputSlots] = useState([]);
    const version = useRef(0);
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const contextKey = `${mapId || ''}:${viewId || ''}`;
    const scopeMatches = Boolean(mapId && String(directory?.id) === String(mapId));
    const catalog = useMemo(() => scopeMatches ? buildAnnotationResourceCatalog(directory) : [], [directory, scopeMatches]);
    const scopedVisibleIds = scopeMatches ? visibleAnnotationIds : NO_VISIBLE_ANNOTATIONS;
    const index = useMemo(() => buildAnnotationLinkIndex(annotations, catalog, scopedVisibleIds), [annotations, catalog, scopedVisibleIds]);
    const linkSignature = JSON.stringify([...index.byAnnotation].map(([id, item]) => [id, item.resourceLinks, item.resourceBehaviour]));
    const selection = inputSlots.at(-1);
    const current = enabled && scopeMatches && selection?.contextKey === contextKey && selection?.linkSignature === linkSignature ? selection : null;
    const clearActivation = useCallback(() => setInputSlots([]), []);
    useEffect(clearActivation, [clearActivation, contextKey, enabled, linkSignature, scopeMatches]);

    const activate = useCallback((next) => {
        if (!enabled || !scopeMatches) return;
        const resolved = resolveAnnotationResourceActivation(index, next);
        if (!resolved.annotationIds.length) return null;
        version.current += 1;
        const token = version.current;
        const slot = { ...next, key: annotationActivationKey(next), contextKey, linkSignature,
            activationVersion: token, startedAt: Date.now(), pulseActive: true };
        setInputSlots(slots => beginAnnotationActivation(slots, slot));
        return token;
    }, [contextKey, enabled, index, linkSignature, scopeMatches]);
    const deactivate = useCallback((next, token) => setInputSlots(slots =>
        endAnnotationActivation(slots, annotationActivationKey(next), token)), []);
    const activateAnnotation = useCallback((annotationId, channel = 'pointer') => activate({ origin: 'annotation', annotationId, channel }), [activate]);
    const activateResources = useCallback((resourceLinks, channel = 'pointer') => activate({ origin: 'resources', resourceLinks, channel }), [activate]);
    const clearAnnotation = useCallback((annotationId, channel = 'pointer', token) => deactivate({ origin: 'annotation', annotationId, channel }, token), [deactivate]);
    const clearResources = useCallback((resourceLinks, channel = 'pointer', token) => deactivate({ origin: 'resources', resourceLinks, channel }, token), [deactivate]);
    const activateResourceGroup = useCallback((group, channel) => activateResources(resourceLinksForGroup(group), channel), [activateResources]);

    useEffect(() => {
        if (!current?.pulseActive || reducedMotion) return undefined;
        const activationVersion = current.activationVersion;
        const timer = window.setTimeout(() => setInputSlots(slots => slots.map(slot =>
            slot.activationVersion === activationVersion ? { ...slot, pulseActive: false } : slot)),
        Math.max(0, ANNOTATION_RESOURCE_PULSE_MS - (Date.now() - current.startedAt)));
        return () => window.clearTimeout(timer);
    }, [current?.activationVersion, current?.pulseActive, reducedMotion]);

    const { activeIds, pulseIds, visibleIds, resourceKeys, annotationGlowColors, resourceGlowColors } = useMemo(() => buildAnnotationResourceEffects({
        annotations, index, selection: current, visibleAnnotationIds: scopedVisibleIds, enabled,
        pulseActive: Boolean(current?.pulseActive), reducedMotion,
    }), [annotations, current, enabled, index, reducedMotion, scopedVisibleIds]);
    const resourceCardInteraction = useMemo(() => ({ onActivateResources: activateResources, onClearResources: clearResources, resourceGlowColors,
        taggedResourceKeys: new Set(enabled && scopeMatches ? index.byResource.keys() : []), activeResourceKeys: new Set(resourceKeys),
        pulsingResourceKeys: new Set(pulseIds.size ? resourceKeys : []), activationVersion: current?.activationVersion || 0,
    }), [activateResources, clearResources, current?.activationVersion, enabled, index, pulseIds, resourceKeys, resourceGlowColors, scopeMatches]);
    return { activateAnnotation, clearAnnotation, activateResources, clearResources, activateResourceGroup, clearActivation,
        annotationEffects: { activeIds, pulseIds, visibleIds, annotationGlowColors, activationVersion: current?.activationVersion || 0 },
        visibleAnnotations: annotations.filter((annotation) => visibleIds.has(annotation.id)), resourceCardInteraction };
}
