import {
    CALENDAR_TIMEZONE,
    expandCalendarSchedule,
    normalizeCalendarScheduleInput,
    normalizeCalendarWeekdays,
} from './calendarSchedule.js';

export const OFFERING_SCHEDULE_MAX_ENTRIES = 250;
export const OFFERING_SCHEDULE_SOURCES = ['legacy', 'manual', 'collateral_import', 'workbook'];
export const OFFERING_SCHEDULE_ACTIONS = ['publish', 'unpublish', 'update'];

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTH_INDEX = new Map([
    ['jan', 0], ['january', 0],
    ['feb', 1], ['february', 1],
    ['mar', 2], ['march', 2],
    ['apr', 3], ['april', 3],
    ['may', 4],
    ['jun', 5], ['june', 5],
    ['jul', 6], ['july', 6],
    ['aug', 7], ['august', 7],
    ['sep', 8], ['sept', 8], ['september', 8],
    ['oct', 9], ['october', 9],
    ['nov', 10], ['november', 10],
    ['dec', 11], ['december', 11],
]);
const WEEKDAY_INDEX = new Map([
    ['sun', 0], ['sunday', 0],
    ['mon', 1], ['monday', 1],
    ['tue', 2], ['tues', 2], ['tuesday', 2],
    ['wed', 3], ['wednesday', 3],
    ['thu', 4], ['thur', 4], ['thurs', 4], ['thursday', 4],
    ['fri', 5], ['friday', 5],
    ['sat', 6], ['saturday', 6],
]);
const WEEKDAY_PATTERN = '(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const WEEKDAY_REGEX = new RegExp(`\\b${WEEKDAY_PATTERN}\\b`, 'ig');

function scheduleError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function normalizeText(value, maxLength = 3000) {
    const text = String(value || '').replace(/\r\n/g, '\n').trim();
    if (text.length > maxLength) {
        throw scheduleError(`Schedule text cannot exceed ${maxLength} characters.`);
    }
    return text;
}

function normalizeSource(value) {
    const source = String(value || 'manual').trim().toLowerCase();
    return OFFERING_SCHEDULE_SOURCES.includes(source) ? source : 'manual';
}

function normalizeEntryKey(value, index, startsAt) {
    const candidate = String(value || '').trim();
    if (/^[a-zA-Z0-9_-]{1,80}$/.test(candidate)) return candidate;
    return `entry-${index + 1}-${new Date(startsAt).getTime()}`;
}

function comparablePlan(plan) {
    return {
        enabled: Boolean(plan.enabled),
        notes: plan.notes || '',
        entries: plan.entries.map((entry) => ({
            key: entry.key,
            type: entry.type,
            startsAt: entry.startsAt,
            endsAt: entry.endsAt,
            weekdays: entry.weekdays,
            repeatUntil: entry.repeatUntil,
            timezone: entry.timezone,
            status: entry.status,
            note: entry.note || '',
        })),
    };
}

function getSingaporeWeekday(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getTime() + SINGAPORE_OFFSET_MS).getUTCDay();
}

