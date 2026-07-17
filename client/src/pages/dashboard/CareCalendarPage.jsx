import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Check,
    ChevronDown,
    FolderOpen,
    MapPin,
    Plus,
    RefreshCw,
} from 'lucide-react';

import { LoadingState } from '../../components/LoadingState.jsx';
import CalendarEventCard from '../../components/calendar/CalendarEventCard.jsx';
import {
    CalendarEmptyState,
    DayPlanner,
    MiniDateNavigator,
} from '../../components/calendar/DayCalendarView.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { api } from '../../lib/api.js';
import {
    getSingaporeDayKey,
    getSingaporeDayRange,
    SINGAPORE_TIMEZONE,
} from '../../lib/careCalendarDay.js';

function dateInputValue(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: SINGAPORE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function singaporeInputToIso(value) {
    if (!value) return null;
    return new Date(`${value}:00+08:00`).toISOString();
}

function combineAgenda(calendar) {
    const occurrenceStarts = new Set(
        calendar.occurrences.map((item) => (
            `${item.softAssetId}:${item.scheduleEntryKey || 'legacy-primary'}:${item.startsAt}`
        )),
    );
    const sourceEvents = calendar.occurrences.map((item) => ({
        ...item,
        kind: 'saved_activity',
        id: item.occurrenceId,
    }));
    const personalEvents = calendar.personalItems
        .filter((item) => (
            item.itemType === 'map_note'
            || !occurrenceStarts.has(`${item.softAssetId}:${item.sourceScheduleEntryKey || 'legacy-primary'}:${item.sourceStartsAt}`)
        ))
        .map((item) => ({
            ...item,
            kind: item.itemType,
        }));
    return [...sourceEvents, ...personalEvents]
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
}

export default function CareCalendarPage() {
    const { locale, t } = useLocale();
    const [searchParams, setSearchParams] = useSearchParams();
    const noteId = searchParams.get('noteId');
    const [selectedDayKey, setSelectedDayKey] = useState(() => getSingaporeDayKey());
    const [calendar, setCalendar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingKey, setPendingKey] = useState('');
    const [noteContext, setNoteContext] = useState(null);
    const loadRequestRef = useRef(0);
    const [noteForm, setNoteForm] = useState({
        title: '',
        startsAt: dateInputValue(new Date(Date.now() + 60 * 60 * 1000)),
        endsAt: '',
    });

    const loadCalendar = useCallback(async ({ preserveCalendar = false } = {}) => {
        const requestId = loadRequestRef.current + 1;
        loadRequestRef.current = requestId;
        setLoading(true);
        setError('');
        if (!preserveCalendar) setCalendar(null);
        try {
            const { from, to } = getSingaporeDayRange(selectedDayKey);
            const data = await api.getCalendar({
                from,
                to,
            });
            if (loadRequestRef.current !== requestId) return;
            setCalendar(data);
        } catch (loadError) {
            if (loadRequestRef.current !== requestId) return;
            console.error('Care Calendar load failed', loadError);
            setError(t('careCalendarLoadFailed'));
        } finally {
            if (loadRequestRef.current === requestId) setLoading(false);
        }
    }, [selectedDayKey, t]);

    useEffect(() => {
        void loadCalendar();
    }, [loadCalendar]);

    useEffect(() => {
        let active = true;
        if (!noteId) {
            setNoteContext(null);
            return undefined;
        }
        setError('');
        api.getCalendarMapNote(noteId)
            .then((context) => {
                if (!active) return;
                setNoteContext(context);
                setNoteForm((current) => ({
                    ...current,
                    title: context.suggestedTitle || current.title,
                }));
            })
            .catch((loadError) => {
                if (active) setError(loadError.message || t('careCalendarNoteLoadFailed'));
            });
        return () => {
            active = false;
        };
    }, [noteId, t]);

    const agendaEvents = useMemo(() => {
        if (!calendar) return [];
        return combineAgenda(calendar);
    }, [calendar]);

    async function handlePlan(event) {
        setPendingKey(event.id);
        setError('');
        try {
            await api.createCalendarItem({
                itemType: 'planned_session',
                softAssetId: event.softAssetId,
                sourceScheduleEntryKey: event.scheduleEntryKey,
                sourceStartsAt: event.startsAt,
            });
            await loadCalendar({ preserveCalendar: true });
        } catch (saveError) {
            setError(saveError.message || t('careCalendarSaveFailed'));
        } finally {
            setPendingKey('');
        }
    }

    async function handleRemove(itemId) {
        if (!itemId) return;
        setPendingKey(itemId);
        setError('');
        try {
            await api.deleteCalendarItem(itemId);
            await loadCalendar({ preserveCalendar: true });
        } catch (removeError) {
            setError(removeError.message || t('careCalendarRemoveFailed'));
        } finally {
            setPendingKey('');
        }
    }

    async function handleAcknowledge(softAssetId) {
        setPendingKey(`ack-${softAssetId}`);
        setError('');
        try {
            await api.acknowledgeCalendarSchedule(softAssetId);
            await loadCalendar({ preserveCalendar: true });
        } catch (acknowledgeError) {
            setError(acknowledgeError.message || t('careCalendarReviewFailed'));
        } finally {
            setPendingKey('');
        }
    }

    async function handleAddNote(event) {
        event.preventDefault();
        if (!noteContext) return;
        setPendingKey(`note-${noteContext.id}`);
        setError('');
        try {
            await api.createCalendarItem({
                itemType: 'map_note',
                mapAssetNoteId: noteContext.id,
                title: noteForm.title,
                startsAt: singaporeInputToIso(noteForm.startsAt),
                endsAt: singaporeInputToIso(noteForm.endsAt),
            });
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('noteId');
            setSearchParams(nextParams, { replace: true });
            setNoteContext(null);
            const createdDayKey = getSingaporeDayKey(singaporeInputToIso(noteForm.startsAt));
            if (createdDayKey === selectedDayKey) {
                await loadCalendar({ preserveCalendar: true });
            } else {
                setSelectedDayKey(createdDayKey);
            }
        } catch (saveError) {
            setError(saveError.message || t('careCalendarSaveFailed'));
        } finally {
            setPendingKey('');
        }
    }

    return (
        <div className="mx-auto max-w-[1240px] p-4 sm:p-6 lg:p-8">
            <header className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 px-5 py-3.5 text-white shadow-sm sm:px-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                            {t('careCalendarUpcomingTitle')}
                        </h1>
                        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-teal-50 sm:text-base">
                            {t('careCalendarIntro')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadCalendar({ preserveCalendar: true })}
                        disabled={loading}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 font-bold text-white hover:bg-white/20 disabled:opacity-60"
                    >
                        <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> {t('careCalendarRefresh')}
                    </button>
                </div>
            </header>

            {noteContext ? (
                <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
                    <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 flex-shrink-0 text-violet-700" size={20} />
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{t('careCalendarAddMapNoteTitle')}</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {t('careCalendarAddMapNoteFrom', { map: noteContext.mapName })}
                            </p>
                        </div>
                    </div>
                    <form onSubmit={handleAddNote} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarItemTitle')}</span>
                            <input
                                type="text"
                                value={noteForm.title}
                                onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))}
                                className="input-field w-full"
                                maxLength={255}
                                required
                            />
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarStarts')}</span>
                            <input
                                type="datetime-local"
                                value={noteForm.startsAt}
                                onChange={(event) => setNoteForm((current) => ({ ...current, startsAt: event.target.value }))}
                                className="input-field w-full"
                                required
                            />
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarEndsOptional')}</span>
                            <input
                                type="datetime-local"
                                value={noteForm.endsAt}
                                onChange={(event) => setNoteForm((current) => ({ ...current, endsAt: event.target.value }))}
                                className="input-field w-full"
                            />
                        </label>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <button
                                type="submit"
                                disabled={pendingKey === `note-${noteContext.id}`}
                                className="btn-primary justify-center disabled:opacity-60"
                            >
                                <Plus size={17} /> {t('careCalendarAdd')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextParams = new URLSearchParams(searchParams);
                                    nextParams.delete('noteId');
                                    setSearchParams(nextParams, { replace: true });
                                    setNoteContext(null);
                                }}
                                className="btn-secondary justify-center"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </form>
                </section>
            ) : null}

            {error ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    {error}
                </div>
            ) : null}

            {loading && !calendar ? (
                <LoadingState label={t('careCalendarLoading')} />
            ) : error && !calendar ? null : (
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <DayPlanner
                        emptyState={(
                            <>
                                <CalendarEmptyState t={t} />
                                <div className="mt-4 text-center">
                                    <Link to="/discover" className="btn-primary inline-flex justify-center">
                                        {t('overviewDiscoverTitle')}
                                    </Link>
                                </div>
                            </>
                        )}
                        events={agendaEvents}
                        locale={locale}
                        onSelectDay={setSelectedDayKey}
                        renderEvent={(event) => (
                            <CalendarEventCard
                                key={`${event.kind}-${event.id}`}
                                event={event}
                                locale={locale}
                                onAcknowledge={handleAcknowledge}
                                onPlan={handlePlan}
                                onRemove={handleRemove}
                                pendingKey={pendingKey}
                                t={t}
                            />
                        )}
                        selectedDayKey={selectedDayKey}
                        t={t}
                    />

                    <aside className="space-y-4">
                        <MiniDateNavigator
                            locale={locale}
                            onSelectDay={setSelectedDayKey}
                            selectedDayKey={selectedDayKey}
                            t={t}
                        />
                        {calendar?.savedWithoutSchedule?.length ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="font-bold text-slate-900">{t('careCalendarSavedNoSchedule')}</h2>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    {t('careCalendarSavedNoScheduleHelp')}
                                </p>
                                <div className="mt-3 space-y-2">
                                    {calendar.savedWithoutSchedule.slice(0, 8).map((item) => (
                                        <div
                                            key={item.softAssetId}
                                            className={`rounded-xl px-3 py-2 ${item.scheduleChanged ? 'border border-amber-200 bg-amber-50' : 'bg-slate-50'}`}
                                        >
                                            <Link
                                                to={item.detailPath}
                                                className="block text-sm font-semibold text-slate-700 hover:text-slate-900"
                                            >
                                                {item.title}
                                            </Link>
                                            {item.scheduleChanged ? (
                                                <div className="mt-2">
                                                    <p className="text-xs font-medium text-amber-800">
                                                        {t('careCalendarScheduleRemoved')}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAcknowledge(item.softAssetId)}
                                                        disabled={pendingKey === `ack-${item.softAssetId}`}
                                                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-900 disabled:opacity-60"
                                                    >
                                                        <Check size={13} /> {t('careCalendarMarkReviewed')}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                                <Link to="/my-directory" className="btn-secondary mt-4 w-full justify-center">
                                    <FolderOpen size={16} /> {t('careCalendarViewDirectory')}
                                </Link>
                            </div>
                        ) : null}
                        <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <summary className="cursor-pointer list-none font-bold text-slate-900 marker:hidden">
                                <span className="flex items-center justify-between gap-3">
                                    {t('careCalendarHowItWorks')}
                                    <ChevronDown className="text-slate-400 transition-transform group-open:rotate-180" size={18} aria-hidden="true" />
                                </span>
                            </summary>
                            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                                <li>{t('careCalendarSavedHelp')}</li>
                                <li>{t('careCalendarPlannedHelp')}</li>
                                <li>{t('careCalendarPrivateHelp')}</li>
                            </ul>
                        </details>
                    </aside>
                </div>
            )}
        </div>
    );
}
