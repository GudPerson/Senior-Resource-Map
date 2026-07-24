import {
    Bus,
    MapPin,
    PackageCheck,
    ShoppingBag,
    Trees,
    Utensils,
} from 'lucide-react';

const ICON_COMPONENTS = {
    bus: Bus,
    'map-pin': MapPin,
    'package-check': PackageCheck,
    'shopping-bag': ShoppingBag,
    trees: Trees,
    utensils: Utensils,
};

export const PERSONAL_PLACE_ICON_OPTIONS = [
    { key: 'shopping-bag', label: 'Shop' },
    { key: 'utensils', label: 'Food' },
    { key: 'bus', label: 'Transport' },
    { key: 'package-check', label: 'Pickup point' },
    { key: 'trees', label: 'Outdoor' },
    { key: 'map-pin', label: 'Other' },
];

export const PERSONAL_PLACE_COLOR_OPTIONS = [
    '#0F766E',
    '#C2410C',
    '#2563EB',
    '#7C3AED',
    '#15803D',
    '#475569',
    '#BE123C',
    '#A16207',
];

export function getPersonalPlaceIconComponent(iconKey) {
    return ICON_COMPONENTS[iconKey] || MapPin;
}

export function PersonalPlaceCategoryIcon({
    iconKey,
    iconUrl = null,
    size = 16,
    className = '',
    ...props
}) {
    if (iconUrl) {
        return (
            <img
                src={iconUrl}
                alt=""
                className={`object-contain ${className}`.trim()}
                style={{ width: size, height: size }}
                aria-hidden="true"
            />
        );
    }
    const Icon = getPersonalPlaceIconComponent(iconKey);
    return <Icon size={size} className={className} {...props} />;
}

export function renderPersonalPlaceIconMarkup(iconKey, {
    size = 16,
    color = 'currentColor',
    strokeWidth = 2.2,
    className = '',
} = {}) {
    const Icon = getPersonalPlaceIconComponent(iconKey);
    const iconNode = Icon.render?.({ size, color, strokeWidth, className }, null)?.props?.iconNode || [];
    const safeAttribute = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const children = iconNode.map(([tagName, attributes = {}]) => {
        const safeTag = ['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect'].includes(tagName)
            ? tagName
            : 'path';
        const attributeText = Object.entries(attributes)
            .filter(([name]) => name !== 'key')
            .map(([name, value]) => `${name}="${safeAttribute(value)}"`)
            .join(' ');
        return `<${safeTag}${attributeText ? ` ${attributeText}` : ''} />`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${safeAttribute(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${safeAttribute(className)}" aria-hidden="true">${children}</svg>`;
}

export function createPersonalPlaceIconDataUrl(iconKey, options = {}) {
    const markup = renderPersonalPlaceIconMarkup(iconKey, {
        size: 20,
        color: options.color || '#0F172A',
        strokeWidth: 2.2,
    });
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}
