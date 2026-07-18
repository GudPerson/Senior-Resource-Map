import { CalendarDays, ChevronDown, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCalendarDay } from '../../lib/careCalendarDay.js';
import { groupEventsByDay } from '../../lib/careCalendarPlanning.js';

function PlanGroups({ events, locale, renderEvent }) {
    return groupEventsByDay(events).map((group) => (
        <section key={group.dayKey}>
            <h2 className="mb-3 text-lg font-extrabold text-slate-900">
                {formatCalendarDay(group.dayKey, locale)}
            </h2>
            <div className="space-y-3">{group.events.map(renderEvent)}</div>
        </section>
    ));
}

export default function MyPlansView({ history, locale, renderEvent, t, upcoming }) {
    return (
        <div className="space-y-7">
            {upcoming.length ? (
                <PlanGroups events={upcoming} locale={locale} renderEvent={renderEvent} />
            ) : (
                <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                    <Star className="mx-auto text-amber-500" size={36} />
                    <h2 className="mt-3 text-xl font-extrabold text-slate-900">{t('careCalendarPlansEmptyTitle')}</h2>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                        {t('careCalendarPlansEmptyBody')}
                    </p>
                    <Link to="/discover" className="btn-primary mt-5 inline-flex justify-center">
                        {t('overviewDiscoverTitle')}
                    </Link>
                </section>
            )}

            {history.length ? (
                <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <summary className="cursor-pointer list-none marker:hidden">
                        <span className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-extrabold text-slate-900">
                                <CalendarDays size={18} className="text-slate-500" />
                                {t('careCalendarRecentHistory', { count: history.length })}
                            </span>
                            <ChevronDown className="text-slate-400 transition-transform group-open:rotate-180" size={18} />
                        </span>
                    </summary>
                    <p className="mt-2 text-sm text-slate-500">{t('careCalendarRecentHistoryHelp')}</p>
                    <div className="mt-5 space-y-6 opacity-80">
                        <PlanGroups events={history} locale={locale} renderEvent={renderEvent} />
                    </div>
                </details>
            ) : null}
        </div>
    );
}
