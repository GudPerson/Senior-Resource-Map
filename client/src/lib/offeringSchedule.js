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

export function singaporeDateTimeLocalToIso(value) {
    if (!value) return null;
    const date = new Date(`${value}:00+08:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
        repeatUntil: formatSingaporeDateTimeLocal(entry.repeatUntil),
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
        repeatUntil: entry.type === 'weekly' ? singaporeDateTimeLocalToIso(entry.repeatUntil) : null,
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
            legacyText: !plan.enabled && initialData.calendarScheduleSource === 'legacy'
                ? (initialData.schedule || '')
                : '',
        };
    }

    const legacy = initialData.calendarSchedule || {};
    return {
        enabled: Boolean(legacy.enabled),
        notes: initialData.scheduleNotes || '',
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
        const repeatUntil = singaporeDateTimeLocalToIso(entry.repeatUntil);
        if (!startsAt) return `${label} needs a valid start date and time.`;
        if (endsAt && new Date(endsAt) <= new Date(startsAt)) return `${label} must end after it starts.`;
        if (entry.type === 'weekly') {
            if (!Array.isArray(entry.weekdays) || entry.weekdays.length === 0) {
                return `${label} needs at least one weekday.`;
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

export function buildSchedulePlanPreviewText(plan = {}) {
    if (!plan.enabled) return '';
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows = (plan.entries || []).map((entry) => {
        if (entry.type === 'weekly') {
            const weekdays = (entry.weekdays || []).map((day) => weekdayLabels[day]).filter(Boolean).join(', ');
            return `Every ${weekdays}: ${formatLocalDateTime(entry.startsAt)}${entry.repeatUntil ? ` until ${formatLocalDateTime(entry.repeatUntil)}` : ''}${entry.status === 'cancelled' ? ' (Cancelled)' : ''}`;
        }
        return `${formatLocalDateTime(entry.startsAt)}${entry.endsAt ? ` – ${formatLocalDateTime(entry.endsAt)}` : ''}${entry.status === 'cancelled' ? ' (Cancelled)' : ''}`;
    });
    if (plan.notes) rows.push(plan.notes);
    return rows.filter(Boolean).join('\n');
}
