import { CalendarPlus, Copy, Trash2 } from 'lucide-react';

import { createEmptyScheduleEntry } from '../lib/offeringSchedule.js';

const WEEKDAY_OPTIONS = [
    ['Sun', 0],
    ['Mon', 1],
    ['Tue', 2],
    ['Wed', 3],
    ['Thu', 4],
    ['Fri', 5],
    ['Sat', 6],
];

export default function OfferingScheduleEntriesEditor({
    entries = [],
    onChange,
    disabled = false,
    compact = false,
}) {
    function updateEntry(index, patch) {
        onChange(entries.map((entry, entryIndex) => (
            entryIndex === index ? { ...entry, ...patch } : entry
        )));
    }

    function addEntry() {
        onChange([...entries, createEmptyScheduleEntry()]);
    }

    function duplicateEntry(index) {
        const source = entries[index];
        onChange([
            ...entries.slice(0, index + 1),
            createEmptyScheduleEntry({ ...source, key: undefined }),
            ...entries.slice(index + 1),
        ]);
    }

    function removeEntry(index) {
        onChange(entries.filter((_, entryIndex) => entryIndex !== index));
    }

    return (
        <div className="space-y-4">
            {entries.map((entry, index) => (
                <article key={entry.key || index} className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Session {index + 1}</p>
                            <p className="mt-0.5 text-xs text-slate-500">Choose one date or a recurring weekly series.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => duplicateEntry(index)}
                                disabled={disabled}
                                className="btn-ghost min-h-[38px] px-3 text-xs"
                            >
                                <Copy size={14} /> Duplicate
                            </button>
                            <button
                                type="button"
                                onClick={() => removeEntry(index)}
                                disabled={disabled}
                                className="btn-ghost min-h-[38px] px-3 text-xs text-red-700"
                            >
                                <Trash2 size={14} /> Remove
                            </button>
                        </div>
                    </div>

                    <div className={`mt-4 grid grid-cols-1 gap-4 ${compact ? 'lg:grid-cols-2' : 'md:grid-cols-2'}`}>
                        <label>
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Session type</span>
                            <select
                                value={entry.type || 'once'}
                                onChange={(event) => updateEntry(index, {
                                    type: event.target.value,
                                    weekdays: event.target.value === 'weekly' ? entry.weekdays || [] : [],
                                    repeatUntil: event.target.value === 'weekly' ? entry.repeatUntil || '' : '',
                                })}
                                disabled={disabled}
                                className="input-field"
                            >
                                <option value="once">Individual session</option>
                                <option value="weekly">Recurring weekly</option>
                            </select>
                        </label>
                        <label>
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Status</span>
                            <select
                                value={entry.status || 'active'}
                                onChange={(event) => updateEntry(index, { status: event.target.value })}
                                disabled={disabled}
                                className="input-field"
                            >
                                <option value="active">Scheduled</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </label>
                        <label>
                            <span className="mb-1 block text-sm font-semibold text-slate-700">
                                {entry.type === 'weekly' ? 'First session starts' : 'Session starts'}
                            </span>
                            <input
                                type="datetime-local"
                                value={entry.startsAt || ''}
                                onChange={(event) => updateEntry(index, { startsAt: event.target.value })}
                                disabled={disabled}
                                className="input-field"
                            />
                        </label>
                        <label>
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Session ends (optional)</span>
                            <input
                                type="datetime-local"
                                value={entry.endsAt || ''}
                                onChange={(event) => updateEntry(index, { endsAt: event.target.value })}
                                disabled={disabled}
                                className="input-field"
                            />
                        </label>

                        {entry.type === 'weekly' ? (
                            <>
                                <fieldset className={compact ? 'lg:col-span-2' : 'md:col-span-2'}>
                                    <legend className="mb-2 text-sm font-semibold text-slate-700">Repeats on</legend>
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAY_OPTIONS.map(([label, value]) => {
                                            const checked = (entry.weekdays || []).includes(value);
                                            return (
                                                <label
                                                    key={value}
                                                    className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border px-3 py-2 text-sm font-bold ${checked ? 'border-teal-500 bg-teal-100 text-teal-900' : 'border-slate-200 bg-white text-slate-600'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => updateEntry(index, {
                                                            weekdays: checked
                                                                ? (entry.weekdays || []).filter((day) => day !== value)
                                                                : [...(entry.weekdays || []), value].sort(),
                                                        })}
                                                        disabled={disabled}
                                                        className="sr-only"
                                                    />
                                                    {label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                                <label>
                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Repeat until (optional)</span>
                                    <input
                                        type="datetime-local"
                                        value={entry.repeatUntil || ''}
                                        onChange={(event) => updateEntry(index, { repeatUntil: event.target.value })}
                                        disabled={disabled}
                                        className="input-field"
                                    />
                                </label>
                            </>
                        ) : null}

                        <label className={compact ? 'lg:col-span-2' : 'md:col-span-2'}>
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Session note (optional)</span>
                            <input
                                type="text"
                                value={entry.note || ''}
                                onChange={(event) => updateEntry(index, { note: event.target.value })}
                                disabled={disabled}
                                className="input-field"
                                placeholder="e.g. Meet at the activity room"
                            />
                        </label>
                    </div>
                </article>
            ))}

            <button
                type="button"
                onClick={addEntry}
                disabled={disabled}
                className="btn-secondary min-h-[44px]"
            >
                <CalendarPlus size={17} /> Add another schedule
            </button>
        </div>
    );
}
