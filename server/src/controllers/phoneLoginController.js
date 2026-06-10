import { z } from 'zod';

import { getDb } from '../db/index.js';
import { ensureBoundarySchema, ensureUserPreferenceColumns } from '../utils/boundarySchema.js';
import { createGudAuthClient } from '../utils/gudAuthClient.js';
import {
    optionalOneLineTextSchema,
    parsePositiveInt,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import {
    completePhoneLoginSignup,
    createPhoneLoginStore,
    PHONE_LOGIN_ATTEMPT_STATUS,
    pollPhoneLoginAttempt,
    startPhoneLoginAttempt,
} from '../utils/phoneLogin.js';
import { buildSessionPayload, createSessionToken, setAuthCookie } from '../utils/sessionAuth.js';

const startPhoneLoginBodySchema = z.object({
    phone: optionalOneLineTextSchema(80),
});

const phoneLoginSignupBodySchema = z.object({
    name: requiredOneLineTextSchema('Name', 255),
    postalCode: optionalOneLineTextSchema(20),
});

function statusForError(err) {
    const status = Number.parseInt(String(err?.status || ''), 10);
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function errorPayload(err) {
    return {
        error: err?.message || 'Unable to start WhatsApp sign-in right now.',
        ...(err?.code ? { code: err.code } : {}),
    };
}

function createPhoneLoginDependencies(c) {
    const db = getDb(c.env);
    return {
        db,
        store: createPhoneLoginStore(db),
        gudAuthClient: createGudAuthClient(c.env),
    };
}

function safePhoneLoginMessage(result) {
    if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.noAccount) {
        return 'No verified CareAround account is linked to this WhatsApp number.';
    }
    if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.signupRequired) {
        return 'Your WhatsApp number is verified. Add your name to create your CareAround account.';
    }
    if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.conflict) {
        return 'This WhatsApp number needs support review before sign-in can continue.';
    }
    if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.expired) {
        return 'This WhatsApp sign-in has expired. Please try again.';
    }
    if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.failed) {
        return 'WhatsApp sign-in could not be completed. Please try again.';
    }
    return null;
}

function publicAttemptPayload(result) {
    return {
        attemptId: result.attemptId,
        status: result.status,
        phone: result.phone,
        reason: result.reason,
        message: safePhoneLoginMessage(result),
        ...(result.challenge ? { challenge: result.challenge } : {}),
    };
}

export async function startPhoneLogin(c) {
    try {
        const rawBody = await c.req.json().catch(() => ({}));
        const input = validateRequestBody(rawBody, startPhoneLoginBodySchema, 'Phone sign-in request');
        const { db, store, gudAuthClient } = createPhoneLoginDependencies(c);
        await ensureBoundarySchema(db, c.env);
        const result = await startPhoneLoginAttempt({
            store,
            gudAuthClient,
            input,
        });

        return c.json(publicAttemptPayload(result));
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone login start error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}

export async function getPhoneLoginAttempt(c) {
    try {
        const attemptId = parsePositiveInt(c.req.param('attemptId'), 'Phone sign-in attempt id');
        const { db, store, gudAuthClient } = createPhoneLoginDependencies(c);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);
        const result = await pollPhoneLoginAttempt({
            store,
            gudAuthClient,
            attemptId,
        });

        if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.verified && result.user) {
            const token = await createSessionToken(result.user, c);
            setAuthCookie(c, token);
            return c.json({
                ...publicAttemptPayload(result),
                user: buildSessionPayload(result.user),
            });
        }

        return c.json(publicAttemptPayload(result));
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone login poll error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}

export async function completePhoneSignup(c) {
    try {
        const attemptId = parsePositiveInt(c.req.param('attemptId'), 'Phone sign-up attempt id');
        const rawBody = await c.req.json().catch(() => ({}));
        const input = validateRequestBody(rawBody, phoneLoginSignupBodySchema, 'Phone sign-up details');
        const { db, store } = createPhoneLoginDependencies(c);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);
        const result = await completePhoneLoginSignup({
            store,
            attemptId,
            input,
        });

        if (result.status === PHONE_LOGIN_ATTEMPT_STATUS.verified && result.user) {
            const token = await createSessionToken(result.user, c);
            setAuthCookie(c, token);
            return c.json({
                ...publicAttemptPayload(result),
                user: buildSessionPayload(result.user),
            });
        }

        return c.json(publicAttemptPayload(result));
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Phone login signup error:', err);
        return c.json(errorPayload(err), statusForError(err));
    }
}
