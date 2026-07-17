const SINGAPORE_TIMEZONE = 'Asia/Singapore';

export function formatSingaporeDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: SINGAPORE_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatSingaporeDateInput(value) {
    return formatSingaporeDateTimeLocal(value).slice(0, 10);
}

export function singaporeDateTimeLocalToIso(value) {
    if (!value) return null;
    const date = new Date(`${value}:00+08:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function singaporeDateInputToEndOfDayIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(`${value}T23:59:59.999+08:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function repeatUntilToIso(value) {
    return singaporeDateInputToEndOfDayIso(value) || singaporeDateTimeLocalToIso(value);
}

export function createEmptyScheduleEntry(overrides = {}) {
    return {
        key: overrides.key || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: overrides.type || 'once',
        startsAt: overrides.startsAt || '',
        endsAt: overrides.endsAt || '',
        weekdays: Array.isArray(overrides.weekdays) ? overrides.weekdays : [],
        repeatUntil: overrides.repeatUntil || '',
        timezone: SINGAPORE_TIMEZONE,
        status: overrides.status || 'active',
        note: overrides.note || '',
    };
}

export function scheduleEntryFromApi(entry = {}) {
    return createEmptyScheduleEntry({
        key: entry.key || entry.id,
        type: entry.type || entry.recurrence || 'once',
        startsAt: formatSingaporeDateTimeLocal(entry.startsAt),
        endsAt: formatSingaporeDateTimeLocal(entry.endsAt),
        weekdays: Array.isArray(entry.weekdays) ? entry.weekdays : [],
        repeatUntil: formatSingaporeDateInput(entry.repeatUntil),
        status: entry.status || 'active',
        note: entry.note || '',
    });
}

export function scheduleEntryToApi(entry = {}) {
    return {
        key: entry.key,
        type: entry.type || 'once',
        startsAt: singaporeDateTimeLocalToIso(entry.startsAt),
        endsAt: singaporeDateTimeLocalToIso(entry.endsAt),
        weekdays: entry.type === 'weekly' && Array.isArray(entry.weekdays) ? entry.weekdays : [],
        repeatUntil: entry.type === 'weekly' ? repeatUntilToIso(entry.repeatUntil) : null,
        timezone: SINGAPORE_TIMEZONE,
        status: entry.status || 'active',
        note: entry.note || '',
    };
}

export function buildSchedulePlanForm(initialData = {}) {
    const plan = initialData.schedulePlan;
    if (plan && Array.isArray(plan.entries)) {
        return {
            enabled: Boolean(plan.enabled),
            notes: plan.notes || '',
            entries: plan.entries.map(scheduleEntryFromApi),
            revision: Math.max(Number(initialData.calendarSchedule?.revision) || 0, 0),
            initiallyPublished: Boolean(plan.enabled),
            legacyText: !plan.enabled && initialData.calendarScheduleSource === 'legacy'
                ? (initialData.schedule || '')
                : '',
        };
    }

    const legacy = initialData.calendarSchedule || {};
    return {
        enabled: Boolean(legacy.enabled),
        notes: initialData.scheduleNotes || '',
        revision: Math.max(Number(legacy.revision) || 0, 0),
        initiallyPublished: Boolean(legacy.enabled),
        legacyText: !legacy.enabled ? (initialData.schedule || '') : '',
        entries: legacy.enabled ? [scheduleEntryFromApi({
            key: 'legacy-primary',
            type: legacy.recurrence || 'once',
            startsAt: legacy.startsAt,
            endsAt: legacy.endsAt,
            weekdays: legacy.weekdays,
            repeatUntil: legacy.repeatUntil,
            status: legacy.status,
        })] : [],
    };
}

export function buildSchedulePlanUpdateMeta(plan = {}) {
    return {
        schedulePlanAction: plan.enabled
            ? 'publish'
            : (plan.initiallyPublished ? 'unpublish' : 'update'),
        expectedScheduleRevision: Math.max(Number(plan.revision) || 0, 0),
    };
}

export function schedulePlanToApi(plan = {}) {
    return {
        enabled: Boolean(plan.enabled),
        notes: plan.notes || '',
        entries: plan.enabled ? (plan.entries || []).map(scheduleEntryToApi) : [],
    };
}

export function getSchedulePlanValidationError(plan = {}) {
    if (!plan.enabled) return '';
    const entries = Array.isArray(plan.entries) ? plan.entries : [];
    if (entries.length === 0) return 'Add at least one session before publishing to Care Calendar.';

    const signatures = new Set();
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const label = `Session ${index + 1}`;
        const startsAt = singaporeDateTimeLocalToIso(entry.startsAt);
        const endsAt = singaporeDateTimeLocalToIso(entry.endsAt);
        const repeatUntil = repeatUntilToIso(entry.repeatUntil);
        if (!startsAt) return `${label} needs a valid start date and time.`;
        if (endsAt && new Date(endsAt) <= new Date(startsAt)) return `${label} must end after it starts.`;
        if (entry.type === 'weekly') {
            if (!Array.isArray(entry.weekdays) || entry.weekdays.length === 0) {
                return `${label} needs at least one weekday.`;
            }
            const startDate = String(entry.startsAt || '').slice(0, 10);
            const startWeekday = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
                ? new Date(`${startDate}T00:00:00.000Z`).getUTCDay()
                : null;
            if (startWeekday === null || !entry.weekdays.includes(startWeekday)) {
                return `${label} must start on one of its selected repeat weekdays.`;
            }
            if (repeatUntil && new Date(repeatUntil) < new Date(startsAt)) {
                return `${label} must repeat until a date after its first session.`;
            }
        }
        const signature = JSON.stringify({
            type: entry.type,
            startsAt,
            endsAt,
            weekdays: entry.type === 'weekly' ? entry.weekdays : [],
            repeatUntil: entry.type === 'weekly' ? repeatUntil : null,
            status: entry.status,
        });
        if (signatures.has(signature)) return `${label} duplicates another schedule row.`;
        signatures.add(signature);
    }
    return '';
}

function formatOccurrence(startValue, endValue, status) {
    const start = new Date(startValue);
    const end = endValue ? new Date(endValue) : null;
    if (Number.isNaN(start.getTime())) return '';
    const dateText = new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(start);
    const timeFormatter = new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const timeText = end && !Number.isNaN(end.getTime())
        ? `${timeFormatter.format(start)}–${timeFormatter.format(end)}`
        : timeFormatter.format(start);
    return `${dateText}, ${timeText}${status === 'cancelled' ? ' (Cancelled)' : ''}`;
}

export function buildSchedulePlanOccurrencePreview(plan = {}, limit = 5) {
    if (!plan.enabled) return [];
    const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, 10));
    const occurrences = [];

    for (const entry of plan.entries || []) {
        const startIso = singaporeDateTimeLocalToIso(entry.startsAt);
        if (!startIso) continue;
        const start = new Date(startIso);
        const endIso = singaporeDateTimeLocalToIso(entry.endsAt);
        const durationMs = endIso ? Math.max(new Date(endIso).getTime() - start.getTime(), 0) : 0;

        if (entry.type !== 'weekly') {
            occurrences.push({
                start: start.getTime(),
                text: formatOccurrence(start, durationMs ? new Date(start.getTime() + durationMs) : null, entry.status),
            });
            continue;
        }

        const weekdays = new Set(Array.isArray(entry.weekdays) ? entry.weekdays : []);
        const repeatUntilIso = repeatUntilToIso(entry.repeatUntil);
        const repeatUntil = repeatUntilIso ? new Date(repeatUntilIso).getTime() : Number.POSITIVE_INFINITY;
        const [startDate, startTime] = String(entry.startsAt || '').split('T');
        const firstDate = new Date(`${startDate}T00:00:00.000Z`);
        if (Number.isNaN(firstDate.getTime()) || !startTime) continue;

        let entryOccurrenceCount = 0;
        for (let dayOffset = 0; dayOffset < 70 && entryOccurrenceCount < cappedLimit; dayOffset += 1) {
            const cursor = new Date(firstDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
            if (!weekdays.has(cursor.getUTCDay())) continue;
            const datePart = cursor.toISOString().slice(0, 10);
            const occurrenceIso = singaporeDateTimeLocalToIso(`${datePart}T${startTime}`);
            const occurrenceStart = occurrenceIso ? new Date(occurrenceIso) : null;
            if (!occurrenceStart || occurrenceStart.getTime() < start.getTime() || occurrenceStart.getTime() > repeatUntil) continue;
            occurrences.push({
                start: occurrenceStart.getTime(),
                text: formatOccurrence(
                    occurrenceStart,
                    durationMs ? new Date(occurrenceStart.getTime() + durationMs) : null,
                    entry.status,
                ),
            });
            entryOccurrenceCount += 1;
        }
    }

    return occurrences
        .filter((occurrence) => occurrence.text)
        .sort((left, right) => left.start - right.start || left.text.localeCompare(right.text))
        .slice(0, cappedLimit)
        .map((occurrence) => occurrence.text);
}