export function normalizeOfferingSchedulePlanInput(value = {}, options = {}) {
    const rawEntries = Array.isArray(value?.entries) ? value.entries : [];
    const enabled = value?.enabled === undefined ? rawEntries.length > 0 : Boolean(value.enabled);
    const notes = normalizeText(value?.notes || '', 3000);

    if (!enabled) {
        return { enabled: false, notes, entries: [] };
    }
    if (rawEntries.length === 0) {
        throw scheduleError('Add at least one session before publishing to Care Calendar.');
    }
    if (rawEntries.length > OFFERING_SCHEDULE_MAX_ENTRIES) {
        throw scheduleError(`An Offering can contain at most ${OFFERING_SCHEDULE_MAX_ENTRIES} schedule rows.`);
    }

    const keys = new Set();
    const signatures = new Set();
    const entries = rawEntries.map((entry, index) => {
        const normalized = normalizeCalendarScheduleInput({
            enabled: true,
            startsAt: entry?.startsAt,
            endsAt: entry?.endsAt,
            recurrence: entry?.type || entry?.recurrence || 'once',
            weekdays: entry?.weekdays,
            repeatUntil: entry?.repeatUntil,
            timezone: entry?.timezone || CALENDAR_TIMEZONE,
            status: entry?.status || 'active',
        });
        const key = normalizeEntryKey(entry?.key || entry?.id, index, normalized.startsAt);
        if (keys.has(key)) {
            throw scheduleError(`Schedule row ${index + 1} has a duplicate identifier.`);
        }
        keys.add(key);

        const result = {
            key,
            type: normalized.recurrence,
            startsAt: normalized.startsAt.toISOString(),
            endsAt: normalized.endsAt?.toISOString() || null,
            weekdays: normalized.weekdays,
            repeatUntil: normalized.repeatUntil?.toISOString() || null,
            timezone: CALENDAR_TIMEZONE,
            status: normalized.status,
            note: normalizeText(entry?.note || '', 1000),
        };
        if (
            options.validateStartWeekday !== false
            && result.type === 'weekly'
            && !result.weekdays.includes(getSingaporeWeekday(normalized.startsAt))
        ) {
            throw scheduleError(`Schedule row ${index + 1} must start on one of its selected repeat weekdays.`);
        }
        const signature = JSON.stringify({
            type: result.type,
            startsAt: result.startsAt,
            endsAt: result.endsAt,
            weekdays: result.weekdays,
            repeatUntil: result.repeatUntil,
            status: result.status,
        });
        if (signatures.has(signature)) {
            throw scheduleError(`Schedule row ${index + 1} duplicates another session.`);
        }
        signatures.add(signature);
        return result;
    });

    entries.sort((left, right) => (
        new Date(left.startsAt) - new Date(right.startsAt)
        || left.key.localeCompare(right.key)
    ));
    return { enabled: true, notes, entries };
}

function legacyPlanFromAsset(asset = {}) {
    if (!asset.calendarEnabled || !asset.calendarStartsAt) {
        return {
            enabled: false,
            notes: asset.scheduleNotes || '',
            entries: [],
        };
    }

    return normalizeOfferingSchedulePlanInput({
        enabled: true,
        notes: asset.scheduleNotes || '',
        entries: [{
            key: 'legacy-primary',
            type: asset.calendarRecurrence || 'once',
            startsAt: asset.calendarStartsAt,
            endsAt: asset.calendarEndsAt,
            weekdays: normalizeCalendarWeekdays(asset.calendarWeekdays),
            repeatUntil: asset.calendarRepeatUntil,
            timezone: asset.calendarTimezone || CALENDAR_TIMEZONE,
            status: asset.calendarStatus || 'active',
        }],
    }, { validateStartWeekday: false });
}

export function serializeOfferingSchedulePlan(asset = {}) {
    const entries = Array.isArray(asset.calendarEntries) ? asset.calendarEntries : [];
    if (entries.length > 0 || (asset.calendarScheduleSource && asset.calendarScheduleSource !== 'legacy')) {
        return normalizeOfferingSchedulePlanInput({
            enabled: entries.length > 0,
            notes: asset.scheduleNotes || '',
            entries,
        }, { validateStartWeekday: false });
    }
    return legacyPlanFromAsset(asset);
}

