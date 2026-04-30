import test from 'node:test';
import assert from 'node:assert/strict';

import {
    evaluateOfferingAccess,
    getMissingEligibilityProfileFields,
    normalizeEligibilityRules,
    OFFERING_ACCESS,
} from '../src/utils/eligibility.js';

function createAsset(eligibilityRules) {
    return {
        id: 1,
        isMemberOnly: false,
        eligibilityRules,
    };
}

test('normalizeEligibilityRules keeps all six eligibility profile criteria', () => {
    const rules = normalizeEligibilityRules({
        version: 1,
        criteria: {
            age: { min: '60', max: '90' },
            gender: { anyOf: ['female'] },
            chasCard: { anyOf: ['blue', 'orange'] },
            caregiverStatus: { anyOf: ['yes'] },
            propertyType: { anyOf: ['hdb_1_2_room'] },
            volunteerInterest: { anyOf: ['no'] },
        },
    });

    assert.deepEqual(rules.criteria, {
        age: { min: 60, max: 90 },
        gender: { anyOf: ['female'] },
        chasCard: { anyOf: ['blue', 'orange'] },
        caregiverStatus: { anyOf: ['yes'] },
        propertyType: { anyOf: ['hdb_1_2_room'] },
        volunteerInterest: { anyOf: ['no'] },
    });
});

test('evaluateOfferingAccess locks when any selected profile criterion is missing', () => {
    const rules = normalizeEligibilityRules({
        version: 1,
        criteria: {
            chasCard: { anyOf: ['blue'] },
            caregiverStatus: { anyOf: ['yes'] },
            volunteerInterest: { anyOf: ['yes'] },
        },
    });

    const result = evaluateOfferingAccess(createAsset(rules), {}, {});

    assert.equal(result.status, OFFERING_ACCESS.LOCKED_MISSING_DATA);
    assert.deepEqual(result.missingProfileFields, ['chasCard', 'caregiverStatus', 'volunteerInterest']);
    assert.deepEqual(getMissingEligibilityProfileFields(rules, {}), ['chasCard', 'caregiverStatus', 'volunteerInterest']);
});

test('evaluateOfferingAccess grants or denies CHAS, caregiver, and volunteer matches', () => {
    const rules = normalizeEligibilityRules({
        version: 1,
        criteria: {
            chasCard: { anyOf: ['blue'] },
            caregiverStatus: { anyOf: ['yes'] },
            volunteerInterest: { anyOf: ['no'] },
        },
    });

    const granted = evaluateOfferingAccess(createAsset(rules), {
        chasCard: 'blue',
        caregiverStatus: 'yes',
        volunteerInterest: 'no',
    }, {});
    const denied = evaluateOfferingAccess(createAsset(rules), {
        chasCard: 'orange',
        caregiverStatus: 'yes',
        volunteerInterest: 'no',
    }, {});

    assert.equal(granted.status, OFFERING_ACCESS.GRANTED);
    assert.equal(denied.status, OFFERING_ACCESS.DENIED);
});
