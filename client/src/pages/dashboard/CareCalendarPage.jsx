import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Bell,
    CalendarDays,
    ChevronDown,
    FolderOpen,
    MapPin,
    Plus,
    RefreshCw,
    Star,
} from 'lucide-react';

import { useConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import CalendarUpdatesView from '../../components/calendar/CalendarUpdatesView.jsx';
import CalendarEventCard from '../../components/calendar/CalendarEventCard.jsx';
import {
    CalendarCompactEvent,
    MonthCalendarView,
    WeekCalendarView,
} from '../../components/calendar/CalendarPeriodViews.jsx';
import {
    CalendarEmptyState,
    DayPlanner,
    MiniDateNavigator,
} from '../../components/calendar/DayCalendarView.jsx';
import MyPlansView from '../../components/calendar/MyPlansView.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { api } from '../../lib/api.js';
import {
    getSingaporeDayKey,
    SINGAPORE_TIMEZONE,
    shiftSingaporeDayKey,
    shiftSingaporeMonthKey,
} from '../../lib/careCalendarDay.js';
import {
    buildCalendarEvents,
    buildMyPlanEvents,
    buildUpdateGroups,
    CARE_CALENDAR_SECTIONS,
    CARE_CALENDAR_VIEWS,
    findPlanConflicts,
    getCalendarRange,
    getPlanningRange,
    partitionPlanEvents,
} from '../../lib/careCalendarPlanning.js';

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

function normalizeSection(value) {
    return Object.values(CARE_CALENDAR_SECTIONS).includes(value)
        ? value
        : CARE_CALENDAR_SECTIONS.plans;
}

function normalizeView(value) {
    return Object.values(CARE_CALENDAR_VIEWS).includes(value)
        ? value
        : CARE_CALENDAR_VIEWS.day;
}

function normalizeDayKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
        ? value
        : getSingaporeDayKey();
}

