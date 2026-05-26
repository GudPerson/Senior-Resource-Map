import { isGudAuthPhoneLoginReturn } from './phoneVerificationState.js';

export function shouldShowPhoneLoginHandoff(search, storedAttempt) {
    const attemptId = Number.parseInt(String(storedAttempt?.attemptId || ''), 10);
    return isGudAuthPhoneLoginReturn(search) || Boolean(attemptId);
}
