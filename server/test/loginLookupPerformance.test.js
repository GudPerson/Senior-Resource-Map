import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('password login uses one bounded normalized lookup and never loads all users', async () => {
    const source = await readFile(new URL('../src/controllers/authController.js', import.meta.url), 'utf8');
    const start = source.indexOf('export const login = async (c) => {');
    const end = source.indexOf('export const me = async (c) => {', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const loginSource = source.slice(start, end);

    assert.match(loginSource, /lower\(\$\{users\.email\}\) = \$\{normalizedLoginId\}/);
    assert.match(loginSource, /lower\(\$\{users\.username\}\) = \$\{normalizedLoginId\}/);
    assert.match(loginSource, /\.limit\(1\)/);
    assert.doesNotMatch(loginSource, /allUsers|db\.select\(\)\.from\(users\)/);
});

test('user schema declares unique normalized login indexes', async () => {
    const source = await readFile(new URL('../src/db/schema.js', import.meta.url), 'utf8');
    assert.match(source, /users_username_normalized_unique/);
    assert.match(source, /users_email_normalized_unique/);
    assert.match(source, /lower\(\$\{table\.username\}\)/);
    assert.match(source, /lower\(\$\{table\.email\}\)/);
});
