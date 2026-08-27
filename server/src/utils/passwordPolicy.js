import { z } from 'zod';

export const MIN_NEW_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;

const passwordTypeOptions = {
    required_error: 'Password is required.',
    invalid_type_error: 'Password must be text.',
};

export const loginPasswordSchema = z.string(passwordTypeOptions)
    .min(1, 'Password is required.')
    .max(MAX_PASSWORD_LENGTH, 'Password is too long.');

export const newPasswordSchema = z.string(passwordTypeOptions)
    .min(MIN_NEW_PASSWORD_LENGTH, `Password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters.`)
    .max(MAX_PASSWORD_LENGTH, 'Password is too long.')
    .refine((value) => /\S/.test(value), 'Password cannot be blank.');

export function validateNewPassword(value) {
    const result = newPasswordSchema.safeParse(value);
    if (result.success) return result.data;

    const error = new Error(result.error.issues[0]?.message || 'Password is invalid.');
    error.status = 400;
    throw error;
}