function formatDate(value) {
    return new Intl.DateTimeFormat('en-SG', {
        timeZone: CALENDAR_TIMEZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function formatTime(value) {
    return new Intl.DateTimeFormat('en-SG', {
        timeZone: CALENDAR_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(value)).replace(/\s+/g, ' ').toLowerCase();
}

function formatEntrySummary(entry) {
    const time = entry.endsAt
        ? `${formatTime(entry.startsAt)}-${formatTime(entry.endsAt)}`
        : formatTime(entry.startsAt);
    const cancelled = entry.status === 'cancelled' ? ' (Cancelled)' : '';
    if (entry.type !== 'weekly') {
        return `${formatDate(entry.startsAt)}, ${time}${cancelled}`;
    }
    const weekdays = (entry.weekdays || []).map((day) => WEEKDAY_LABELS[day]).filter(Boolean).join(', ');
    const until = entry.repeatUntil ? ` until ${formatDate(entry.repeatUntil)}` : '';
    return `Every ${weekdays || WEEKDAY_LABELS[new Date(entry.startsAt).getUTCDay()]}, ${time} from ${formatDate(entry.startsAt)}${until}${cancelled}`;
}

export function buildOfferingScheduleSummary(planValue = {}) {
    const plan = normalizeOfferingSchedulePlanInput(planValue, { validateStartWeekday: false });
    if (!plan.enabled) return null;
    const lines = plan.entries.map(formatEntrySummary);
    if (plan.notes) lines.push(plan.notes);
    return lines.join('\n').trim() || null;
}

function legacyFieldsForPlan(plan, revision, updatedAt) {
    const first = plan.entries[0] || null;
    const hasActive = plan.entries.some((entry) => entry.status === 'active');
    return {
        calendarEnabled: plan.entries.length > 0,
        calendarStartsAt: first ? new Date(first.startsAt) : null,
        calendarEndsAt: first?.endsAt ? new Date(first.endsAt) : null,
        calendarRecurrence: first?.type || 'once',
        calendarWeekdays: first?.weekdays || [],
        calendarRepeatUntil: first?.repeatUntil ? new Date(first.repeatUntil) : null,
        calendarTimezone: CALENDAR_TIMEZONE,
        calendarStatus: hasActive ? 'active' : (first?.status || 'active'),
        calendarRevision: revision,
        calendarUpdatedAt: updatedAt,
    };
}

export function buildOfferingScheduleMutation(existing = {}, value = {}, options = {}) {
    const current = serializeOfferingSchedulePlan(existing);
    const next = normalizeOfferingSchedulePlanInput(value);
    const source = normalizeSource(options.source);
    const changed = JSON.stringify(comparablePlan(current)) !== JSON.stringify(comparablePlan(next));
    const currentRevision = Math.max(Number(existing.calendarRevision) || 0, 0);

    if (!changed) {
        return {
            changed: false,
            current,
            next,
            source: existing.calendarScheduleSource || source,
            previousRevision: currentRevision,
            revision: currentRevision,
            patch: {},
            snapshots: currentRevision > 0 ? [{
                revision: currentRevision,
                plan: current,
                publicSummary: existing.schedule || buildOfferingScheduleSummary(current),
                source: existing.calendarScheduleSource || 'legacy',
            }] : [],
        };
    }

    const revision = currentRevision + 1;
    const updatedAt = new Date();
    const publicSummary = buildOfferingScheduleSummary(next);
    const snapshots = [];
    if (currentRevision > 0) {
        snapshots.push({
            revision: currentRevision,
            plan: current,
            publicSummary: existing.schedule || buildOfferingScheduleSummary(current),
            source: existing.calendarScheduleSource || 'legacy',
        });
    }
    snapshots.push({ revision, plan: next, publicSummary, source });

    return {
        changed: true,
        current,
        next,
        source,
        previousRevision: currentRevision,
        revision,
        publicSummary,
        snapshots,
        patch: {
            schedule: publicSummary,
            scheduleNotes: next.notes || null,
            calendarEntries: next.entries,
            calendarScheduleSource: source,
            ...legacyFieldsForPlan(next, revision, updatedAt),
        },
    };
}

function scheduleConflict(message) {
    const error = new Error(message);
    error.status = 409;
    return error;
}

export function assertOfferingScheduleMutationIntent(mutation, options = {}) {
    if (!mutation?.changed) return mutation?.previousRevision ?? mutation?.revision ?? 0;

    const expectedRevision = Number(options.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw scheduleConflict('Refresh this Offering before changing its published sessions.');
    }
    if (expectedRevision !== mutation.previousRevision) {
        throw scheduleConflict('This schedule changed after you opened it. Refresh the Offering and review the latest sessions before saving.');
    }

    const action = String(options.action || '').trim().toLowerCase();
    if (!OFFERING_SCHEDULE_ACTIONS.includes(action)) {
        throw scheduleConflict('Choose an explicit publish or unpublish action before changing this schedule.');
    }
    if (mutation.current.enabled && !mutation.next.enabled && action !== 'unpublish') {
        throw scheduleConflict('Published sessions can only be removed with the confirmed Unpublish sessions action.');
    }
    if (mutation.next.enabled && action !== 'publish') {
        throw scheduleConflict('Publishing session changes requires the Publish sessions action.');
    }
    if (!mutation.current.enabled && !mutation.next.enabled && action !== 'update') {
        throw scheduleConflict('This unpublished schedule can only be updated without changing its publish state.');
    }

    return expectedRevision;
}

export function buildOfferingScheduleVersionRows(softAssetId, mutation, publishedByUserId = null) {
    return (mutation?.snapshots || []).map((snapshot) => ({
        softAssetId,
        revision: snapshot.revision,
        entries: snapshot.plan.entries,
        scheduleNotes: snapshot.plan.notes || null,
        publicSummary: snapshot.publicSummary || null,
        source: normalizeSource(snapshot.source),
        publishedByUserId: publishedByUserId || null,
        publishedAt: new Date(),
    }));
}

export function expandOfferingSchedule(asset, from, to) {
    const plan = serializeOfferingSchedulePlan(asset);
    return plan.entries
        .flatMap((entry) => expandCalendarSchedule({
            ...asset,
            calendarEnabled: true,
            calendarStartsAt: new Date(entry.startsAt),
            calendarEndsAt: entry.endsAt ? new Date(entry.endsAt) : null,
            calendarRecurrence: entry.type,
            calendarWeekdays: entry.weekdays,
            calendarRepeatUntil: entry.repeatUntil ? new Date(entry.repeatUntil) : null,
            calendarTimezone: entry.timezone,
            calendarStatus: entry.status,
        }, from, to).map((occurrence) => ({
            ...occurrence,
            occurrenceId: `soft-${asset.id}-${entry.key}-${occurrence.startsAt}`,
            scheduleEntryKey: entry.key,
            note: entry.note || null,
        })))
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
}

function parseClock(value, fallbackMeridiem = '') {
    const match = String(value || '').trim().toLowerCase().match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?\s*(am|pm)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3] || fallbackMeridiem;
    if (minute > 59 || hour > 23) return null;
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === 'pm' && hour !== 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
    }
    return { hour, minute };
}

function buildSingaporeIso(year, monthIndex, day, clock) {
    if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    const pad = (number) => String(number).padStart(2, '0');
    const value = `${year}-${pad(monthIndex + 1)}-${pad(day)}T${pad(clock.hour)}:${pad(clock.minute)}:00+08:00`;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const singapore = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    if (
        singapore.getUTCFullYear() !== year
        || singapore.getUTCMonth() !== monthIndex
        || singapore.getUTCDate() !== day
        || singapore.getUTCHours() !== clock.hour
        || singapore.getUTCMinutes() !== clock.minute
    ) {
        return null;
    }
    return date.toISOString();
}

function getDaysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function buildSingaporeEndOfMonthIso(year, monthIndex) {
    const day = getDaysInMonth(year, monthIndex);
    const pad = (number) => String(number).padStart(2, '0');
    const value = `${year}-${pad(monthIndex + 1)}-${pad(day)}T23:59:59.999+08:00`;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function extractScheduleDateContext(...values) {
    const text = values.map((value) => String(value || '')).join('\n');
    const monthYear = text.match(/\b([A-Za-z]{3,9})\s+(\d{4})\b/i);
    if (monthYear) {
        const month = MONTH_INDEX.get(monthYear[1].toLowerCase());
        if (month !== undefined) return { month, year: Number(monthYear[2]) };
    }
    const yearMonth = text.match(/\b(\d{4})\s+([A-Za-z]{3,9})\b/i);
    if (yearMonth) {
        const month = MONTH_INDEX.get(yearMonth[2].toLowerCase());
        if (month !== undefined) return { month, year: Number(yearMonth[1]) };
    }
    const yearOnly = text.match(/\b(20\d{2}|19\d{2})\b/);
    return yearOnly ? { month: null, year: Number(yearOnly[1]) } : { month: null, year: null };
}

function parseDateParts(line, context = {}) {
    const dayFirst = line.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/i);
    if (dayFirst) {
        const month = MONTH_INDEX.get(dayFirst[2].toLowerCase());
        return month === undefined ? null : { day: Number(dayFirst[1]), month, year: Number(dayFirst[3]) };
    }
    const monthFirst = line.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/i);
    if (monthFirst) {
        const month = MONTH_INDEX.get(monthFirst[1].toLowerCase());
        return month === undefined ? null : { day: Number(monthFirst[2]), month, year: Number(monthFirst[3]) };
    }
    const numeric = line.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
    if (numeric) {
        return { day: Number(numeric[1]), month: Number(numeric[2]) - 1, year: Number(numeric[3]) };
    }
    const shortNumeric = line.match(/\b(\d{1,2})[\/-](\d{1,2})\b/);
    if (shortNumeric && Number.isInteger(context.year)) {
        return { day: Number(shortNumeric[1]), month: Number(shortNumeric[2]) - 1, year: context.year };
    }
    return null;
}

function parseTimeRange(line) {
    return String(line || '').match(/(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|\bto\b)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)/i);
}

