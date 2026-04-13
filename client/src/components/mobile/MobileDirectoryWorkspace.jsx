import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, MoreHorizontal, Rows3, Search } from 'lucide-react';

function MobileWorkspaceTab({ action, active, onClick }) {
    const Icon = action.icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-2 py-2 text-center transition-all ${
                active
                    ? 'border border-brand-100 bg-white text-brand-700 shadow-[0_10px_20px_rgba(15,89,91,0.12)]'
                    : 'border border-transparent bg-transparent text-slate-500'
            }`}
            aria-pressed={active}
            aria-label={action.label}
        >
            {Icon ? <Icon size={18} /> : null}
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] leading-none">
                {action.label}
            </span>
        </button>
    );
}

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
    const panels = useMemo(() => ([
        listContent ? {
            key: 'list',
            label: 'List',
            icon: Rows3,
            title: 'Directory list',
            description: 'Browse the places and offerings in this shared map without losing your map context.',
            content: listContent,
        } : null,
        searchContent ? {
            key: 'search',
            label: 'Search',
            icon: Search,
            title: 'Search this map',
            description: 'Filter the map and the directory together so nearby results still feel connected.',
            content: searchContent,
        } : null,
        distanceContent ? {
            key: 'distance',
            label: 'Distance',
            icon: MapPin,
            title: 'Distance anchor',
            description: 'Change the location reference used for nearby distance labels across this shared map.',
            content: distanceContent,
        } : null,
        moreContent ? {
            key: 'more',
            label: 'More',
            icon: MoreHorizontal,
            title: 'More actions',
            description: 'Secondary actions live here so the main map flow stays focused and easy to scan.',
            content: moreContent,
        } : null,
    ].filter(Boolean)), [distanceContent, listContent, moreContent, searchContent]);

    const [activePanelKey, setActivePanelKey] = useState(() => panels[0]?.key || null);

    useEffect(() => {
        if (!panels.length) {
            setActivePanelKey(null);
            return;
        }

        if (!panels.some((panel) => panel.key === activePanelKey)) {
            setActivePanelKey(panels[0].key);
        }
    }, [activePanelKey, panels]);

    const activePanel = panels.find((panel) => panel.key === activePanelKey) || panels[0] || null;

    const renderPanelContent = (panel) => {
        if (!panel?.content) return null;

        return typeof panel.content === 'function'
            ? panel.content({
                closeSheet: () => setActivePanelKey('list'),
                sheetKey: panel.key,
            })
            : panel.content;
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_22px_54px_rgba(15,23,42,0.08)]">
                <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(84,197,193,0.16),_transparent_55%),linear-gradient(180deg,rgba(248,252,252,0.98),rgba(255,255,255,0.96))] px-4 py-4">
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
                            <h1 className="mt-1 text-[1.28rem] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
                                {title}
                            </h1>
                            {summary ? (
                                <p className="mt-2 text-[13px] leading-5 text-slate-500">
                                    {summary}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="px-3 pb-3 pt-3">
                    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        {map}
                    </div>
                </div>
            </section>

            {activePanel ? (
                <section className="relative -mt-7 rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.12)]">
                    <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

                    <div className="px-3 pb-3 pt-3">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/92 p-1.5">
                            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}>
                                {panels.map((panel) => (
                                    <MobileWorkspaceTab
                                        key={panel.key}
                                        action={panel}
                                        active={panel.key === activePanel.key}
                                        onClick={() => setActivePanelKey(panel.key)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                    Workspace
                                </p>
                                <h2 className="mt-1 text-[1.02rem] font-extrabold leading-tight text-slate-900">
                                    {activePanel.title}
                                </h2>
                                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                                    {activePanel.description}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            {renderPanelContent(activePanel)}
                        </div>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
