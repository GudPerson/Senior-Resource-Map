import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPrintMapPdfFileName,
    getContainedPrintImageRect,
    getPrintMapPdfOrientation,
} from '../src/lib/printMapPdf.js';

test('print-ready PDF uses the page orientation that gives each image the most space', () => {
    assert.equal(getPrintMapPdfOrientation({ width: 1480, height: 1156 }), 'landscape');
    assert.equal(getPrintMapPdfOrientation({ width: 900, height: 1400 }), 'portrait');
});

test('print-ready PDF centres the captured page inside fixed print margins', () => {
    const rect = getContainedPrintImageRect(
        { width: 5920, height: 4624 },
        { width: 1190.55, height: 841.89 },
        18,
    );
    assert.ok(rect.x >= 18);
    assert.ok(rect.y >= 18);
    assert.ok(rect.x + rect.width <= 1190.55 - 18 + 0.001);
    assert.ok(rect.y + rect.height <= 841.89 - 18 + 0.001);
    assert.ok(Math.abs(((1190.55 - rect.width) / 2) - rect.x) < 0.001);
    assert.ok(Math.abs(((841.89 - rect.height) / 2) - rect.y) < 0.001);
});

test('print-ready PDF filename remains stable and safe', () => {
    assert.equal(buildPrintMapPdfFileName('Chua Chu Kang GRC'), 'chua-chu-kang-grc-print.pdf');
    assert.equal(buildPrintMapPdfFileName('Chua Chu Kang GRC', 'print-master'), 'chua-chu-kang-grc-print-master.pdf');
    assert.equal(buildPrintMapPdfFileName(''), 'carearound-directory-print.pdf');
});
