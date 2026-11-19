import { buildSavedAssetKey } from './savedAssets.js';
import { updateMatchingSelection } from './matchingSelection.js';

const assetKey = asset => buildSavedAssetKey(asset.resourceType, asset.resourceId);

// Resolve the same dependencies for a single offering or a bulk transaction.
// Explicit host IDs have priority even when those places are absent from Saved.
function requiredHostKeys(offerings, savedAssets) {
    const hardKeys = new Set();
    const keysByAddress = new Map();
    for (const asset of savedAssets) {
        if (asset.resourceType !== 'hard') continue;
        const key = assetKey(asset);
        hardKeys.add(key);
        if (asset.address) {
            const address = asset.address.trim();
            if (!keysByAddress.has(address)) keysByAddress.set(address, []);
            keysByAddress.get(address).push(key);
        }
    }
    const hosts = new Set();
    const addresses = new Set();
    for (const offering of offerings) {
        const ids = offering.hostHardAssetIds || (offering.hostHardAssetId ? [offering.hostHardAssetId] : []);
        if (ids.length === 0 && offering.address) addresses.add(offering.address.trim());
        for (const id of ids) {
            const key = buildSavedAssetKey('hard', id);
            if (hardKeys.has(key)) hosts.add(key);
        }
    }
    for (const address of addresses) {
        for (const key of keysByAddress.get(address) || []) hosts.add(key);
    }
    return hosts;
}

export function updateMatchingSavedSelection(selectedKeys, matchingAssets, savedAssets, checked) {
    const next = updateMatchingSelection(selectedKeys, matchingAssets.map(assetKey), checked);
    const offerings = checked
        ? matchingAssets.filter(asset => asset.resourceType === 'soft')
        : savedAssets.filter(asset => asset.resourceType === 'soft' && next.has(assetKey(asset)));
    const required = requiredHostKeys(offerings, savedAssets);
    const retainedHostNames = [];
    if (checked) {
        for (const key of required) next.add(key);
    } else {
        for (const asset of matchingAssets) {
            const key = assetKey(asset);
            if (selectedKeys.has(key) && required.has(key) && !next.has(key)) {
                next.add(key);
                retainedHostNames.push(asset.name);
            }
        }
    }
    return { selectedKeys: next, retainedHostNames };
}
