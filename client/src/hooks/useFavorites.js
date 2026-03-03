import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api.js';

export function useFavorites(user) {
    const [favorites, setFavorites] = useState([]);

    useEffect(() => {
        if (user) {
            api.getFavorites().then(setFavorites).catch(console.error);
        } else {
            setFavorites([]);
        }
    }, [user]);

    const toggleFavorite = useCallback(async (id, type) => {
        if (!user) return;
        try {
            await api.toggleFavorite(type, id);
            setFavorites(prev => {
                const exists = prev.find(f => f.resourceId === id && f.resourceType === type);
                if (exists) {
                    return prev.filter(f => !(f.resourceId === id && f.resourceType === type));
                } else {
                    return [...prev, { resourceId: id, resourceType: type }];
                }
            });
        } catch (err) {
            console.error(err);
        }
    }, [user]);

    const isFavorite = useCallback((id, type) => {
        return favorites.some(f => f.resourceId === id && f.resourceType === type);
    }, [favorites]);

    return { favorites, toggleFavorite, isFavorite };
}