function extractTimeRanges(line) {
    return [...String(line || '').matchAll(/(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|\bto\b)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)/ig)];
}

function buildSessionEntry(date, range, line, index, suffix = 0) {
    const endMeridiem = range?.[2]?.toLowerCase().match(/(am|pm)/)?.[1] || '';
    const startMeridiem = (range?.[1] || '').toLowerCase().match(/(am|pm)/)?.[1] || endMeridiem;
    const startClock = parseClock(range?.[1], startMeridiem);
    const hasEnd = Boolean(range?.[2]);
    const endClock = hasEnd ? parseClock(range[2], endMeridiem || startMeridiem) : null;
    if (!startClock || (hasEnd && !endClock)) return null;
    const startsAt = buildSingaporeIso(date.year, date.month, date.day, startClock);
    const endsAt = endClock ? buildSingaporeIso(date.year, date.month, date.day, endClock) : null;
    if (!startsAt || (endsAt && new Date(endsAt) <= new Date(startsAt))) return null;

    return {
        key: `import-${index + 1}-${suffix + 1}-${startsAt.replace(/\D/g, '').slice(0, 12)}`,
        type: 'once',
        startsAt,
        endsAt,
        weekdays: [],
        repeatUntil: null,
        timezone: CALENDAR_TIMEZONE,
        status: /\bcancelled?\b/i.test(line) ? 'cancelled' : 'active',
        note: '',
    };
}

