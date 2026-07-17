import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    Check,
    Clock3,
    MapPin,
    Plus,
    Trash2,
} from 'lucide-react';

import { formatCalendarTime } from '../../lib/careCalendarDay.js';

export default function CalendarEventCard({
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
    const isPlanned = event.isPlanned || event.kind === 'planned_session';
    const needsAttention = event.scheduleChanged || event.needsReview;
    const isPending = pendingKey === event.id
        || pendingKey === event.plannedItemId
        || pendingKey === `ack-${event.softAssetId}`;
    const accentClassName = needsAttention
        ? 'border-amber-300 border-l-amber-500 bg-amber-50/40'
        : isMapNote
            ? 'border-violet-300 border-l-violet-600'
            : 'border-teal-300 border-l-teal-600';

    return (
        <article className={`rounded-2xl border border-l-4 bg-white p-3.5 shadow-sm ${accentClassName}`}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isMapNote ? 'bg-violet-50 text-violet-700' : isSource ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-700'}`}>
                            {isMapNote ? <MapPin size={13} /> : isSource ? <CalendarDays size={13} /> : <CalendarCheck size={13} />}
                            {isMapNote
                                ? t('careCalendarMapNote')
                                : isSource
                                    ? t('careCalendarSavedActivity')
                                    : t('careCalendarPlanned')}
                        </span>
                        {isSource && isPlanned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                                <CalendarCheck size={13} /> {t('careCalendarPlanned')}
                            </span>
                        ) : null}
                        {event.status === 'cancelled' ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                {t('careCalendarCancelled')}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{event.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Clock3 size={15} />
                        {event.allDay
                            ? t('careCalendarAllDay')
                            : (
                                <>
                                    {formatCalendarTime(event.startsAt, locale)}
                                    {event.endsAt ? ` – ${formatCalendarTime(event.endsAt, locale)}` : ''}
                                </>
                            )}
                    </p>
                    {event.address ? (
                        <p className="mt-1 flex items-start gap-2 text-sm text-slate-500">
                            <MapPin size={15} className="mt-0.5 flex-shrink-0" />
                            {event.address}
                        </p>
                    ) : null}
                    {needsAttention ? (
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

                <div className="flex flex-wrap gap-2 xl:max-w-[270px] xl:justify-end">
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
