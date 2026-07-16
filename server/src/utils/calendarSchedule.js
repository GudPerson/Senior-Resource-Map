const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export const CALENDAR_TIMEZONE = 'Asia/Singapore';
export const CALENDAR_RECURRENCES = ['once', 'weekly'];
export const CALENDAR_STATUSES = ['active', 'cancelled'];
export const CALENDAR_MAX_RANGE_DAYS = 180;

function parseOptionalDate(value, label) {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) {
        const error = new Error(`${label} must be a valid date and time.`);
        error.status = 400;
        throw error;
    }
    return date;
}

function normalizeChoice(value, allowed, fallback, label) {
    const normalized = String(value || fallback).trim().toLowerCase();
    if (!allowed.includes(normalized)) {
        const error = new Error(`${label} is not supported.`);
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function normalizeCalendarWeekdays(values = []) {
    return [...new Set(
        (Array.isArray(values) ? values : [])
            .map((value) => Number.parseInt(String(value), 10))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )].sort((left, right) => left - right);
}

function getSingaporeWeekday(date) {
    return new Date(date.getTime() + SINGAPORE_OFFSET_MS).getUTCDay();
}

export function normalizeCalendarScheduleInput(value = {}) {
    const enabled = Boolean(value?.enabled);
    const recurrence = normalizeChoice(value?.recurrence, CALENDAR_RECURRENCES, 'once', 'Calendar recurrence');
    const status = normalizeChoice(value?.status, CALENDAR_STATUSES, 'active', 'Calendar status');
    const timezone = String(value?.timezone || CALENDAR_TIMEZONE).trim();
    if (timezone !== CALENDAR_TIMEZONE) {
        const error = new Error('Care Calendar V1 supports Asia/Singapore schedules only.');
        error.status = 400;
        throw error;
    }

    if (!enabled) {
        return {
            enabled: false,
            startsAt: null,
            endsAt: null,
            recurrence: 'once',
            weekdays: [],
            repeatUntil: null,
            timezone: CALENDAR_TIMEZONE,
            status: 'active',
        };
    }

    const startsAt = parseOptionalDate(value?.startsAt, 'Calendar start');
    const endsAt = parseOptionalDate(value?.endsAt, 'Calendar end');
    const repeatUntil = parseOptionalDate(value?.repeatUntil, 'Calendar repeat-until');
    if (!startsAt) {
        const error = new Error('Calendar start is required when Care Calendar is enabled.');
        error.status = 400;
        throw error;
    }
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
        const error = new Error('Calendar end must be later than the start.');
        error.status = 400;
        throw error;
    }
    if (repeatUntil && repeatUntil.getTime() < startsAt.getTime()) {
        const error = new Error('Calendar repeat-until must not be before the first session.');
        error.status = 400;
        throw error;
    }

    const weekdays = recurrence === 'weekly'
        ? normalizeCalendarWeekdays(value?.weekdays)
        : [];
    if (recurrence === 'weekly' && weekdays.length === 0) {
        weekdays.push(getSingaporeWeekday(startsAt));
    }

    return {
        enabled: true,
        startsAt,
        endsAt,
        recurrence,
        weekdays,
        repeatUntil: recurrence === 'weekly' ? repeatUntil : null,
        timezone,
        status,
    };
}

function scheduleComparableFromAsset(asset = {}) {
    return {
        enabled: Boolean(asset.calendarEnabled),
        startsAt: asset.calendarStartsAt ? new Date(asset.calendarStartsAt).toISOString() : null,
        endsAt: asset.calendarEndsAt ? new Date(asset.calendarEndsAt).toISOString() : null,
        recurrence: asset.calendarRecurrence || 'once',
        weekdays: normalizeCalendarWeekdays(asset.calendarWeekdays),
        repeatUntil: asset.calendarRepeatUntil ? new Date(asset.calendarRepeatUntil).toISOString() : null,
        timezone: asset.calendarTimezone || CALENDAR_TIMEZONE,
        status: asset.calendarStatus || 'active',
    };
}

function scheduleComparableFromInput(schedule) {
    return {
        enabled: schedule.enabled,
        startsAt: schedule.startsAt?.toISOString() || null,
        endsAt: schedule.endsAt?.toISOString() || null,
        recurrence: schedule.recurrence,
        weekdays: schedule.weekdays,
        repeatUntil: schedule.repeatUntil?.toISOString() || null,
        timezone: schedule.timezone,
        status: schedule.status,
    };
}

export function buildCalendarScheduleInsert(value = {}) {
    const schedule = normalizeCalendarScheduleInput(value);
    return {
        calendarEnabled: schedule.enabled,
        calendarStartsAt: schedule.startsAt,
        calendarEndsAt: schedule.endsAt,
        calendarRecurrence: schedule.recurrence,
        calendarWeekdays: schedule.weekdays,
        calendarRepeatUntil: schedule.repeatUntil,
        calendarTimezone: schedule.timezone,
        calendarStatus: schedule.status,
        calendarRevision: schedule.enabled ? 1 : 0,
        calendarUpdatedAt: schedule.enabled ? new Date() : null,
    };
}

export function buildCalendarScheduleUpdate(existing, value) {
    const schedule = normalizeCalendarScheduleInput(value);
    const changed = JSON.stringify(scheduleComparableFromAsset(existing))
        !== JSON.stringify(scheduleComparableFromInput(schedule));
    if (!changed) return {};

    return {
        calendarEnabled: schedule.enabled,
        calendarStartsAt: schedule.startsAt,
        calendarEndsAt: schedule.endsAt,
        calendarRecurrence: schedule.recurrence,
        calendarWeekdays: schedule.weekdays,
        calendarRepeatUntil: schedule.repeatUntil,
        calendarTimezone: schedule.timezone,
        calendarStatus: schedule.status,
        calendarRevision: Math.max(Number(existing?.calendarRevision) || 0, 0) + 1,
        calendarUpdatedAt: new Date(),
    };
}

export function serializeCalendarSchedule(asset = {}) {
    return {
        enabled: Boolean(asset.calendarEnabled),
        startsAt: asset.calendarStartsAt ? new Date(asset.calendarStartsAt).toISOString() : null,
        endsAt: asset.calendarEndsAt ? new Date(asset.calendarEndsAt).toISOString() : null,
        recurrence: asset.calendarRecurrence || 'once',
        weekdays: normalizeCalendarWeekdays(asset.calendarWeekdays),
        repeatUntil: asset.calendarRepeatUntil ? new Date(asset.calendarRepeatUntil).toISOString() : null,
        timezone: asset.calendarTimezone || CALENDAR_TIMEZONE,
        status: asset.calendarStatus || 'active',
        revision: Math.max(Number(asset.calendarRevision) || 0, 0),
        updatedAt: asset.calendarUpdatedAt ? new Date(asset.calendarUpdatedAt).toISOString() : null,
    };
}

function singaporeLocalParts(date) {
    const shifted = new Date(date.getTime() + SINGAPORE_OFFSET_MS);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        second: shifted.getUTCSeconds(),
        millisecond: shifted.getUTCMilliseconds(),
    };
}

