import { z } from 'zod';
import { boundaryHandler, boundaryPositiveId, boundaryRequestId, boundarySourceSchema, BoundaryRequestError } from '../utils/boundaryRequests.js';
import { requiredOneLineTextSchema, optionalOneLineTextSchema } from '../utils/inputValidation.js';
import { createBoundaryZoneJobRepository, FREEZE_LIMITS } from '../utils/boundaryZoneJobRepository.js';
import { createBoundaryPostalScanner } from '../utils/boundaryPostalScanner.js';
const row = z.object({
    rowKey: boundaryRequestId, hardAssetId: boundaryPositiveId, name: requiredOneLineTextSchema('Name', 160),
    zoneCode: optionalOneLineTextSchema(80).transform(x => x || null),
    source: z.union([boundarySourceSchema, z.object({ libraryId: boundaryPositiveId, revision: boundaryPositiveId }).strict()]),
    saveToLibrary: z.boolean(), libraryName: z.string().trim().min(1).max(240).nullish().transform(x => x ?? null),
    libraryGroupName: z.string().trim().max(240).nullish().transform(x => x || null),
}).strict();
const start = z.object({ requestId: boundaryRequestId, rows: z.array(row).min(1) }).strict();
const revision = z.object({ expectedRevision: boundaryPositiveId }).strict();
const commit = revision.extend({ requestId: boundaryRequestId });
const decimal = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(boundaryPositiveId);
const pagination = z.object({ cursor: decimal.optional(), limit: decimal.pipe(z.number().max(100)).optional() }).strict();
const invalid = () => new BoundaryRequestError(400, 'BOUNDARY_INVALID_REQUEST', 'Check the boundary request details.');

async function readBody(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '') || !req.body ||
        !['', 'identity'].includes(req.headers.get('content-encoding') || ''))
        throw invalid();
    const excess = () => new BoundaryRequestError(413, 'BOUNDARY_FREEZE_BUDGET', 'Select fewer boundaries in this preparation.');
    if (Number(req.headers.get('content-length')) > FREEZE_LIMITS.bodyBytes)
        throw excess();
    const bytes = new Uint8Array(FREEZE_LIMITS.bodyBytes), reader = req.body.getReader();
    let used = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            if (value.byteLength > bytes.length - used) {
                await reader.cancel();
                throw excess();
            }
            bytes.set(value, used);
            used += value.length;
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used)));
    }
    catch (e) {
        if (e instanceof BoundaryRequestError)
            throw e;
        throw invalid();
    }
    finally {
        reader.releaseLock();
    }
}
export const boundaryZoneJobHandler = (action, options) => boundaryHandler(async (c, query, actor) => {
    const scanner = createBoundaryPostalScanner(c.env?.HELP_CMS_BUCKET, options);
    const repo = createBoundaryZoneJobRepository(query, scanner);
    if (action === 'list')
        return c.json(await repo.list(actor.id, pagination.parse(c.req.query())));
    const id = action === 'start' ? null : decimal.parse(c.req.param('id'));
    if (action === 'get')
        return c.json(await repo.get(actor.id, id));
    if (action === 'source') {
        return c.json(await repo.frozenSource(actor.id, id, boundaryRequestId.parse(c.req.param('rowKey'))));
    }
    const body = await readBody(c.req.raw);
    let result;
    if (action === 'start') {
        result = await repo.start(actor, start.parse(body));
    }
    else if (action === 'commit') {
        result = await repo.commit(actor, id, commit.parse(body));
    }
    else {
        const { expectedRevision } = revision.parse(body);
        result = action === 'advance'
            ? await repo.advance(actor, id, expectedRevision, c.req.raw.signal)
            : await repo.control(actor, id, action, expectedRevision);
    }
    return c.json(result, action === 'start' ? 202 : 200);
});
