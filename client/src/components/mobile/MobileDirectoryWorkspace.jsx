import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, MoreHorizontal, Rows3, Search } from 'lucide-react';

import MobileActionDock from './MobileActionDock.jsx';
import MobileBottomSheet from './MobileBottomSheet.jsx';

export default function MobileDirectoryWorkspace({
    title,
    eyebrow = 'Directory',
    summary = null,
    backHref = null,
    backLabel = 'Back',
    map,
    listContent = null,
    searchContent = null,
    distanceContent = null,
    moreContent = null,
}) {
    const [activeSheet, setActiveSheet] = useState(null);

    const actions = [
        listContent ? { key: 'list', label: 'List', icon: Rows3, onClick: () => setActiveSheet('list'), active: activeSheet === 'list' } : null,
        searchContent ? { key: 'search', label: 'Search', icon: Search, onClick: () => setActiveSheet('search'), active: activeSheet === 'search' } : null,
        distanceContent ? { key: 'distance', label: 'Distance', icon: MapPin, onClick: () => setActiveSheet('distance'), active: activeSheet === 'distance' } : null,
        moreContent ? { key: 'more', label: 'More', icon: MoreHorizontal, onClick: () => setActiveSheet('more'), active: activeSheet === 'more' } : null,
    ].filter(Boolean);

    const renderSheetContent = (content, key) => (
        typeof content === 'function'
            ? content({ closeSheet: () => setActiveSheet(null), sheetKey: key })
            : content
    );

    const renderSheet = (key, title, description, content) => {
        if (!content || activeSheet !== key) {
            return null;
        }

        return (
            <MobileBottomSheet
                open
                onOpenChange={(open) => setActiveSheet(open ? key : null)}
                title={title}
                description={description}
                headerActions={<button type="button" onClick={() => setActiveSheet(null)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">Done</button>}
            >
                {renderSheetContent(content, key)}
            </MobileBottomSheet>
        );
    };

    return (
        <>
            <div className="sticky top-[56px] z-30 -mx-4 border-b border-slate-200 bg-slate-50/96 px-4 py-3 backdrop-blur sm:top-[64px] sm:-mx-6 sm:px-6 disable-font-scaling">
                <div className="flex items-start gap-3">
                    {backHref ? (
                        <Link
                            to={backHref}
                            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                            aria-label={backLabel}
                        >
                            <ArrowLeft size={18} />
                        </Link>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                            {eyebrow}
                        </p>
                        <h1 className="mt-1 truncate text-[1.1rem] font-extrabold leading-tight text-slate-900">
                            {title}
                        </h1>
                        {summary ? (
                            <p className="mt-1 text-[12px] leading-5 text-slate-500">
                                {summary}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
                    {map}
                </div>

                <div className="sticky bottom-3 z-30 px-1 pb-[calc(env(safe-area-inset-bottom)+4px)]">
                    <MobileActionDock actions={actions} />
                </div>
            </div>

            {renderSheet('list', 'Directory list', 'Browse places and related resources without leaving the map.', listContent)}
            {renderSheet('search', 'Search directory', 'Find places and resources within this directory.', searchContent)}
            {renderSheet('distance', 'Distance anchor', 'Change how nearby distances are measured on this directory.', distanceContent)}
            {renderSheet('more', 'More actions', 'Access secondary actions without crowding the map workspace.', moreContent)}
        </>
    );
}
