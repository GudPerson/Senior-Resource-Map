import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../lib/api.js';
import {
    buildOptimisticSavedAsset,
    buildSavedAssetKey,
    selectBulkSavedAssetTargets,
} from '../lib/savedAssets.js';
import { loadSavedAssetsWithRetry } from '../lib/savedAssetsLoading.js';
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
    const [savedAssetsLoadError, setSavedAssetsLoadError] = useState('');
    const [pendingKeys, setPendingKeys] = useState([]);
    const [bulkPending, setBulkPending] = useState(false);
    const pendingKeysRef = useRef(new Set());
    const bulkPendingRef = useRef(false);

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
            setSavedAssetsLoadError('');
            return [];
        }

        setSavedAssetsLoading(true);
        setSavedAssetsLoadError('');
        try {
            const items = await loadSavedAssetsWithRetry(() => api.getSavedAssets({ suppressAuthExpired: true }));
            setSavedAssets(items);
            return items;
        } catch (err) {
            console.error(err);
            setSavedAssetsLoadError(err.message || 'Saved resources could not be loaded.');
            return savedAssets;
        } finally {
            setSavedAssetsLoading(false);
        }
    }, [savedAssets, user]);

    useEffect(() => {
        let isActive = true;

        async function loadSavedAssets() {
            if (!user) {
                setSavedAssets([]);
                setSavedAssetsLoading(false);
                setSavedAssetsLoadError('');
                pendingKeysRef.current.clear();
                syncPendingKeys();
                return;
            }

            setSavedAssetsLoading(true);
            setSavedAssetsLoadError('');
            try {
                const items = await loadSavedAssetsWithRetry(() => api.getSavedAssets({ suppressAuthExpired: true }));
                if (isActive) {
                    setSavedAssets(items);
                    setSavedAssetsLoadError('');
                }
            } catch (err) {
                console.error(err);
                if (isActive) {
                    setSavedAssetsLoadError(err.message || 'Saved resources could not be loaded.');
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
        if (!user || savedAssetsLoading || savedAssetsLoadError) return null;

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
    }, [savedAssetKeys, savedAssets, savedAssetsLoadError, savedAssetsLoading, syncPendingKeys, user]);

    const runBulkSavedAssetAction = useCallback(async (items, shouldSave) => {
        if (!user || savedAssetsLoading || savedAssetsLoadError || bulkPendingRef.current) return [];

        const targets = selectBulkSavedAssetTargets(items, savedAssetKeys, shouldSave);
        if (targets.length === 0) return [];

        bulkPendingRef.current = true;
        setBulkPending(true);

        const results = new Array(targets.length);
        const failures = [];
        let nextIndex = 0;

        async function runWorker() {
            while (nextIndex < targets.length) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                const target = targets[currentIndex];

                try {
                    results[currentIndex] = await toggleSavedAsset(target.resourceType, target.resourceId);
                } catch (err) {
                    failures.push(err);
                }
            }
        }

        try {
            const workerCount = Math.min(4, targets.length);
            await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

            if (failures.length > 0) {
                throw failures[0];
            }

            return results.filter(Boolean);
        } finally {
            bulkPendingRef.current = false;
            setBulkPending(false);
        }
    }, [savedAssetKeys, savedAssetsLoadError, savedAssetsLoading, toggleSavedAsset, user]);

    const bulkSaveSavedAssets = useCallback(
        (items) => runBulkSavedAssetAction(items, true),
        [runBulkSavedAssetAction],
    );

    const bulkRemoveSavedAssets = useCallback(
        (items) => runBulkSavedAssetAction(items, false),
        [runBulkSavedAssetAction],
    );

    return (
        <SavedAssetsContext.Provider
            value={{
                savedAssets,
                savedAssetsLoading,
                savedAssetsLoadError,
                savedAssetKeys,
                pendingKeys,
                bulkPending,
                refreshSavedAssets,
                isSaved,
                isSavedAssetPending,
                toggleSavedAsset,
                bulkSaveSavedAssets,
                bulkRemoveSavedAssets,
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
