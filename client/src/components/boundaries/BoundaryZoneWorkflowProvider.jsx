import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useSavedAssets } from '../../hooks/useSavedAssets.js';
import { createBoundaryWorkflowSession, rememberBoundaryWorkflowPointers } from '../../lib/boundaryZoneWorkflow.js';

const Context = createContext(null);
export function useBoundaryZoneWorkflow() { return useContext(Context); }
export default function BoundaryZoneWorkflowProvider({ ownerId, children }) {
    const navigate = useNavigate(), location = useLocation();
    const { applySavedAssetsSnapshot } = useSavedAssets();
    const [, render] = useState(0), adapters = useRef(null), instance = useRef(null);
    const recovery = useRef({lastOwner:null,allowed:true});
    if (recovery.current.lastOwner && String(ownerId || '') !== recovery.current.lastOwner) recovery.current.allowed=false;
    if(ownerId) recovery.current.lastOwner=String(ownerId);
    adapters.current = { navigate, applySavedAssetsSnapshot, pathname:location.pathname };
    if (!instance.current) instance.current = createBoundaryWorkflowSession({ ownerId, api,
        onNavigate: (path, state) => adapters.current.navigate(path, { state }),
        onPointers: state => rememberBoundaryWorkflowPointers(window.history,state),
        onSavedAssets: (items, owner) => adapters.current.applySavedAssetsSnapshot(items, owner),
    });
    const session = instance.current;
    // Set owner during render so children cannot consume the prior owner's usable draft.
    session.setOwner(ownerId);
    session.setRouteEntry(location.key);
    useEffect(() => session.subscribe(() => render(value => value + 1)), [session]);
    useEffect(() => {
        if (ownerId && recovery.current.allowed && !session.loggingOut && !session.draft && location.state?.boundaryWorkflowId) {
            recovery.current.allowed=false;
            session.recoverPointers(location.state).catch(() => {});
        }
    }, [ownerId, location.key, session]);
    const value = { session, draft:session.draft, epoch:session.generation, loggingOut:session.loggingOut,
        startDraw:session.startDraw, acceptSavedBoundary:session.acceptSavedBoundary, cancel:session.cancel, clear:session.clear };
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
