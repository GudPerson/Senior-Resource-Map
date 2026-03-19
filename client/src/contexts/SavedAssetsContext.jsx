import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../lib/api.js';
import { buildOptimisticSavedAsset, buildSavedAssetKey } from '../lib/savedAssets.js';
import { useAuth } from './AuthContext.jsx';

const SavedAssetsContext = createContext(null);

function removeSavedAssetByKey(items, assetKey) {
    return items.filter((item) => buildSavedAssetKey(item.resourceType, item.resourceId) !== assetKey);
}

function replaceSavedAsset(items, nextItem) {
    const assetKey = buildSavedAssetKey(nextItem.resourceType, nextItem.resourceId);
    return [nextItem, ...removeSavedAssetByKey(items, assetKey)];
}

export function SavedAssetsProvider({ children }) {
    const { user } = useAuth();
    const [savedAssets, setSavedAssets] = useState([]);
    const [savedAssetsLoading, setSavedAssetsLoading] = useState(false);
    const [pendingKeys, setPendingKeys] = useState([]);
    const pendingKeysRef = useRef(new Set());

    const savedAssetKeys = useMemo(
        () => new Set(savedAssets.map((item) => buildSavedAssetKey(item.resourceType, item.resourceId))),
        [savedAssets]
    );

    const syncPendingKeys = useCallback(() => {
        setPendingKeys([...pendingKeysRef.current]);
    }, []);

    const refreshSavedAssets = useCallback(async () => {
        if (!user) {
            setSavedAssets([]);
            setSavedAssetsLoading(false);
            return [];
        }

        setSavedAssetsLoading(true);
        try {
            const items = await api.getSavedAssets();
            setSavedAssets(Array.isArray(items) ? items : []);
            return items;
        } finally {
            setSavedAssetsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        let isActive = true;

        async function loadSavedAssets() {
            if (!user) {
                setSavedAssets([]);
                setSavedAssetsLoading(false);
                pendingKeysRef.current.clear();
                syncPendingKeys();
                return;
            }

            setSavedAssetsLoading(true);
            try {
                const items = await api.getSavedAssets();
                if (isActive) {
                    setSavedAssets(Array.isArray(items) ? items : []);
                }
            } catch (err) {
                console.error(err);
                if (isActive) {
                    setSavedAssets([]);
                }
            } finally {
                if (isActive) {
                    setSavedAssetsLoading(false);
                }
            }
        }

        loadSavedAssets();

        return () => {
            isActive = false;
        };
    }, [syncPendingKeys, user]);

    const isSaved = useCallback((resourceType, resourceId) => (
        savedAssetKeys.has(buildSavedAssetKey(resourceType, resourceId))
    ), [savedAssetKeys]);

    const isSavedAssetPending = useCallback((resourceType, resourceId) => (
        pendingKeysRef.current.has(buildSavedAssetKey(resourceType, resourceId))
    ), []);

    const toggleSavedAsset = useCallback(async (resourceType, resourceId, summary = null) => {
        if (!user) return null;

        const assetKey = buildSavedAssetKey(resourceType, resourceId);
        if (pendingKeysRef.current.has(assetKey)) {
            return null;
        }

        const currentlySaved = savedAssetKeys.has(assetKey);
        const existingItem = savedAssets.find((item) => buildSavedAssetKey(item.resourceType, item.resourceId) === assetKey) || null;

        pendingKeysRef.current.add(assetKey);
        syncPendingKeys();

        if (currentlySaved) {
            setSavedAssets((items) => removeSavedAssetByKey(items, assetKey));
        } else {
            setSavedAssets((items) => replaceSavedAsset(items, buildOptimisticSavedAsset(resourceType, resourceId, summary)));
        }

        try {
            const result = await api.toggleSavedAsset(resourceType, resourceId);

            setSavedAssets((items) => {
                const withoutItem = removeSavedAssetByKey(items, assetKey);
                if (!result?.saved || !result?.item) {
                    return withoutItem;
                }
                return replaceSavedAsset(withoutItem, result.item);
            });

            return result;
        } catch (err) {
            console.error(err);
            setSavedAssets((items) => {
                const withoutItem = removeSavedAssetByKey(items, assetKey);
                if (currentlySaved && existingItem) {
                    return replaceSavedAsset(withoutItem, existingItem);
                }
                return withoutItem;
            });
            throw err;
        } finally {
            pendingKeysRef.current.delete(assetKey);
            syncPendingKeys();
        }
    }, [savedAssetKeys, savedAssets, syncPendingKeys, user]);

    return (
        <SavedAssetsContext.Provider
            value={{
                savedAssets,
                savedAssetsLoading,
                savedAssetKeys,
                pendingKeys,
                refreshSavedAssets,
                isSaved,
                isSavedAssetPending,
                toggleSavedAsset,
            }}
        >
            {children}
        </SavedAssetsContext.Provider>
    );
}

export function useSavedAssetsContext() {
    const context = useContext(SavedAssetsContext);
    if (!context) {
        throw new Error('useSavedAssetsContext must be used inside SavedAssetsProvider');
    }

    return context;
}