function normalizeWeekdayName(value) {
    const key = String(value || '').trim().toLowerCase();
    return WEEKDAY_INDEX.has(key) ? WEEKDAY_INDEX.get(key) : null;
}

function buildWeekdayRange(startDay, endDay) {
    const days = [];
    if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) return days;
    let cursor = startDay;
    for (let guard = 0; guard < 7; guard += 1) {
        days.push(cursor);
        if (cursor === endDay) break;
        cursor = (cursor + 1) % 7;
    }
    return days;
}

function parseWeekdayExpression(value) {
    const expression = String(value || '').trim();
    if (!expression) return [];
    const leftover = expression
        .replace(WEEKDAY_REGEX, '')
        .replace(/\b(every|to|through|thru|and)\b/ig, '')
        .replace(/[&,+/\\\-–—\s]/g, '');
    if (leftover) return [];

    const matches = [...expression.matchAll(WEEKDAY_REGEX)].map((match) => ({
        text: match[0],
        day: normalizeWeekdayName(match[0]),
        index: match.index,
        end: match.index + match[0].length,
    })).filter((match) => Number.isInteger(match.day));
    if (matches.length === 0) return [];

    const days = [];
    for (let index = 0; index < matches.length; index += 1) {
        const current = matches[index];
        const next = matches[index + 1];
        const between = next ? expression.slice(current.end, next.index) : '';
        if (next && /\b(to|through|thru)\b|[-–—]/i.test(between)) {
            days.push(...buildWeekdayRange(current.day, next.day));
            index += 1;
        } else {
            days.push(current.day);
        }
    }
    return [...new Set(days)].sort((left, right) => left - right);
}

