import { useCallback } from 'react';
import { useSavedAssets } from './useSavedAssets.js';

export function useFavorites(user) {
    const {
        savedAssets,
        isSaved,
        isSavedAssetPending,
        toggleSavedAsset,
    } = useSavedAssets();

    const toggleFavorite = useCallback(async (id, type, summary = null) => {
        if (!user) return null;
        return toggleSavedAsset(type, id, summary);
    }, [toggleSavedAsset, user]);

    const isFavorite = useCallback((id, type) => (
        isSaved(type, id)
    ), [isSaved]);

    return {
        favorites: savedAssets,
        pendingFavorites: savedAssets.filter((item) => isSavedAssetPending(item.resourceType, item.resourceId)),
        toggleFavorite,
        isFavorite,
        isFavoritePending: (id, type) => isSavedAssetPending(type, id),
    };
}
