import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('new-password interfaces explain and enforce the twelve-character minimum', () => {
    const authPage = readSource('src/pages/AuthPage.jsx');
    const adminForm = readSource('src/components/AdminUserForm.jsx');
    const adminPage = readSource('src/pages/dashboard/AdminPage.jsx');
    const profilePage = readSource('src/pages/dashboard/ProfilePage.jsx');

    assert.match(authPage, /minLength=\{tab === 'register' \? 12 : undefined\}/);
    assert.match(authPage, /t\('newPasswordMinimum'\)/);
    assert.match(authPage, /autoComplete="name"/);
    assert.match(authPage, /autoComplete=\{tab === 'register' \? 'email' : 'username'\}/);
    assert.match(authPage, /autoComplete=\{tab === 'register' \? 'new-password' : 'current-password'\}/);
    assert.match(adminForm, /minLength=\{12\}/);
    assert.match(adminPage, /Passwords must contain at least 12 characters/);
    assert.match(profilePage, /form\.password\.length < 12/);
    assert.match(profilePage, /minLength=\{12\}/);
});
