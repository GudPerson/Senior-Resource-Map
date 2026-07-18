const SINGAPORE_OFFSET = '+08:00';
export const SINGAPORE_TIMEZONE = 'Asia/Singapore';

function parseDayKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) throw new Error('Calendar day keys must use YYYY-MM-DD.');
    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };
}

function formatUtcDayKey(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
}

export function getSingaporeDayKey(value = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: SINGAPORE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date(value));
}

export function getSingaporeDayDate(dayKey, hour = 12) {
    parseDayKey(dayKey);
    return new Date(`${dayKey}T${String(hour).padStart(2, '0')}:00:00${SINGAPORE_OFFSET}`);
}

export function shiftSingaporeDayKey(dayKey, amount) {
    const { year, month, day } = parseDayKey(dayKey);
    const shifted = new Date(Date.UTC(year, month - 1, day + Number(amount || 0)));
    return formatUtcDayKey(shifted);
}

export function shiftSingaporeMonthKey(dayKey, amount) {
    const { year, month } = parseDayKey(dayKey);
    const shifted = new Date(Date.UTC(year, month - 1 + Number(amount || 0), 1));
    return formatUtcDayKey(shifted);
}

export function getSingaporeDayRange(dayKey) {
    const from = getSingaporeDayDate(dayKey, 0);
    const to = getSingaporeDayDate(shiftSingaporeDayKey(dayKey, 1), 0);
    return {
        from: from.toISOString(),
        to: to.toISOString(),
    };
}

export function getSingaporeHour(value) {
    const parts = new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(value));
    return Number(parts.find((part) => part.type === 'hour')?.value || 0);
}

export function getTimelineHours(events = []) {
    let firstHour = 8;
    let lastHour = 18;

    events.filter((event) => !event.allDay).forEach((event) => {
        const startsAtHour = getSingaporeHour(event.startsAt);
        const endsAtHour = event.endsAt
            ? Math.min(getSingaporeHour(event.endsAt) + 1, 23)
            : Math.min(startsAtHour + 1, 23);
        firstHour = Math.min(firstHour, startsAtHour);
        lastHour = Math.max(lastHour, endsAtHour);
    });

    return Array.from(
        { length: lastHour - firstHour + 1 },
        (_, index) => firstHour + index,
    );
}

export function getSingaporeWeekDayKeys(dayKey) {
    const { year, month, day } = parseDayKey(dayKey);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const weekStart = shiftSingaporeDayKey(dayKey, -dayOfWeek);
    return Array.from({ length: 7 }, (_, index) => shiftSingaporeDayKey(weekStart, index));
}

export function formatCalendarDay(dayKey, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(getSingaporeDayDate(dayKey));
}

export function formatCalendarMonth(dayKey, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        month: 'long',
        year: 'numeric',
    }).format(getSingaporeDayDate(dayKey));
}

export function formatCalendarTime(value, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

export function formatTimelineHour(hour, locale) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: SINGAPORE_TIMEZONE,
        hour: 'numeric',
    }).format(new Date(`2026-01-01T${String(hour).padStart(2, '0')}:00:00${SINGAPORE_OFFSET}`));
}
