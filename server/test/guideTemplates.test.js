import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideTemplateLoader } from '../src/utils/guideTemplates.js';

test('Guide template list reuses the authenticated template controller and returns names only', async () => {
    let calls = 0;
    const load = createGuideTemplateLoader({ list: (c) => {
        calls++;
        assert.equal(c.get('user')?.id, 8);
        return c.json([
            { id: 21, name: '  Shared\nCare Programme  ', description: 'Private draft', partnerId: 90 },
            { id: 22, name: 'Neighbourhood Service', description: 'Internal content' },
        ]);
    } });
    const result = await load({ id: 8, role: 'super_admin' }, {});
    assert.deepEqual(result, { totalCount: 2, names: ['Shared Care Programme', 'Neighbourhood Service'] });
    assert.equal(calls, 1);
    await assert.rejects(load({ id: 9, role: 'standard' }, {}), /access unavailable/);
    await assert.rejects(load({ id: 8, role: 'super_admin', isImpersonating: true }, {}), /access unavailable/);
    assert.equal(calls, 1);
});

test('Guide template list fails closed on malformed controller data', async () => {
    const load = createGuideTemplateLoader({ list: (c) => c.json([{ id: 22, name: 'Okay' }, { id: 0, name: 'Bad' }]) });
    await assert.rejects(load({ id: 8, role: 'super_admin' }, {}), /list unavailable/);
});