export default function CareCalendarPage() {
    const { locale, t } = useLocale();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const noteId = searchParams.get('noteId');
    const [activeSection, setActiveSection] = useState(() => normalizeSection(searchParams.get('section')));
    const [activeView, setActiveView] = useState(() => normalizeView(searchParams.get('view')));
    const [selectedDayKey, setSelectedDayKey] = useState(() => normalizeDayKey(searchParams.get('date')));
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

    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('section', activeSection);
        nextParams.set('view', activeView);
        nextParams.set('date', selectedDayKey);
        if (nextParams.toString() !== searchParams.toString()) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [activeSection, activeView, searchParams, selectedDayKey, setSearchParams]);

    const loadCalendar = useCallback(async ({ preserveCalendar = false } = {}) => {
        const requestId = loadRequestRef.current + 1;
        loadRequestRef.current = requestId;
        setLoading(true);
        setError('');
        if (!preserveCalendar) setCalendar(null);
        try {
            const planningSection = activeSection !== CARE_CALENDAR_SECTIONS.calendar;
            const { from, to } = planningSection
                ? getPlanningRange()
                : getCalendarRange(activeView, selectedDayKey);
            const data = await api.getCalendar({
                from,
                to,
                scope: planningSection ? 'plans' : 'all',
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
    }, [activeSection, activeView, selectedDayKey, t]);

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

    const calendarEvents = useMemo(() => {
        if (!calendar) return [];
        return buildCalendarEvents(calendar);
    }, [calendar]);

    const myPlanEvents = useMemo(() => {
        if (!calendar) return [];
        return buildMyPlanEvents(calendar);
    }, [calendar]);

    const planPartitions = useMemo(
        () => partitionPlanEvents(myPlanEvents),
        [myPlanEvents],
    );

    const updateGroups = useMemo(
        () => buildUpdateGroups(calendar || {}),
        [calendar],
    );

    async function handlePlan(event) {
        const conflicts = findPlanConflicts(event, myPlanEvents);
        if (conflicts.length) {
            const confirmed = await requestConfirmation({
                tone: 'warning',
                title: t('careCalendarConflictTitle'),
                message: t('careCalendarConflictBody', { count: conflicts.length }),
                details: conflicts.map((conflict) => conflict.event.title),
                confirmLabel: t('careCalendarAddAnyway'),
                cancelLabel: t('cancel'),
            });
            if (!confirmed) return;
        }
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

    function handleViewDay(value) {
        setSelectedDayKey(getSingaporeDayKey(value));
        setActiveView(CARE_CALENDAR_VIEWS.day);
        setActiveSection(CARE_CALENDAR_SECTIONS.calendar);
    }

    function handleMovePeriod(amount) {
        setSelectedDayKey((current) => (
            activeView === CARE_CALENDAR_VIEWS.month
                ? shiftSingaporeMonthKey(current, amount)
                : shiftSingaporeDayKey(current, amount * 7)
        ));
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
            setActiveSection(CARE_CALENDAR_SECTIONS.calendar);
            setActiveView(CARE_CALENDAR_VIEWS.day);
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

    const renderEventCard = (event) => (
        <CalendarEventCard
            key={`${event.kind}-${event.id}`}
            event={event}
            locale={locale}
            onPlan={handlePlan}
            onRemove={handleRemove}
            onReviewUpdate={() => setActiveSection(CARE_CALENDAR_SECTIONS.updates)}
            pendingKey={pendingKey}
            t={t}
        />
    );

    const renderCompactEvent = (event) => (
        <CalendarCompactEvent
            key={`${event.kind}-${event.id}`}
            event={event}
            locale={locale}
            onPlan={handlePlan}
            onRemove={handleRemove}
            pendingKey={pendingKey}
            t={t}
        />
    );

    const sectionTabs = [
        [CARE_CALENDAR_SECTIONS.plans, Star, t('careCalendarMyPlans')],
        [CARE_CALENDAR_SECTIONS.calendar, CalendarDays, t('careCalendarCalendarTab')],
        [CARE_CALENDAR_SECTIONS.updates, Bell, t('careCalendarUpdates')],
    ];

    return (
        <div className="mx-auto max-w-[1320px] p-4 sm:p-6 lg:p-8">
            {confirmDialog}
            <header className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-100">{t('careCalendar')}</p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('careCalendarTitle')}</h1>
                        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-teal-50 sm:text-base">{t('careCalendarIntro')}</p>
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

            <nav className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1.5" aria-label={t('careCalendarSectionsLabel')}>
                {sectionTabs.map(([section, Icon, label]) => {
                    const active = activeSection === section;
                    const badge = section === CARE_CALENDAR_SECTIONS.updates ? updateGroups.length : 0;
                    return (
                        <button
                            key={section}
                            type="button"
                            onClick={() => setActiveSection(section)}
                            aria-pressed={active}
                            className={`relative inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-extrabold transition-colors sm:px-4 ${active ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
                        >
                            <Icon size={18} fill={section === CARE_CALENDAR_SECTIONS.plans && active ? 'currentColor' : 'none'} />
                            <span>{label}</span>
                            {badge ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] text-white">{badge}</span> : null}
                        </button>
                    );
                })}
            </nav>

            {noteContext ? (
                <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
                    <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 flex-shrink-0 text-violet-700" size={20} />
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{t('careCalendarAddMapNoteTitle')}</h2>
                            <p className="mt-1 text-sm text-slate-600">{t('careCalendarAddMapNoteFrom', { map: noteContext.mapName })}</p>
                        </div>
                    </div>
                    <form onSubmit={handleAddNote} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarItemTitle')}</span>
                            <input type="text" value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} className="input-field w-full" maxLength={255} required />
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarStarts')}</span>
                            <input type="datetime-local" value={noteForm.startsAt} onChange={(event) => setNoteForm((current) => ({ ...current, startsAt: event.target.value }))} className="input-field w-full" required />
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t('careCalendarEndsOptional')}</span>
                            <input type="datetime-local" value={noteForm.endsAt} onChange={(event) => setNoteForm((current) => ({ ...current, endsAt: event.target.value }))} className="input-field w-full" />
                        </label>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <button type="submit" disabled={pendingKey === `note-${noteContext.id}`} className="btn-primary justify-center disabled:opacity-60">
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

            {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div> : null}

            {loading && !calendar ? (
                <LoadingState label={t('careCalendarLoading')} />
            ) : error && !calendar ? null : (
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <main className="min-w-0">
                        {activeSection === CARE_CALENDAR_SECTIONS.plans ? (
                            <MyPlansView
                                history={planPartitions.history}
                                locale={locale}
                                renderEvent={renderEventCard}
                                t={t}
                                upcoming={planPartitions.upcoming}
                            />
                        ) : null}

                        {activeSection === CARE_CALENDAR_SECTIONS.calendar && activeView === CARE_CALENDAR_VIEWS.day ? (
                            <DayPlanner
                                activeView={activeView}
                                emptyState={<CalendarEmptyState t={t} />}
                                events={calendarEvents}
                                locale={locale}
                                onSelectDay={setSelectedDayKey}
                                onViewChange={setActiveView}
                                renderEvent={renderEventCard}
                                selectedDayKey={selectedDayKey}
                                t={t}
                            />
                        ) : null}

                        {activeSection === CARE_CALENDAR_SECTIONS.calendar && activeView === CARE_CALENDAR_VIEWS.week ? (
                            <WeekCalendarView
                                events={calendarEvents}
                                locale={locale}
                                onMove={handleMovePeriod}
                                onOpenDay={handleViewDay}
                                onToday={() => setSelectedDayKey(getSingaporeDayKey())}
                                onViewChange={setActiveView}
                                renderEvent={renderCompactEvent}
                                selectedDayKey={selectedDayKey}
                                t={t}
                            />
                        ) : null}

                        {activeSection === CARE_CALENDAR_SECTIONS.calendar && activeView === CARE_CALENDAR_VIEWS.month ? (
                            <MonthCalendarView
                                events={calendarEvents}
                                locale={locale}
                                onMove={handleMovePeriod}
                                onOpenDay={handleViewDay}
                                onToday={() => setSelectedDayKey(getSingaporeDayKey())}
                                onViewChange={setActiveView}
                                renderEvent={renderCompactEvent}
                                selectedDayKey={selectedDayKey}
                                t={t}
                            />
                        ) : null}

                        {activeSection === CARE_CALENDAR_SECTIONS.updates ? (
                            <CalendarUpdatesView
                                groups={updateGroups}
                                locale={locale}
                                onAcknowledge={handleAcknowledge}
                                onPlan={handlePlan}
                                onRemove={handleRemove}
                                onViewDay={handleViewDay}
                                pendingKey={pendingKey}
                                t={t}
                            />
                        ) : null}
                    </main>

                    <aside className="space-y-4">
                        {activeSection === CARE_CALENDAR_SECTIONS.calendar ? (
                            <MiniDateNavigator locale={locale} onSelectDay={setSelectedDayKey} selectedDayKey={selectedDayKey} t={t} />
                        ) : null}
                        {calendar?.savedWithoutSchedule?.length ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="font-bold text-slate-900">{t('careCalendarSavedNoSchedule')}</h2>
                                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                    {t('careCalendarSavedNoScheduleCount', { count: calendar.savedWithoutSchedule.length })}
                                </p>
                                <Link to="/my-directory" className="btn-secondary mt-4 w-full justify-center">
                                    <FolderOpen size={16} /> {t('careCalendarViewDirectory')}
                                </Link>
                            </div>
                        ) : null}
                        <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open={activeSection === CARE_CALENDAR_SECTIONS.plans}>
                            <summary className="cursor-pointer list-none font-bold text-slate-900 marker:hidden">
                                <span className="flex items-center justify-between gap-3">
                                    {t('careCalendarHowItWorks')}
                                    <ChevronDown className="text-slate-400 transition-transform group-open:rotate-180" size={18} aria-hidden="true" />
                                </span>
                            </summary>
                            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                                <li>{t('careCalendarSavedHelp')}</li>
                                <li>{t('careCalendarPlannedHelp')}</li>
                                <li>{t('careCalendarUpdatesHelp')}</li>
                                <li>{t('careCalendarPrivateHelp')}</li>
                            </ul>
                        </details>
                    </aside>
                </div>
            )}
        </div>
    );
}
