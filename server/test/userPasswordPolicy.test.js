import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const userControllerSource = readFileSync(
    new URL('../src/controllers/userController.js', import.meta.url),
    'utf8',
);

test('all operator-created passwords use the shared new-password policy', () => {
    assert.match(
        userControllerSource,
        /bcrypt\.hash\(validateNewPassword\(password\), 12\)/,
    );
    assert.match(
        userControllerSource,
        /bcrypt\.hash\(validateNewPassword\(row\.password\), 12\)/,
    );
    assert.doesNotMatch(
        userControllerSource,
        /normalizeText\(row\.password\)\s*\|\|/,
    );
});
