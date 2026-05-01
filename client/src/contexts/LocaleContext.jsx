import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LOCALE, LOCALES, isSupportedLocale, translateUi } from '../lib/i18n.js';

const STORAGE_KEY = 'carearound_locale';

const LocaleContext = createContext({
    locale: DEFAULT_LOCALE,
    locales: LOCALES,
    setLocale: () => {},
    t: (key, params) => translateUi(DEFAULT_LOCALE, key, params),
});

function readStoredLocale() {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
    const [locale, setLocaleState] = useState(readStoredLocale);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale]);

    function setLocale(nextLocale) {
        const normalized = isSupportedLocale(nextLocale) ? nextLocale : DEFAULT_LOCALE;
        setLocaleState(normalized);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, normalized);
            document.documentElement.lang = normalized;
        }
    }

    const value = useMemo(() => ({
        locale,
        locales: LOCALES,
        setLocale,
        t: (key, params) => translateUi(locale, key, params),
    }), [locale]);

    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    return useContext(LocaleContext);
}
