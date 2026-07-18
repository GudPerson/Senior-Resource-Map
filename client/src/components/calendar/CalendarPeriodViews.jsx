import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
    CalendarViewTabs,
    CalendarEmptyState,
} from './DayCalendarView.jsx';
import {
    formatCalendarDay,
    formatCalendarMonth,
    formatCalendarTime,
    getSingaporeDayKey,
    getSingaporeWeekDayKeys,
} from '../../lib/careCalendarDay.js';
import { getMonthGridDayKeys, groupEventsByDay } from '../../lib/careCalendarPlanning.js';

function shortDate(dayKey, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Singapore',
        day: 'numeric',
        month: 'short',
    }).format(new Date(`${dayKey}T12:00:00+08:00`));
}

function weekday(dayKey, locale, format = 'short') {
    return new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Singapore',
        weekday: format,
    }).format(new Date(`${dayKey}T12:00:00+08:00`));
}

function CalendarRangeHeader({
    activeView,
    label,
    onMove,
    onToday,
    onViewChange,
    t,
}) {
    return (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        className="inline-flex h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-700 hover:bg-slate-50"
                        aria-label={activeView === 'week' ? t('careCalendarPreviousWeek') : t('careCalendarPreviousMonth')}
                    >
                        <ChevronLeft size={19} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        className="inline-flex h-11 w-11 items-center justify-center text-slate-700 hover:bg-slate-50"
                        aria-label={activeView === 'week' ? t('careCalendarNextWeek') : t('careCalendarNextMonth')}
                    >
                        <ChevronRight size={19} />
                    </button>
                </div>
                <button type="button" onClick={onToday} className="btn-secondary min-h-[44px] justify-center">
                    {t('careCalendarToday')}
                </button>
            </div>
            <h2 className="text-center text-lg font-extrabold text-slate-900" aria-live="polite">
                {label}
            </h2>
            <CalendarViewTabs activeView={activeView} onChange={onViewChange} t={t} />
        </div>
    );
}

