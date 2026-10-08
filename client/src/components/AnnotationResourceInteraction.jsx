import { createContext, useContext, useEffect, useRef } from 'react';
import { annotationResourceCardState } from '../lib/annotationResourceLinks.js';
import { isAnnotationTouchEvent, staysWithinAnnotationTarget } from '../lib/annotationResourceHover.js';
import './AnnotationResourceLinks.css';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getAnnotationMessages } from '../lib/annotationMessages.js';

export const AnnotationResourceInteractionContext = createContext(null);

export function useAnnotationResourceCard(group, enabled) {
    const { locale } = useLocale();
    const messages = getAnnotationMessages(locale);
    const context = useContext(AnnotationResourceInteractionContext);
    const interaction = enabled ? context : null;
    const state = annotationResourceCardState(group, interaction);
    const tokens = useRef({});
    const pointerType = useRef(null);
    const pointerDown = useRef(false);
    const linksKey = JSON.stringify(state.links);
    const clear = interaction?.onClearResources;
    useEffect(() => () => {
        for (const [channel, token] of Object.entries(tokens.current)) clear?.(state.links, channel, token);
        tokens.current = {};
    }, [clear, linksKey]);
    const activate = channel => {
        if (state.canActivate) tokens.current[channel] = interaction.onActivateResources(state.links, channel);
    };
    const deactivate = channel => {
        if (tokens.current[channel] == null) return;
        clear?.(state.links, channel, tokens.current[channel]);
        delete tokens.current[channel];
    };
    return { ...state,
        activateTouch: event => {
            const touch = state.canActivate && isAnnotationTouchEvent(event, pointerType.current);
            if (touch) activate('touch');
            return touch;
        },
        hoverProps: state.canActivate ? {
            onPointerDown: event => { pointerType.current = event.pointerType; pointerDown.current = true; },
            onPointerUp: () => { pointerDown.current = false; },
            onPointerCancel: () => { pointerDown.current = false; },
            onPointerEnter: event => { pointerType.current = event.pointerType; if (event.pointerType !== 'touch') activate('pointer'); },
            onPointerLeave: () => { pointerDown.current = false; deactivate('pointer'); },
            onFocus: event => { if (!pointerDown.current && !staysWithinAnnotationTarget(event)) activate('focus'); },
            onBlur: event => { if (!staysWithinAnnotationTarget(event)) deactivate('focus'); },
        } : {},
        label: `${messages.showLinkedAnnotation}: ${group?.name || ''}`,
        className: state.active ? `annotation-resource-card-highlight${state.pulsing ? ` annotation-resource-card-pulse${interaction.activationVersion && interaction.activationVersion % 2 === 0 ? ' annotation-resource-card-pulse-repeat' : ''}` : ''}` : '',
        attributes: state.active ? { 'data-annotation-resource-active': 'true', 'aria-description': messages.linkedAnnotation,
            style: { '--annotation-resource-glow-color': state.glowColor } } : {},
    };
}
