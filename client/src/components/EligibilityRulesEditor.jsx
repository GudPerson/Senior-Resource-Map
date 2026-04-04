import Select from 'react-select';

import {
    GENDER_OPTIONS,
    PROPERTY_TYPE_OPTIONS,
} from '../lib/profileAttributes.js';
import {
    normalizeEligibilityRules,
    summarizeEligibilityRules,
} from '../lib/eligibility.js';

function buildEditableRules(rules) {
    const normalized = normalizeEligibilityRules(rules);
    const rawCriteria = rules?.criteria && typeof rules.criteria === 'object' ? rules.criteria : {};
    const hasRawRules = Boolean(rules && typeof rules === 'object' && ('criteria' in rules || 'version' in rules));
    return {
        enabled: hasRawRules || Boolean(normalized),
        ageMin: normalized?.criteria?.age?.min ?? rawCriteria?.age?.min ?? '',
        ageMax: normalized?.criteria?.age?.max ?? rawCriteria?.age?.max ?? '',
        genders: normalized?.criteria?.gender?.anyOf ?? rawCriteria?.gender?.anyOf ?? [],
        propertyTypes: normalized?.criteria?.propertyType?.anyOf ?? rawCriteria?.propertyType?.anyOf ?? [],
    };
}

function buildRulesPayload(state) {
    if (!state.enabled) return null;
    return normalizeEligibilityRules({
        version: 1,
        criteria: {
            age: {
                min: state.ageMin,
                max: state.ageMax,
            },
            gender: {
                anyOf: state.genders,
            },
            propertyType: {
                anyOf: state.propertyTypes,
            },
        },
    }) || { version: 1, criteria: {} };
}

export default function EligibilityRulesEditor({
    value,
    onChange,
    readOnly = false,
    title = 'Eligibility rules',
    description = 'Limit this offering to users who match the selected profile attributes.',
}) {
    const rulesState = buildEditableRules(value);
    const summary = summarizeEligibilityRules(value);

    if (readOnly) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                        {summary.length ? 'Inherited eligibility criteria apply to this offering.' : 'No eligibility rules are defined.'}
                    </p>
                </div>

                {summary.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {summary.map((item) => (
                            <span key={item} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                {item}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }

    function update(nextPatch) {
        const nextState = { ...rulesState, ...nextPatch };
        onChange?.(buildRulesPayload(nextState));
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                    <input
                        type="checkbox"
                        checked={rulesState.enabled}
                        onChange={(event) => update({ enabled: event.target.checked })}
                        className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-brand-600 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                </label>
            </div>

            {rulesState.enabled ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Minimum age</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={rulesState.ageMin}
                            onChange={(event) => update({ ageMin: event.target.value })}
                            placeholder="60"
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Maximum age</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={rulesState.ageMax}
                            onChange={(event) => update({ ageMax: event.target.value })}
                            placeholder="120"
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Eligible genders</label>
                        <Select
                            isMulti
                            options={GENDER_OPTIONS}
                            value={GENDER_OPTIONS.filter((option) => rulesState.genders.includes(option.value))}
                            onChange={(selected) => update({ genders: Array.isArray(selected) ? selected.map((item) => item.value) : [] })}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select eligible genders..."
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Eligible property types</label>
                        <Select
                            isMulti
                            options={PROPERTY_TYPE_OPTIONS}
                            value={PROPERTY_TYPE_OPTIONS.filter((option) => rulesState.propertyTypes.includes(option.value))}
                            onChange={(selected) => update({ propertyTypes: Array.isArray(selected) ? selected.map((item) => item.value) : [] })}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select property types..."
                        />
                    </div>
                </div>
            ) : (
                <p className="text-xs text-slate-500">
                    Leave this off to make the offering available without demographic eligibility checks.
                </p>
            )}
        </div>
    );
}
