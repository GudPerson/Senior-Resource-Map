import React from 'react';
import { regionalDiscoveryCopy } from './regionalDiscoveryPresentation.js';

export default function RegionalServiceDetail({ entry, onBack, onDismiss, copy: overrides, headingRef }) {
    const copy = regionalDiscoveryCopy(overrides);
    if (!entry) return null;
    return <article className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onBack} className="min-h-[44px] min-w-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.back}</button>
            <button type="button" onClick={onDismiss} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.dismiss}</button>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold focus-visible:outline focus-visible:outline-2">{entry.name}</h2>
        <p className="text-sm text-slate-600">{entry.categoryLabel}</p>
        {entry.recommended && <p className="font-semibold text-teal-800">{copy.recommended}</p>}
        {entry.logoUrl && <img src={entry.logoUrl} alt="" className="h-16 w-16 object-contain" />}
        {entry.description && <p className="whitespace-pre-wrap">{entry.description}</p>}
        {!entry.description && entry.shortDescription && <p className="whitespace-pre-wrap">{entry.shortDescription}</p>}
        {entry.addressText && <p className="whitespace-pre-wrap">{entry.addressText}</p>}
        {entry.placement !== 'plotted' && <p className="text-sm text-slate-600">{entry.placement === 'intentionally-unplotted' ? copy.unplotted : copy.coordinatesUnavailable}</p>}
        {entry.distanceMeters !== null && <p>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(entry.distanceMeters / 1000)} km</p>}
        {entry.websiteUrl && <a href={entry.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-teal-800 underline focus-visible:outline focus-visible:outline-2">{copy.website}</a>}
        <dl className="space-y-3">{['email', 'phone'].map(channel => {
            const contact = entry.contacts[channel];
            return <div key={channel}>
                <dt className="font-semibold">{contact.status === 'available' ? (copy.contactLabels?.[contact.appliesTo]?.[channel] || contact.label) : copy[channel]}</dt>
                <dd>{contact.status === 'available' ? <>
                    {contact.appliesTo === 'entered-location' && <p className="text-sm">{copy.enquiry}</p>}
                    <a className="inline-flex min-h-[44px] items-center break-all text-teal-800 underline focus-visible:outline focus-visible:outline-2" href={contact.href}>{contact.value}</a>
                </> : <span>{contact.status === 'needs-postal' ? copy.needsPostal : contact.status === 'hidden' ? copy.hiddenContact : copy.unavailableContact}</span>}</dd>
            </div>;
        })}</dl>
        <p className="text-sm text-slate-600">{copy.disclaimer}</p>
    </article>;
}
