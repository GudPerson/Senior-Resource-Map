import { createContext, useContext } from 'react';
import { annotationResourceCardState } from '../lib/annotationResourceLinks.js';
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
    return { ...state,
        activate: () => { if (state.canActivate) interaction.onActivateResources(state.links); },
        label: `${messages.showLinkedAnnotation}: ${group?.name || ''}`,
        className: state.active ? `annotation-resource-card-highlight${state.pulsing ? ` annotation-resource-card-pulse${interaction.activationVersion && interaction.activationVersion % 2 === 0 ? ' annotation-resource-card-pulse-repeat' : ''}` : ''}` : '',
        attributes: state.active ? { 'data-annotation-resource-active': 'true', 'aria-description': messages.linkedAnnotation } : {},
    };
}
