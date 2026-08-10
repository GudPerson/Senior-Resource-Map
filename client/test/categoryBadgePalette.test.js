import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCategoryBadgePalette,
    getColorContrastRatio,
    normalizeCategoryAccentColor,
} from '../src/lib/categoryBadgePalette.js';

test('category badge palette preserves the exact saved colour for pin-aligned outlines', () => {
    assert.equal(normalizeCategoryAccentColor('#abc'), '#AABBCC');
    assert.equal(normalizeCategoryAccentColor('#64748b'), '#64748B');
    assert.equal(normalizeCategoryAccentColor('not-a-colour'), '');

    const palette = buildCategoryBadgePalette('#64748b');
    assert.equal(palette.accentColor, '#64748B');
});

test('category badge palette keeps every label readable on its tinted background', () => {
    ['#D1D5DB', '#FDE68A', '#F8FAFC', '#64748B', '#0F766E'].forEach((color) => {
        const palette = buildCategoryBadgePalette(color);
        assert.ok(
            getColorContrastRatio(palette.textColor, palette.backgroundColor) >= 4.5,
            `${color} should produce WCAG AA label contrast`,
        );
    });
});

test('light category colours use a darker derived label tone without changing the saved accent', () => {
    const palette = buildCategoryBadgePalette('#D1D5DB');

    assert.equal(palette.accentColor, '#D1D5DB');
    assert.notEqual(palette.textColor, palette.accentColor);
    assert.ok(getColorContrastRatio(palette.textColor, palette.backgroundColor) >= 4.5);
});
