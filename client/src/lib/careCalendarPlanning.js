import {
    getSingaporeDayKey,
    getSingaporeDayRange,
    getSingaporeWeekDayKeys,
    shiftSingaporeDayKey,
} from './careCalendarDay.js';

export const CARE_CALENDAR_SECTIONS = Object.freeze({
    plans: 'plans',
    calendar: 'calendar',
    updates: 'updates',
});

export const CARE_CALENDAR_VIEWS = Object.freeze({
    day: 'day',
    week: 'week',
    month: 'month',
});

function occurrenceMatchKey(item) {
    return `${item.softAssetId}:${item.scheduleEntryKey || item.sourceScheduleEntryKey || 'legacy-primary'}:${item.startsAt || item.sourceStartsAt}`;
}

function asCalendarEvent(item, kind) {
    return {
        ...item,
        kind,
        id: item.occurrenceId || item.id,
    };
}

export function getMonthGridDayKeys(dayKey) {
    const monthStart = `${String(dayKey).slice(0, 7)}-01`;
    const firstWeek = getSingaporeWeekDayKeys(monthStart);
    return Array.from({ length: 42 }, (_, index) => (
        shiftSingaporeDayKey(firstWeek[0], index)
    ));
}

export function getCalendarRange(view, selectedDayKey) {
    let dayKeys;
    if (view === CARE_CALENDAR_VIEWS.week) {
        dayKeys = getSingaporeWeekDayKeys(selectedDayKey);
    } else if (view === CARE_CALENDAR_VIEWS.month) {
        dayKeys = getMonthGridDayKeys(selectedDayKey);
    } else {
        dayKeys = [selectedDayKey];
    }
    return {
        from: getSingaporeDayRange(dayKeys[0]).from,
        to: getSingaporeDayRange(shiftSingaporeDayKey(dayKeys.at(-1), 1)).from,
        dayKeys,
    };
}

export function getPlanningRange(todayKey = getSingaporeDayKey()) {
    const fromKey = shiftSingaporeDayKey(todayKey, -30);
    const toKey = shiftSingaporeDayKey(todayKey, 150);
    return {
        from: getSingaporeDayRange(fromKey).from,
        to: getSingaporeDayRange(toKey).from,
    };
}

export function buildCalendarEvents(calendar = {}) {
    const personalById = new Map(
        (calendar.personalItems || []).map((item) => [Number(item.id), item]),
    );
    const occurrenceKeys = new Set(
        (calendar.occurrences || []).map(occurrenceMatchKey),
    );
    const sourceEvents = (calendar.occurrences || []).map((item) => {
        const plannedItem = item.plannedItemId
            ? personalById.get(Number(item.plannedItemId))
            : null;
        return asCalendarEvent({
            ...item,
            needsReview: Boolean(plannedItem?.needsReview),
            matchesCurrentSchedule: true,
        }, 'saved_activity');
    });
    const personalEvents = (calendar.personalItems || [])
        .filter((item) => (
            item.itemType === 'map_note'
            || !occurrenceKeys.has(occurrenceMatchKey(item))
        ))
        .map((item) => asCalendarEvent({
            ...item,
            matchesCurrentSchedule: false,
        }, item.itemType));

    return [...sourceEvents, ...personalEvents]
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
}

export function buildMyPlanEvents(calendar = {}) {
    return buildCalendarEvents(calendar).filter((event) => (
        event.kind === 'map_note'
        || event.kind === 'planned_session'
        || event.isPlanned
    ));
}

export function groupEventsByDay(events = []) {
    const groups = new Map();
    events.forEach((event) => {
        const dayKey = getSingaporeDayKey(event.startsAt);
        if (!groups.has(dayKey)) groups.set(dayKey, []);
        groups.get(dayKey).push(event);
    });
    return [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([dayKey, items]) => ({ dayKey, events: items }));
}

export function isPlanExpired(event, now = new Date()) {
    if (event.endsAt) return new Date(event.endsAt).getTime() <= now.getTime();
    return getSingaporeDayKey(event.startsAt) < getSingaporeDayKey(now);
}

export function partitionPlanEvents(events = [], now = new Date()) {
    return events.reduce((result, event) => {
        const acknowledgedStalePlan = event.kind === 'planned_session'
            && event.sourceChanged
            && !event.needsReview
            && !event.matchesCurrentSchedule;
        const acknowledgedCancellation = event.status === 'cancelled' && !event.needsReview;
        const archived = isPlanExpired(event, now)
            || acknowledgedStalePlan
            || acknowledgedCancellation;
        result[archived ? 'history' : 'upcoming'].push(event);
        return result;
    }, { upcoming: [], history: [] });
}

export function buildUpdateGroups(calendar = {}) {
    const currentOccurrences = calendar.occurrences || [];
    const affectedPlans = (calendar.personalItems || [])
        .filter((item) => item.itemType === 'planned_session' && item.needsReview);
    const groups = new Map();

    affectedPlans.forEach((plan) => {
        const softAssetId = Number(plan.softAssetId);
        if (!groups.has(softAssetId)) {
            groups.set(softAssetId, {
                softAssetId,
                title: plan.title,
                affectedPlans: [],
                replacementOptions: currentOccurrences
                    .filter((item) => (
                        Number(item.softAssetId) === softAssetId
                        && item.status === 'active'
                    ))
                    .slice(0, 5),
            });
        }
        groups.get(softAssetId).affectedPlans.push(asCalendarEvent({
            ...plan,
            matchesCurrentSchedule: false,
        }, 'planned_session'));
    });

    return [...groups.values()];
}

export function findPlanConflicts(candidate, plannedEvents = []) {
    const candidateStart = new Date(candidate.startsAt).getTime();
    const candidateEnd = candidate.endsAt ? new Date(candidate.endsAt).getTime() : null;
    return plannedEvents
        .filter((event) => (
            event.id !== candidate.id
            && !isPlanExpired(event)
            && event.status !== 'cancelled'
        ))
        .map((event) => {
            const eventStart = new Date(event.startsAt).getTime();
            const eventEnd = event.endsAt ? new Date(event.endsAt).getTime() : null;
            const exact = candidateEnd !== null
                && eventEnd !== null
                && candidateStart < eventEnd
                && eventStart < candidateEnd;
            const possible = !exact
                && (candidateEnd === null || eventEnd === null)
                && candidateStart === eventStart;
            return exact || possible ? { event, exact } : null;
        })
        .filter(Boolean);
}