export function CalendarCompactEvent({ event, locale, onPlan, onRemove, pendingKey, t }) {
    const isMapNote = event.kind === 'map_note';
    const isPlanned = event.isPlanned || event.kind === 'planned_session';
    const isPending = pendingKey === event.id || pendingKey === event.plannedItemId;
    const content = (
        <>
            <span className="block truncate font-bold text-slate-800">{event.title}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                {event.allDay ? <CalendarDays size={12} /> : <Clock3 size={12} />}
                {event.allDay ? t('careCalendarAllDay') : formatCalendarTime(event.startsAt, locale)}
            </span>
        </>
    );

    return (
        <div className={`group rounded-lg border px-2.5 py-2 ${event.needsReview || event.status === 'cancelled' ? 'border-amber-200 bg-amber-50' : isMapNote ? 'border-violet-200 bg-violet-50' : 'border-teal-100 bg-teal-50/70'}`}>
            <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                    {event.detailPath ? <Link to={event.detailPath}>{content}</Link> : content}
                </div>
                {isMapNote ? (
                    <button
                        type="button"
                        onClick={() => onRemove(event.id)}
                        disabled={isPending}
                        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                        aria-label={t('careCalendarRemoveMapNote')}
                    >
                        <MapPin size={17} />
                    </button>
                ) : event.status === 'active' ? (
                    <button
                        type="button"
                        onClick={() => (isPlanned ? onRemove(event.plannedItemId || event.id) : onPlan(event))}
                        disabled={isPending}
                        className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg disabled:opacity-50 ${isPlanned ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-500 hover:bg-white hover:text-amber-600'}`}
                        aria-label={isPlanned ? t('careCalendarRemoveFromPlans') : t('careCalendarAddToPlans')}
                        aria-pressed={isPlanned}
                    >
                        <Star size={18} fill={isPlanned ? 'currentColor' : 'none'} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function MobileAgenda({ emptyState, events, locale, onOpenDay, renderEvent, t }) {
    const groups = groupEventsByDay(events);
    if (!groups.length) return <div className="p-5">{emptyState}</div>;
    return (
        <div className="divide-y divide-slate-200 lg:hidden">
            {groups.map((group) => (
                <section key={group.dayKey} className="p-4">
                    <button
                        type="button"
                        onClick={() => onOpenDay(group.dayKey)}
                        className="mb-3 text-left text-sm font-extrabold text-slate-900 hover:text-brand-700"
                    >
                        {formatCalendarDay(group.dayKey, locale)}
                    </button>
                    <div className="space-y-2">{group.events.map(renderEvent)}</div>
                </section>
            ))}
        </div>
    );
}

export function WeekCalendarView({
    events,
    locale,
    onMove,
    onOpenDay,
    onToday,
    onViewChange,
    renderEvent,
    selectedDayKey,
    t,
}) {
    const dayKeys = getSingaporeWeekDayKeys(selectedDayKey);
    const eventsByDay = new Map(groupEventsByDay(events).map((group) => [group.dayKey, group.events]));
    const label = `${shortDate(dayKeys[0], locale)} – ${shortDate(dayKeys.at(-1), locale)}`;
    const emptyState = <CalendarEmptyState t={t} />;
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CalendarRangeHeader
                activeView="week"
                label={label}
                onMove={onMove}
                onToday={onToday}
                onViewChange={onViewChange}
                t={t}
            />
            <div className="hidden grid-cols-7 divide-x divide-slate-200 lg:grid">
                {dayKeys.map((dayKey) => {
                    const dayEvents = eventsByDay.get(dayKey) || [];
                    const isToday = dayKey === getSingaporeDayKey();
                    return (
                        <section key={dayKey} className="min-h-[440px] min-w-0 p-2.5">
                            <button
                                type="button"
                                onClick={() => onOpenDay(dayKey)}
                                className={`mb-3 w-full rounded-xl px-2 py-2 text-center ${isToday ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className="block text-xs font-bold uppercase tracking-wide">{weekday(dayKey, locale)}</span>
                                <span className="mt-0.5 block text-xl font-extrabold">{Number(dayKey.slice(-2))}</span>
                            </button>
                            <div className="space-y-2">{dayEvents.map(renderEvent)}</div>
                        </section>
                    );
                })}
            </div>
            <MobileAgenda emptyState={emptyState} events={events} locale={locale} onOpenDay={onOpenDay} renderEvent={renderEvent} t={t} />
        </section>
    );
}

export function MonthCalendarView({
    events,
    locale,
    onMove,
    onOpenDay,
    onToday,
    onViewChange,
    renderEvent,
    selectedDayKey,
    t,
}) {
    const dayKeys = getMonthGridDayKeys(selectedDayKey);
    const eventsByDay = new Map(groupEventsByDay(events).map((group) => [group.dayKey, group.events]));
    const selectedMonth = selectedDayKey.slice(0, 7);
    const weekdayKeys = dayKeys.slice(0, 7);
    const emptyState = <CalendarEmptyState t={t} />;
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CalendarRangeHeader
                activeView="month"
                label={formatCalendarMonth(selectedDayKey, locale)}
                onMove={onMove}
                onToday={onToday}
                onViewChange={onViewChange}
                t={t}
            />
            <div className="hidden lg:block">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {weekdayKeys.map((dayKey) => (
                        <div key={dayKey} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                            {weekday(dayKey, locale, 'long')}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {dayKeys.map((dayKey) => {
                        const dayEvents = eventsByDay.get(dayKey) || [];
                        const inMonth = dayKey.startsWith(selectedMonth);
                        const isToday = dayKey === getSingaporeDayKey();
                        return (
                            <section key={dayKey} className={`min-h-[136px] min-w-0 border-b border-r border-slate-200 p-2 ${inMonth ? 'bg-white' : 'bg-slate-50/70'}`}>
                                <button
                                    type="button"
                                    onClick={() => onOpenDay(dayKey)}
                                    className={`mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
                                    aria-label={t('careCalendarSelectDate', { date: formatCalendarDay(dayKey, locale) })}
                                >
                                    {Number(dayKey.slice(-2))}
                                </button>
                                <div className="space-y-1.5">
                                    {dayEvents.slice(0, 3).map(renderEvent)}
                                    {dayEvents.length > 3 ? (
                                        <button type="button" onClick={() => onOpenDay(dayKey)} className="text-xs font-bold text-brand-700">
                                            {t('careCalendarMoreEvents', { count: dayEvents.length - 3 })}
                                        </button>
                                    ) : null}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
            <MobileAgenda emptyState={emptyState} events={events} locale={locale} onOpenDay={onOpenDay} renderEvent={renderEvent} t={t} />
        </section>
    );
}
