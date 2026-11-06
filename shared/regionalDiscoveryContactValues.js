/** Policy-free syntax and URI derivation shared by regional producers/consumers. */
export function buildRegionalContactHref(field, value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (field === 'email') {
        const [localPart, domain, ...extraParts] = value.split('@');
        if (
            extraParts.length || !domain || value.length > 254 || localPart.length > 64
            || !/^[A-Za-z0-9!#$%&'*+/=^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=^_`{|}~-]+)*$/.test(localPart)
        ) return null;
        const domainLabels = domain.split('.');
        if (
            domainLabels.length < 2
            || domainLabels.some((label) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))
            || !/^[A-Za-z]{2,63}$/.test(domainLabels.at(-1))
        ) return null;
        return `mailto:${encodeURIComponent(value).replace(/%40/g, '@')}`;
    }
    if (field === 'phone') {
        if (!/^\+?[\d ()-]+$/.test(value)) return null;
        const destination = value.replace(/[ ()-]/g, '');
        return /^\+?\d{3,15}$/.test(destination) ? `tel:${destination}` : null;
    }
    return null;
}
