import { createContext, useContext } from 'react';

export const OwnerMapEditingCanvasContext = createContext(null);

export function useOwnerMapEditingCanvas() {
    return useContext(OwnerMapEditingCanvasContext);
}
