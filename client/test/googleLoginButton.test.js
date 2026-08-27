import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authPageSource = readFileSync(
    new URL('../src/pages/AuthPage.jsx', import.meta.url),
    'utf8',
);

test('Google sign-in does not pass an invalid percentage width to Google Identity Services', () => {
    assert.match(authPageSource, /<GoogleLogin[\s\S]*?text=\{tab === 'login' \? 'signin_with' : 'signup_with'\}/);
    assert.doesNotMatch(authPageSource, /<GoogleLogin[\s\S]*?width=["']100%["']/);
});
