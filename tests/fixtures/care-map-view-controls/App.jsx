// Fictional owner-page regression fixture. All remote requests are intercepted.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../client/src/contexts/AuthContext.jsx';
import { SavedAssetsProvider } from '../../../client/src/contexts/SavedAssetsContext.jsx';
import { MapStyleProvider } from '../../../client/src/contexts/MapStyleContext.jsx';
import { LocaleProvider } from '../../../client/src/contexts/LocaleContext.jsx';
import MyMapDetailPage from '../../../client/src/pages/MyMapDetailPage.jsx';
import SharedMapPage from '../../../client/src/pages/SharedMapPage.jsx';
import '../../../client/src/index.css';
import 'leaflet/dist/leaflet.css';
const requestedFontScale = Number(new URLSearchParams(location.search).get('fontScale') || 1);
document.documentElement.style.setProperty('--font-scale', [0.9, 1, 1.4].includes(requestedFontScale) ? requestedFontScale : 1);
const nav = <nav data-fixture-navbar style={{
  position: "sticky",
  top: 0,
  height: matchMedia("(min-width:640px)").matches ? 64 : 56,
  zIndex: 1300,
  background: "white"
}}>Fictional app navigation</nav>;
const route = new URLSearchParams(location.search).get('route') || '/my-directory/maps/91261012';
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[route]}><AuthProvider><LocaleProvider><MapStyleProvider><SavedAssetsProvider>{nav}<Routes><Route path="/my-directory/maps/:mapId" element={<MyMapDetailPage />} /><Route path="/shared/maps/:token" element={<SharedMapPage />} /></Routes></SavedAssetsProvider></MapStyleProvider></LocaleProvider></AuthProvider></MemoryRouter>);
