import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { A11yProvider } from './contexts/A11yContext.jsx';
import { LocaleProvider, useLocale } from './contexts/LocaleContext.jsx';
import { MapStyleProvider } from './contexts/MapStyleContext.jsx';

const EmbeddedMapPage = lazy(() => import('./pages/EmbeddedMapPage.jsx'));

function EmbeddedMapLoading() {
    const { t } = useLocale();
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-sm font-semibold text-slate-600">
            {t('embedMapLoading')}
        </div>
    );
}

export default function EmbeddedApp() {
    return (
        <A11yProvider>
            <MapStyleProvider>
                <LocaleProvider>
                    <BrowserRouter>
                        <Suspense fallback={<EmbeddedMapLoading />}>
                            <Routes>
                                <Route path="/embed/maps/:token" element={<EmbeddedMapPage />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Suspense>
                    </BrowserRouter>
                </LocaleProvider>
            </MapStyleProvider>
        </A11yProvider>
    );
}
