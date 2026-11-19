import { buildSavedAssetKey } from './savedAssets.js';

export function getMyMapAssetKey(asset) {
    return String(asset?.assetKey || buildSavedAssetKey(asset?.resourceType, asset?.resourceId));
}

export function buildMyMapAssetMutationPlan(currentAssets = [], selectedAssets = []) {
    const currentKeys = new Set(currentAssets.map(getMyMapAssetKey));
    const targetKeys = new Set(selectedAssets.map(getMyMapAssetKey));

    return {
        targetKeys,
        toAdd: selectedAssets.filter((asset) => !currentKeys.has(getMyMapAssetKey(asset))),
        toRemove: currentAssets.filter((asset) => !targetKeys.has(getMyMapAssetKey(asset))),
    };
}

export function isMyMapAssetSelectionReconciled(currentAssets = [], targetKeys = new Set()) {
    const currentKeys = new Set(currentAssets.map(getMyMapAssetKey));
    if (currentKeys.size !== targetKeys.size) return false;
    return [...targetKeys].every((key) => currentKeys.has(key));
}

export function mergeRetainedMyMapAssets(currentAssets, selectedSavedAssets, retainedExistingKeys) {
    const selectedKeys = new Set(selectedSavedAssets.map(getMyMapAssetKey));
    const target = [...selectedSavedAssets];
    for (const asset of currentAssets) {
        const key = getMyMapAssetKey(asset);
        if (retainedExistingKeys.has(key) && !selectedKeys.has(key)) {
            selectedKeys.add(key);
            target.push(asset);
        }
    }
    return target;
}
