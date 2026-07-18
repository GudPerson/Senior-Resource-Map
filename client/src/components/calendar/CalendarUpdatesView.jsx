import { AlertTriangle, Check, Clock3, ExternalLink, Star, Trash2 } from 'lucide-react';

import {
    formatCalendarDay,
    formatCalendarTime,
    getSingaporeDayKey,
} from '../../lib/careCalendarDay.js';

function SessionTime({ event, locale }) {
    const dayKey = getSingaporeDayKey(event.startsAt);
    return (
        <span className="flex items-start gap-2 text-sm text-slate-600">
            <Clock3 size={15} className="mt-0.5 flex-shrink-0" />
            <span>
                {formatCalendarDay(dayKey, locale)} · {formatCalendarTime(event.startsAt, locale)}
                {event.endsAt ? ` – ${formatCalendarTime(event.endsAt, locale)}` : ''}
            </span>
        </span>
    );
}

export default function CalendarUpdatesView({
    groups,
    locale,
    onAcknowledge,
    onPlan,
    onRemove,
    onViewDay,
    pendingKey,
    t,
}) {
    if (!groups.length) {
        return (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <Check className="mx-auto rounded-full bg-teal-50 p-2 text-teal-700" size={44} />
                <h2 className="mt-3 text-xl font-extrabold text-slate-900">{t('careCalendarUpdatesEmptyTitle')}</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                    {t('careCalendarUpdatesEmptyBody')}
                </p>
            </section>
        );
    }

    return (
        <div className="space-y-5">
            {groups.map((group) => (
                <section key={group.softAssetId} className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                    <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
                        <AlertTriangle className="mt-0.5 flex-shrink-0 text-amber-700" size={20} />
                        <div>
                            <h2 className="font-extrabold text-slate-900">{group.title}</h2>
                            <p className="mt-1 text-sm leading-relaxed text-amber-900">{t('careCalendarUpdateNeedsDecision')}</p>
                        </div>
                    </div>
                    <div className="grid gap-5 p-5 lg:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
                                {t('careCalendarAffectedPlans')}
                            </h3>
                            <div className="mt-3 space-y-3">
                                {group.affectedPlans.map((plan) => (
                                    <div key={plan.id} className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600">
                                        <p className="font-bold text-slate-700">{plan.title}</p>
                                        <div className="mt-1"><SessionTime event={plan} locale={locale} /></div>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(plan.id)}
                                            disabled={pendingKey === plan.id}
                                            className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <Trash2 size={16} /> {t('careCalendarRemoveOldPlan')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
                                {t('careCalendarCurrentSessions')}
                            </h3>
                            {group.replacementOptions.length ? (
                                <div className="mt-3 space-y-3">
                                    {group.replacementOptions.map((event) => (
                                        <div key={event.occurrenceId} className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
                                            <p className="font-bold text-slate-900">{event.title}</p>
                                            <div className="mt-1"><SessionTime event={event} locale={locale} /></div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onPlan(event)}
                                                    disabled={event.isPlanned || pendingKey === event.occurrenceId}
                                                    className="btn-primary min-h-[40px] justify-center disabled:opacity-50"
                                                >
                                                    <Star size={16} fill={event.isPlanned ? 'currentColor' : 'none'} />
                                                    {event.isPlanned ? t('careCalendarInMyPlans') : t('careCalendarAddToPlans')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onViewDay(event.startsAt)}
                                                    className="btn-secondary min-h-[40px] justify-center"
                                                >
                                                    <ExternalLink size={16} /> {t('careCalendarViewInCalendar')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                                    {t('careCalendarNoCurrentSessions')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-relaxed text-slate-500">{t('careCalendarAcknowledgeHelp')}</p>
                        <button
                            type="button"
                            onClick={() => onAcknowledge(group.softAssetId)}
                            disabled={pendingKey === `ack-${group.softAssetId}`}
                            className="btn-secondary flex-shrink-0 justify-center disabled:opacity-50"
                        >
                            <Check size={16} /> {t('careCalendarAcknowledgeUpdate')}
                        </button>
                    </div>
                </section>
            ))}
        </div>
    );
}