function findFirstMonthlyWeekdayDate(context = {}, weekdays = []) {
    if (!Number.isInteger(context.year) || !Number.isInteger(context.month)) return null;
    const allowed = new Set(weekdays);
    for (let day = 1; day <= getDaysInMonth(context.year, context.month); day += 1) {
        const startsAt = buildSingaporeIso(context.year, context.month, day, { hour: 0, minute: 0 });
        if (!startsAt) continue;
        if (allowed.has(getSingaporeWeekday(startsAt))) {
            return { year: context.year, month: context.month, day };
        }
    }
    return null;
}

function buildWeeklySessionEntry(context, weekdays, range, line, index, suffix = 0) {
    const firstDate = findFirstMonthlyWeekdayDate(context, weekdays);
    if (!firstDate) return null;
    const endMeridiem = range?.[2]?.toLowerCase().match(/(am|pm)/)?.[1] || '';
    const startMeridiem = (range?.[1] || '').toLowerCase().match(/(am|pm)/)?.[1] || endMeridiem;
    const startClock = parseClock(range?.[1], startMeridiem);
    const endClock = parseClock(range?.[2], endMeridiem || startMeridiem);
    if (!startClock || !endClock) return null;
    const startsAt = buildSingaporeIso(firstDate.year, firstDate.month, firstDate.day, startClock);
    const endsAt = buildSingaporeIso(firstDate.year, firstDate.month, firstDate.day, endClock);
    const repeatUntil = buildSingaporeEndOfMonthIso(context.year, context.month);
    if (!startsAt || !endsAt || !repeatUntil || new Date(endsAt) <= new Date(startsAt)) return null;

    return {
        key: `import-weekly-${index + 1}-${suffix + 1}-${startsAt.replace(/\D/g, '').slice(0, 12)}`,
        type: 'weekly',
        startsAt,
        endsAt,
        weekdays,
        repeatUntil,
        timezone: CALENDAR_TIMEZONE,
        status: /\bcancelled?\b/i.test(line) ? 'cancelled' : 'active',
        note: '',
    };
}

function parseWeekdayTimeLine(value, index, context = {}) {
    const line = String(value || '').replace(/^[•·\-]\s*/, '').replace(/\s+/g, ' ').trim();
    if (!Number.isInteger(context.year) || !Number.isInteger(context.month)) return [];
    const match = line.match(new RegExp(`^(?:every\\s+)?(.+?)\\s*:\\s*(.+)$`, 'i'));
    if (!match) return [];
    const weekdays = parseWeekdayExpression(match[1]);
    if (weekdays.length === 0) return [];
    const ranges = extractTimeRanges(match[2]);
    if (ranges.length === 0) return [];
    return ranges
        .map((range, offset) => buildWeeklySessionEntry(context, weekdays, range, line, index, offset))
        .filter(Boolean);
}

function parseImportedSessionLine(value, index, context = {}) {
    const line = String(value || '').replace(/\s+/g, ' ').trim();
    const date = parseDateParts(line, context);
    if (!line || !date) return [];
    const range = parseTimeRange(line);
    const single = range ? null : line.match(/(?:,|\bat\b)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))\b/i);
    if (!range && !single) return [];
    if (single) {
        const singleRange = [single[0], single[1], null];
        const entry = buildSessionEntry(date, singleRange, line, index);
        return entry ? [entry] : [];
    }
    const entry = buildSessionEntry(date, range, line, index);
    return entry ? [entry] : [];
}

function extractShortDateParts(line, context = {}) {
    if (!Number.isInteger(context.year)) return [];
    return [...String(line || '').matchAll(/\b(\d{1,2})[\/-](\d{1,2})(?![\/-]\d{2,4})\b/g)]
        .map((match) => ({ day: Number(match[1]), month: Number(match[2]) - 1, year: context.year }));
}

function hasScheduleSignal(line) {
    return parseTimeRange(line)
        || /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(line)
        || /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i.test(line)
        || /\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/i.test(line);
}

function hasUnclearScheduleSignal(line) {
    return /\b(call|contact|confirm|confirmed|timing|time|tbc|tba|appointment|enquire|inquire)\b/i.test(line);
}

