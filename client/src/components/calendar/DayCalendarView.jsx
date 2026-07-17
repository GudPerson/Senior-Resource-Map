import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import {
    formatCalendarDay,
    formatCalendarMonth,
    formatTimelineHour,
    getSingaporeDayKey,
    getSingaporeHour,
    getSingaporeWeekDayKeys,
    getTimelineHours,
    shiftSingaporeDayKey,
} from '../../lib/careCalendarDay.js';

function CalendarViewTabs({ t }) {
    return (
        <div className="inline-flex min-h-[44px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label={t('careCalendarViewLabel')}>
            <button
                type="button"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
                aria-pressed="true"
            >
                {t('careCalendarDayView')}
            </button>
            {[t('careCalendarWeekView'), t('careCalendarMonthView')].map((label) => (
                <button
                    key={label}
                    type="button"
                    disabled
                    title={t('careCalendarViewComingSoon')}
                    aria-label={`${label}. ${t('careCalendarViewComingSoon')}`}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export function DayPlanner({
    emptyState,
    events,
    locale,
    onSelectDay,
    renderEvent,
    selectedDayKey,
    t,
}) {
    const timelineHours = useMemo(() => getTimelineHours(events), [events]);
    const allDayEvents = events.filter((event) => event.allDay);
    const timedEventsByHour = useMemo(() => {
        const grouped = new Map();
        events.filter((event) => !event.allDay).forEach((event) => {
            const hour = getSingaporeHour(event.startsAt);
            if (!grouped.has(hour)) grouped.set(hour, []);
            grouped.get(hour).push(event);
        });
        return grouped;
    }, [events]);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                    <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button
                            type="button"
                            onClick={() => onSelectDay(shiftSingaporeDayKey(selectedDayKey, -1))}
                            className="inline-flex h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label={t('careCalendarPreviousDay')}
                        >
                            <ChevronLeft size={19} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelectDay(shiftSingaporeDayKey(selectedDayKey, 1))}
                            className="inline-flex h-11 w-11 items-center justify-center text-slate-700 hover:bg-slate-50"
                            aria-label={t('careCalendarNextDay')}
                        >
                            <ChevronRight size={19} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => onSelectDay(getSingaporeDayKey())}
                        className="btn-secondary min-h-[44px] justify-center"
                    >
                        {t('careCalendarToday')}
                    </button>
                </div>
                <h2 className="text-center text-lg font-extrabold text-slate-900" aria-live="polite">
                    {formatCalendarDay(selectedDayKey, locale)}
                </h2>
                <CalendarViewTabs t={t} />
            </div>

            {allDayEvents.length ? (
                <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[4.75rem_minmax(0,1fr)] sm:px-4">
                    <span className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {t('careCalendarAllDay')}
                    </span>
                    <div className="space-y-2">
                        {allDayEvents.map(renderEvent)}
                    </div>
                </div>
            ) : null}

            {!events.length ? (
                <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-6">
                    {emptyState}
                </div>
            ) : null}

            <div className="px-3 py-3 sm:px-4">
                {timelineHours.map((hour) => {
                    const hourEvents = timedEventsByHour.get(hour) || [];
                    return (
                        <div key={hour} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2 sm:grid-cols-[4.75rem_minmax(0,1fr)]">
                            <div className="pt-2 text-right text-xs font-semibold text-slate-500 sm:text-sm">
                                {formatTimelineHour(hour, locale)}
                            </div>
                            <div className="min-h-[44px] border-t border-dashed border-slate-200 py-2 pl-1">
                                {hourEvents.length ? (
                                    <div className="space-y-2">
                                        {hourEvents.map(renderEvent)}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export function MiniDateNavigator({ locale, onSelectDay, selectedDayKey, t }) {
    const todayKey = getSingaporeDayKey();
    const weekDayKeys = getSingaporeWeekDayKeys(selectedDayKey);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">{formatCalendarMonth(selectedDayKey, locale)}</h2>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onSelectDay(shiftSingaporeDayKey(selectedDayKey, -7))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                        aria-label={t('careCalendarPreviousWeek')}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onSelectDay(shiftSingaporeDayKey(selectedDayKey, 7))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                        aria-label={t('careCalendarNextWeek')}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {weekDayKeys.map((dateKey) => {
                    const date = new Date(`${dateKey}T12:00:00+08:00`);
                    const weekdayLabel = new Intl.DateTimeFormat(locale, {
                        weekday: 'short',
                        timeZone: 'Asia/Singapore',
                    }).format(date);
                    const day = Number(dateKey.slice(-2));
                    const isSelected = dateKey === selectedDayKey;
                    const isToday = dateKey === todayKey;
                    return (
                        <div key={dateKey} className="flex min-w-0 flex-col items-center gap-1">
                            <span className="text-[11px] font-bold text-slate-500">{weekdayLabel}</span>
                            <button
                                type="button"
                                onClick={() => onSelectDay(dateKey)}
                                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${isSelected ? 'bg-brand-600 text-white shadow-sm' : isToday ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-300' : 'text-slate-700 hover:bg-slate-100'}`}
                                aria-label={t('careCalendarSelectDate', { date: formatCalendarDay(dateKey, locale) })}
                                aria-pressed={isSelected}
                                aria-current={isToday ? 'date' : undefined}
                            >
                                {day}
                                {isToday && !isSelected ? (
                                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand-600" aria-hidden="true" />
                                ) : null}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export function CalendarEmptyState({ t }) {
    return (
        <div className="text-center">
            <CalendarDays className="mx-auto text-slate-400" size={32} />
            <h2 className="mt-3 text-lg font-bold text-slate-900">{t('careCalendarEmptyTitle')}</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-slate-600">
                {t('careCalendarEmptyBody')}
            </p>
        </div>
    );
}
