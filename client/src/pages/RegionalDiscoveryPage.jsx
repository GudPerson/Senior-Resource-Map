import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DEFAULT_LOCALE, LOCALES, translateUi } from '../lib/i18n.js';
import { buildDiscoveryHandoffUrl } from '../lib/regionalDiscoveryApi.js';
import useRegionalDiscovery from '../features/regional-discovery/useRegionalDiscovery.js';
import RegionalDiscoveryView from '../features/regional-discovery/RegionalDiscoveryView.jsx';
import { REGIONAL_DISCOVERY_COPY } from '../features/regional-discovery/regionalDiscoveryPresentation.js';

/** Shared translated view copy for guest and owner Preview hosts. */
export function getRegionalDiscoveryCopy(t) {
    const copy = Object.fromEntries(Object.keys(REGIONAL_DISCOVERY_COPY).filter(key => key !== 'evaluationMessages').map(key => [key,t(`regionalDiscovery${key[0].toUpperCase()}${key.slice(1)}`)]));
    copy.evaluationMessages = Object.fromEntries(['none','inside-region','outside-region','coverage-unconfirmed','postal-unresolved'].map(status => [status,t(`regionalDiscoveryStatus${status.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join('')}`)]));
    copy.contactLabels = {
        service:{email:t('regionalDiscoveryServiceEmail'),phone:t('regionalDiscoveryServicePhone')},
        'entered-location':{email:t('regionalDiscoveryLocationEmail'),phone:t('regionalDiscoveryLocationPhone')},
    };
    return copy;
}

function RegionalDiscoveryViewer({token}) {
    // Guest preferences and postal context live only for this viewer identity.
    const [locale,setLocale] = useState(DEFAULT_LOCALE);
    const t = key => translateUi(locale,key);
    const {postalInput,setPostalInput,submitPostal,clearPostal,state,retry} = useRegionalDiscovery({token});
    const copy = getRegionalDiscoveryCopy(t);
    const uncertain = ['coverage-unconfirmed','postal-unresolved'].includes(state.payload?.evaluation.status);
    const outside = state.payload?.evaluation.status === 'outside-region' && state.payload.evaluation.postalCode === postalInput && /^\d{6}$/.test(postalInput);
    const error = state.error ? t(state.error === 'invalid-postal' ? 'regionalDiscoveryInvalidPostal' : state.error === 'unavailable' ? 'regionalDiscoveryUnavailable' : 'regionalDiscoveryRequestFailed') : '';
    return <div lang={locale} className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white">
        <nav className="flex shrink-0 flex-wrap items-center gap-2 border-b p-2" aria-label={t('language')}>
            <label className="flex items-center gap-2">{t('language')}
                <select value={locale} onChange={event=>setLocale(event.target.value)} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">
                    {LOCALES.map(option=><option key={option.code} value={option.code}>{option.shortLabel}</option>)}
                </select>
            </label>
            {(state.error || uncertain) && <button type="button" disabled={state.loading || state.evaluating} onClick={()=>void retry()} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{t('regionalDiscoveryRetry')}</button>}
            {outside && <a href={buildDiscoveryHandoffUrl({postalCode:postalInput})} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center rounded border px-3 text-teal-800 underline focus-visible:outline focus-visible:outline-2">{t('regionalDiscoveryContinue')}</a>}
        </nav>
        <RegionalDiscoveryView payload={state.payload} loading={state.loading} evaluating={state.evaluating} error={error}
            postalInput={postalInput} onPostalInputChange={setPostalInput} onEvaluate={submitPostal} onClearPostal={clearPostal}
            copy={copy} className="flex-1" />
    </div>;
}

export default function RegionalDiscoveryPage() {
    const {token = ''} = useParams();
    return <RegionalDiscoveryViewer key={token} token={token} />;
}
