import { z } from 'zod';

import { getDb } from '../db/index.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { createGudAuthClient } from '../utils/gudAuthClient.js';
import {
    createPhoneIdentityLinkStore,
    getPhoneIdentitySummary,
    pollPhoneIdentityLinkAttempt,
    startPhoneIdentityLinkAttempt,
} from '../utils/phoneIdentityLinking.js';
import { optionalOneLineTextSchema, parsePositiveInt, validateRequestBody } from '../utils/inputValidation.js';

const startLinkBodySchema = z.object({
    phone: optionalOneLineTextSchema(80),
}).optional().default({});

function statusForError(err) {
    const status = Number.parseInt(String(err?.status || ''), 10);
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function errorPayload(err) {
    return {
        error: err?.message || 'Unable to verify phone right now.',
        ...(err?.code ? { code: err.code } : {}),
        ...(err?.code === 'manual_review_required' ? { status: 'manual_review' } : {}),
    };
}

function createLinkingDependencies(c) {
    const db = getDb(c.env);
    return {
        db,
        store: createPhoneIdentityLinkStore(db),
        gudAuthClient: createGudAuthClient(c.env),
    };
}

export async function getCurrentPhoneIdentity(c) {
    try {
        const { db, store } = createLinkingDependencies(c);
        await ensureBoundarySchema(db, c.env);
        const summary = await getPhoneIdentitySummary(store, c.get('user'));
        return c.json(summary);
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone identity summary error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}

export async function startPhoneLink(c) {
    try {
        const rawBody = await c.req.json().catch(() => ({}));
        const input = validateRequestBody(rawBody, startLinkBodySchema, 'Phone verification request');
        const { db, store, gudAuthClient } = createLinkingDependencies(c);
        await ensureBoundarySchema(db, c.env);
        const result = await startPhoneIdentityLinkAttempt({
            store,
            gudAuthClient,
            user: c.get('user'),
            input,
        });

        return c.json(result);
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone link start error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}

export async function getPhoneLinkAttempt(c) {
    try {
        const attemptId = parsePositiveInt(c.req.param('attemptId'), 'Verification attempt id');
        const { db, store, gudAuthClient } = createLinkingDependencies(c);
        await ensureBoundarySchema(db, c.env);
        const result = await pollPhoneIdentityLinkAttempt({
            store,
            gudAuthClient,
            user: c.get('user'),
            attemptId,
        });

        return c.json(result);
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone link poll error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}