function singaporeDateToUtc(parts) {
    return new Date(Date.UTC(
        parts.year,
        parts.month,
        parts.day,
        parts.hour || 0,
        parts.minute || 0,
        parts.second || 0,
        parts.millisecond || 0,
    ) - SINGAPORE_OFFSET_MS);
}

function startOfSingaporeDate(date) {
    const parts = singaporeLocalParts(date);
    return singaporeDateToUtc({ year: parts.year, month: parts.month, day: parts.day });
}

function addUtcDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function occurrenceOverlaps(start, end, from, to) {
    const effectiveEnd = end || start;
    return start.getTime() < to.getTime() && effectiveEnd.getTime() >= from.getTime();
}

export function buildCalendarOccurrenceId(softAssetId, startsAt) {
    return `soft-${softAssetId}-${new Date(startsAt).toISOString()}`;
}

export function expandCalendarSchedule(asset, fromValue, toValue) {
    if (!asset?.calendarEnabled || !asset?.calendarStartsAt) return [];

    const from = parseOptionalDate(fromValue, 'Calendar range start');
    const to = parseOptionalDate(toValue, 'Calendar range end');
    if (!from || !to || to.getTime() <= from.getTime()) {
        const error = new Error('Calendar range end must be later than the start.');
        error.status = 400;
        throw error;
    }
    if (to.getTime() - from.getTime() > CALENDAR_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        const error = new Error(`Calendar ranges cannot exceed ${CALENDAR_MAX_RANGE_DAYS} days.`);
        error.status = 400;
        throw error;
    }

    const startsAt = new Date(asset.calendarStartsAt);
    const endsAt = asset.calendarEndsAt ? new Date(asset.calendarEndsAt) : null;
    const durationMs = endsAt ? Math.max(endsAt.getTime() - startsAt.getTime(), 0) : 0;
    const recurrence = asset.calendarRecurrence || 'once';
    const status = asset.calendarStatus || 'active';
    const base = {
        softAssetId: Number(asset.id),
        title: asset.name || 'Saved activity',
        timezone: asset.calendarTimezone || CALENDAR_TIMEZONE,
        status,
        sourceRevision: Math.max(Number(asset.calendarRevision) || 0, 0),
    };

    if (recurrence !== 'weekly') {
        const occurrenceEnd = durationMs ? new Date(startsAt.getTime() + durationMs) : null;
        return occurrenceOverlaps(startsAt, occurrenceEnd, from, to)
            ? [{
                ...base,
                occurrenceId: buildCalendarOccurrenceId(asset.id, startsAt),
                startsAt: startsAt.toISOString(),
                endsAt: occurrenceEnd?.toISOString() || null,
            }]
            : [];
    }

    const weekdays = normalizeCalendarWeekdays(asset.calendarWeekdays);
    const allowedWeekdays = new Set(weekdays.length ? weekdays : [getSingaporeWeekday(startsAt)]);
    const repeatUntil = asset.calendarRepeatUntil ? new Date(asset.calendarRepeatUntil) : null;
    const firstLocal = singaporeLocalParts(startsAt);
    const rangeStart = startOfSingaporeDate(from.getTime() > startsAt.getTime() ? from : startsAt);
    const rangeEnd = startOfSingaporeDate(to);
    const occurrences = [];

    for (let cursor = rangeStart; cursor.getTime() <= rangeEnd.getTime(); cursor = addUtcDays(cursor, 1)) {
        const localDate = singaporeLocalParts(cursor);
        const occurrenceStart = singaporeDateToUtc({
            year: localDate.year,
            month: localDate.month,
            day: localDate.day,
            hour: firstLocal.hour,
            minute: firstLocal.minute,
            second: firstLocal.second,
            millisecond: firstLocal.millisecond,
        });
        if (occurrenceStart.getTime() < startsAt.getTime()) continue;
        if (repeatUntil && occurrenceStart.getTime() > repeatUntil.getTime()) continue;
        if (!allowedWeekdays.has(getSingaporeWeekday(occurrenceStart))) continue;

        const occurrenceEnd = durationMs ? new Date(occurrenceStart.getTime() + durationMs) : null;
        if (!occurrenceOverlaps(occurrenceStart, occurrenceEnd, from, to)) continue;
        occurrences.push({
            ...base,
            occurrenceId: buildCalendarOccurrenceId(asset.id, occurrenceStart),
            startsAt: occurrenceStart.toISOString(),
            endsAt: occurrenceEnd?.toISOString() || null,
        });
    }

    return occurrences;
}
