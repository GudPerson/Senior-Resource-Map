import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    Check,
    Clock3,
    MapPin,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';

import { LoadingState } from '../../components/LoadingState.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { api } from '../../lib/api.js';

const SINGAPORE_TIMEZONE = 'Asia/Singapore';

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

function formatDay(value, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(value));
}

function formatTime(value, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function dayKey(value) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: SINGAPORE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value));
}

function combineAgenda(calendar) {
    const occurrenceStarts = new Set(
        calendar.occurrences.map((item) => (
            `${item.softAssetId}:${item.startsAt}`
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
            || !occurrenceStarts.has(`${item.softAssetId}:${item.sourceStartsAt}`)
        ))
        .map((item) => ({
            ...item,
            kind: item.itemType,
        }));
    return [...sourceEvents, ...personalEvents]
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
}

function AgendaCard({
    event,
    locale,
    onAcknowledge,
    onPlan,
    onRemove,
    pendingKey,
    t,
}) {
    const isSource = event.kind === 'saved_activity';
    const isMapNote = event.kind === 'map_note';
    const isPending = pendingKey === event.id
        || pendingKey === event.plannedItemId
        || pendingKey === `ack-${event.softAssetId}`;

    return (
        <article className={`rounded-2xl border bg-white p-4 shadow-sm ${event.scheduleChanged || event.needsReview ? 'border-amber-300' : 'border-slate-200'}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isMapNote ? 'bg-violet-50 text-violet-700' : event.isPlanned || event.kind === 'planned_session' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                            {isMapNote ? <MapPin size={13} /> : event.isPlanned || event.kind === 'planned_session' ? <CalendarCheck size={13} /> : <CalendarDays size={13} />}
                            {isMapNote
                                ? t('careCalendarMapNote')
                                : event.isPlanned || event.kind === 'planned_session'
                                    ? t('careCalendarPlanned')
                                    : t('careCalendarSavedActivity')}
                        </span>
                        {event.status === 'cancelled' ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                {t('careCalendarCancelled')}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{event.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Clock3 size={15} />
                        {formatTime(event.startsAt, locale)}
                        {event.endsAt ? ` – ${formatTime(event.endsAt, locale)}` : ''}
                    </p>
                    {event.address ? (
                        <p className="mt-1 flex items-start gap-2 text-sm text-slate-500">
                            <MapPin size={15} className="mt-0.5 flex-shrink-0" />
                            {event.address}
                        </p>
                    ) : null}
                    {event.scheduleChanged || event.needsReview ? (
                        <div className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                {event.needsReview
                                    ? t('careCalendarPlanNeedsReview')
                                    : t('careCalendarScheduleChanged')}
                            </span>
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2 sm:max-w-[270px] sm:justify-end">
                    {isSource && event.detailPath ? (
                        <Link to={event.detailPath} className="btn-secondary min-h-[42px] justify-center">
                            {t('careCalendarViewActivity')}
                        </Link>
                    ) : null}
                    {isSource && !event.isPlanned && event.status === 'active' ? (
                        <button
                            type="button"
                            onClick={() => onPlan(event)}
                            disabled={isPending}
                            className="btn-primary min-h-[42px] justify-center disabled:opacity-60"
                        >
                            <Plus size={16} /> {t('careCalendarPlanSession')}
                        </button>
                    ) : null}
                    {(event.isPlanned || event.kind === 'planned_session' || isMapNote) ? (
                        <button
                            type="button"
                            onClick={() => onRemove(event.plannedItemId || event.id)}
                            disabled={isPending}
                            className="btn-secondary min-h-[42px] justify-center text-red-700 disabled:opacity-60"
                        >
                            <Trash2 size={16} /> {t('remove')}
                        </button>
                    ) : null}
                    {(isSource && event.scheduleChanged) || event.needsReview ? (
                        <button
                            type="button"
                            onClick={() => onAcknowledge(event.softAssetId)}
                            disabled={isPending}
                            className="btn-ghost min-h-[42px] justify-center disabled:opacity-60"
                        >
                            <Check size={16} /> {t('careCalendarMarkReviewed')}
                        </button>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default function CareCalendarPage() {
    const { locale, t } = useLocale();
    const [searchParams, setSearchParams] = useSearchParams();
    const noteId = searchParams.get('noteId');
    const [calendar, setCalendar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingKey, setPendingKey] = useState('');
    const [noteContext, setNoteContext] = useState(null);
    const [noteForm, setNoteForm] = useState({
        title: '',
        startsAt: dateInputValue(new Date(Date.now() + 60 * 60 * 1000)),
        endsAt: '',
    });

    const loadCalendar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const from = new Date();
            const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
            const data = await api.getCalendar({
                from: from.toISOString(),
                to: to.toISOString(),
            });
            setCalendar(data);
        } catch (loadError) {
            setError(loadError.message || t('careCalendarLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadCalendar();
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

    const groupedAgenda = useMemo(() => {
        if (!calendar) return [];
        const groups = new Map();
        combineAgenda(calendar).forEach((event) => {
            const key = dayKey(event.startsAt);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(event);
        });
        return [...groups.entries()];
    }, [calendar]);

    async function handlePlan(event) {
        setPendingKey(event.id);
        setError('');
        try {
            await api.createCalendarItem({
                itemType: 'planned_session',
                softAssetId: event.softAssetId,
                sourceStartsAt: event.startsAt,
            });
            await loadCalendar();
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
            await loadCalendar();
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
            await loadCalendar();
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
            await loadCalendar();
        } catch (saveError) {
            setError(saveError.message || t('careCalendarSaveFailed'));
        } finally {
            setPendingKey('');
        }
    }

    return (
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <header className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 px-5 py-6 text-white shadow-sm sm:px-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-teal-100">
                            <CalendarDays size={18} />
                            {t('careCalendar')}
                        </div>
                        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
                            {t('careCalendarUpcomingTitle')}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-teal-50 sm:text-base">
                            {t('careCalendarIntro')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadCalendar}
                        disabled={loading}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 font-bold text-white hover:bg-white/20 disabled:opacity-60"
                    >
                        <RefreshCw size={17} /> {t('careCalendarRefresh')}
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
            ) : (
                <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <section>
                        {groupedAgenda.length ? (
                            <div className="space-y-7">
                                {groupedAgenda.map(([key, events]) => (
                                    <div key={key}>
                                        <h2 className="mb-3 text-lg font-extrabold text-slate-900">
                                            {formatDay(events[0].startsAt, locale)}
                                        </h2>
                                        <div className="space-y-3">
                                            {events.map((event) => (
                                                <AgendaCard
                                                    key={`${event.kind}-${event.id}`}
                                                    event={event}
                                                    locale={locale}
                                                    onAcknowledge={handleAcknowledge}
                                                    onPlan={handlePlan}
                                                    onRemove={handleRemove}
                                                    pendingKey={pendingKey}
                                                    t={t}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                                <CalendarDays className="mx-auto text-slate-400" size={38} />
                                <h2 className="mt-4 text-xl font-bold text-slate-900">{t('careCalendarEmptyTitle')}</h2>
                                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                                    {t('careCalendarEmptyBody')}
                                </p>
                                <Link to="/discover" className="btn-primary mt-5 inline-flex justify-center">
                                    {t('overviewDiscoverTitle')}
                                </Link>
                            </div>
                        )}
                    </section>

                    <aside className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-900">{t('careCalendarHowItWorks')}</h2>
                            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                                <li>{t('careCalendarSavedHelp')}</li>
                                <li>{t('careCalendarPlannedHelp')}</li>
                                <li>{t('careCalendarPrivateHelp')}</li>
                            </ul>
                        </div>
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
                            </div>
                        ) : null}
                    </aside>
                </div>
            )}
        </div>
    );
}
