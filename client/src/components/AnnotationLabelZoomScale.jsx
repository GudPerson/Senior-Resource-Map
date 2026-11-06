import { useLayoutEffect } from 'react';
import { useMap } from 'react-leaflet';
import {
    ANNOTATION_LABEL_SCALE_PROPERTY,
    getAnnotationLabelZoomScale,
} from '../lib/annotationLabelPresentation.js';
import './AnnotationLabelZoomScale.css';

export default function AnnotationLabelZoomScale() {
    const map = useMap();
    useLayoutEffect(() => {
        const container = map.getContainer();
        const previous = container.style.getPropertyValue(ANNOTATION_LABEL_SCALE_PROPERTY);
        const priority = container.style.getPropertyPriority(ANNOTATION_LABEL_SCALE_PROPERTY);
        const sync = () => container.style.setProperty(
            ANNOTATION_LABEL_SCALE_PROPERTY,
            String(getAnnotationLabelZoomScale(map.getZoom())),
        );
        sync();
        map.on('zoom zoomend', sync);
        return () => {
            map.off('zoom zoomend', sync);
            if (previous) container.style.setProperty(ANNOTATION_LABEL_SCALE_PROPERTY, previous, priority);
            else container.style.removeProperty(ANNOTATION_LABEL_SCALE_PROPERTY);
        };
    }, [map]);
    return null;
}