function formatLocalDateTime(value) {
    if (!value) return '';
    const date = new Date(`${value}:00+08:00`);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function formatLocalDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    const date = new Date(`${value}T00:00:00.000Z`);
    return new Intl.DateTimeFormat('en-SG', {
        timeZone: 'UTC',
        dateStyle: 'medium',
    }).format(date);
}

export function buildSchedulePlanPreviewText(plan = {}) {
    if (!plan.enabled) return '';
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows = (plan.entries || []).map((entry) => {
        if (entry.type === 'weekly') {
            const weekdays = (entry.weekdays || []).map((day) => weekdayLabels[day]).filter(Boolean).join(', ');
            return `Every ${weekdays}: ${formatLocalDateTime(entry.startsAt)}${entry.repeatUntil ? ` until ${formatLocalDate(entry.repeatUntil)}` : ''}${entry.status === 'cancelled' ? ' (Cancelled)' : ''}`;
        }
        return `${formatLocalDateTime(entry.startsAt)}${entry.endsAt ? ` – ${formatLocalDateTime(entry.endsAt)}` : ''}${entry.status === 'cancelled' ? ' (Cancelled)' : ''}`;
    });
    if (plan.notes) rows.push(plan.notes);
    return rows.filter(Boolean).join('\n');
}
