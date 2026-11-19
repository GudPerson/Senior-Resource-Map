import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { getAddressSnapshotMetadata, scanAddressAreaBatch } from '../lib/addressSnapshotClient.js';
import { createWholeAreaAddressScan } from '../lib/wholeAreaAddressScan.js';

export function useWholeAreaAddressScan({ area, scopeKey }) {
    const scan = useMemo(() => {
        const controller = createWholeAreaAddressScan({ getMetadata: getAddressSnapshotMetadata, scanBatch: scanAddressAreaBatch });
        return { ...controller, start: () => controller.start(area) };
    }, [area, scopeKey]);
    useLayoutEffect(() => scan.reset, [scan]);
    const snapshot = useSyncExternalStore(scan.subscribe, scan.getSnapshot, scan.getSnapshot);
    return { ...snapshot, start: scan.start, resume: scan.resume, reset: scan.reset };
}