function parseImportedScheduleTextBlock(lines = [], context = {}) {
    const entries = [];
    const unparsed = [];
    let activeRange = null;
    let activeRangeLineIndex = -1;
    let activeRangeUsed = false;

    lines.forEach((rawLine, index) => {
        const line = String(rawLine || '').replace(/\s+/g, ' ').trim();
        if (!line) return;

        const lineRange = parseTimeRange(line);
        const weeklyEntries = parseWeekdayTimeLine(line, index, context);
        if (weeklyEntries.length > 0) {
            if (activeRange && !activeRangeUsed) {
                unparsed.push(lines[activeRangeLineIndex]);
            }
            activeRange = null;
            activeRangeLineIndex = -1;
            activeRangeUsed = false;
            entries.push(...weeklyEntries);
            return;
        }

        if (lineRange) {
            if (activeRange && !activeRangeUsed) {
                unparsed.push(lines[activeRangeLineIndex]);
            }
            activeRange = lineRange;
            activeRangeLineIndex = index;
            activeRangeUsed = false;
        }

        const sameLineDateParts = lineRange ? extractShortDateParts(line, context) : [];
        if (sameLineDateParts.length > 0) {
            const builtEntries = sameLineDateParts
                .map((date, offset) => buildSessionEntry(date, lineRange, line, index, offset))
                .filter(Boolean);
            if (builtEntries.length > 0) {
                entries.push(...builtEntries);
                activeRangeUsed = true;
                return;
            }
        }

        const directEntries = parseImportedSessionLine(line, index, context);
        if (directEntries.length > 0) {
            entries.push(...directEntries);
            if (lineRange) activeRangeUsed = true;
            return;
        }

        const dateParts = extractShortDateParts(line, context);
        if (dateParts.length > 0 && activeRange) {
            const builtEntries = dateParts
                .map((date, offset) => buildSessionEntry(date, activeRange, line, index, offset))
                .filter(Boolean);
            if (builtEntries.length > 0) {
                entries.push(...builtEntries);
                activeRangeUsed = true;
                return;
            }
        }

        if ((hasScheduleSignal(line) || hasUnclearScheduleSignal(line)) && !lineRange) {
            unparsed.push(line);
        }
    });

    if (activeRange && !activeRangeUsed) {
        unparsed.push(lines[activeRangeLineIndex]);
    }

    if (entries.length === 0 && unparsed.length === 0) {
        unparsed.push(...lines.map((line) => String(line || '').trim()).filter(Boolean));
    }

    return { entries, unparsed };
}

export function parseImportedScheduleSessions(values = [], fallbackText = '', options = {}) {
    const rawValues = Array.isArray(values) && values.length
        ? values
        : String(fallbackText || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const structured = [];
    const textValues = [];
    const unparsed = [];
    const context = extractScheduleDateContext(
        options.contextText,
        fallbackText,
        rawValues.filter((value) => typeof value === 'string').join('\n'),
    );

    rawValues.forEach((value, index) => {
        if (value && typeof value === 'object') {
            if (value.startsAt) {
                try {
                    structured.push(normalizeOfferingSchedulePlanInput({ enabled: true, entries: [value] }).entries[0]);
                } catch {
                    unparsed.push(JSON.stringify(value));
                }
            } else {
                unparsed.push(JSON.stringify(value));
            }
            return;
        }
        if (String(value || '').trim()) textValues.push(String(value).trim());
    });

    const parsedText = parseImportedScheduleTextBlock(textValues, context);
    structured.push(...parsedText.entries);
    unparsed.push(...parsedText.unparsed);

    const unique = [];
    const seen = new Set();
    for (const entry of structured) {
        const signature = JSON.stringify({
            type: entry.type || 'once',
            startsAt: entry.startsAt,
            endsAt: entry.endsAt || '',
            weekdays: entry.weekdays || [],
            repeatUntil: entry.repeatUntil || '',
            status: entry.status,
        });
        if (seen.has(signature)) continue;
        seen.add(signature);
        unique.push(entry);
    }

    return { entries: unique, unparsed };
}
