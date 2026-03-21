import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ResourceDetailContent from '../../components/ResourceDetailContent.jsx';
import SaveAssetButton from '../../components/SaveAssetButton.jsx';
import { api } from '../../lib/api.js';

function resolveDetailTarget(pin) {
    if (pin?.primarySavedAsset?.resourceType && Number.isInteger(pin.primarySavedAsset.resourceId)) {
        return {
            type: pin.primarySavedAsset.resourceType,
            id: pin.primarySavedAsset.resourceId,
            fallbackAsset: pin.primarySavedAsset.liveAsset || null,
        };
    }

    if (pin?.placeAsset?.id) {
        return {
            type: 'hard',
            id: pin.placeAsset.id,
            fallbackAsset: pin.placeAsset,
        };
    }

    return null;
}

function buildSavedAssetSummary(asset, type) {
    if (!asset) return null;

    const primaryLocation = type === 'hard'
        ? asset
        : (asset.location || asset.locations?.[0] || null);

    return {
        name: asset.name,
        subCategory: asset.subCategory,
        address: type === 'hard' ? asset.address || null : primaryLocation?.address || null,
        lat: type === 'hard' ? asset.lat : primaryLocation?.lat,
        lng: type === 'hard' ? asset.lng : primaryLocation?.lng,
        detailPath: `/resource/${type}/${asset.id}`,
    };
}

export function DesktopSavedPlaceDetailPanel({
    onBack,
    paneWidth = 450,
    pin,
    subCatColors,
    userLocation,
}) {
    const navigate = useNavigate();
    const detailTarget = useMemo(() => resolveDetailTarget(pin), [pin]);
    const [asset, setAsset] = useState(detailTarget?.fallbackAsset || null);
    const [loading, setLoading] = useState(Boolean(detailTarget));

    useEffect(() => {
        let isActive = true;

        if (!detailTarget) {
            setAsset(null);
            setLoading(false);
            return undefined;
        }

        setAsset(detailTarget.fallbackAsset || null);
        setLoading(true);

        const loadDetailAsset = async () => {
            try {
                const nextAsset = detailTarget.type === 'hard'
                    ? await api.getHardAsset(detailTarget.id)
                    : await api.getSoftAsset(detailTarget.id);

                if (isActive) {
                    setAsset(nextAsset);
                }
            } catch (error) {
                console.error('Failed to load desktop resource detail', error);
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        loadDetailAsset();

        return () => {
            isActive = false;
        };
    }, [detailTarget]);

    if (!pin) return null;

    const title = asset?.name || detailTarget?.fallbackAsset?.name || pin.title;
    const savedAssetSummary = buildSavedAssetSummary(asset, detailTarget?.type || 'hard');
    const sortOriginLabel = userLocation ? 'Current location' : null;

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div
                className="flex items-center gap-3 border-b px-5 py-4"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.9)' }}
            >
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-slate-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    aria-label="Back to browse results"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--color-text-muted)' }}>
                        Resource detail
                    </p>
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {title}
                    </p>
                </div>
                {asset && detailTarget ? (
                    <SaveAssetButton
                        resourceId={asset.id}
                        resourceType={detailTarget.type}
                        summary={savedAssetSummary}
                        variant="inspector"
                    />
                ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
                {loading && !asset ? (
                    <div className="flex h-full items-center justify-center py-12">
                        <div className="h-10 w-10 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                    </div>
                ) : asset && detailTarget ? (
                    <ResourceDetailContent
                        asset={asset}
                        containerWidth={paneWidth}
                        layoutMode="pane"
                        onNavigateToResource={(resourceType, resourceId) => {
                            navigate(`/resource/${resourceType}/${resourceId}`);
                        }}
                        sortOrigin={userLocation}
                        sortOriginLabel={sortOriginLabel}
                        subCatColors={subCatColors}
                        type={detailTarget.type}
                    />
                ) : (
                    <div className="rounded-[28px] border px-6 py-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.88)' }}>
                        <p className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
                            Resource details are unavailable for this pin.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DesktopSavedPlaceDetailPanel;
