import test from 'node:test';
import assert from 'node:assert/strict';
import { myMapPrintAnnotationDocuments, myMaps } from '../src/db/schema.js';
import { validatePrintAnnotationDocumentInput, replacePrintAnnotationDocument, getPrintAnnotationDocument,
    buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot } from '../src/controllers/printAnnotationsController.js';
import { detachAnnotationResourceFromMap, detachInvalidAnnotationResourceLinks } from '../src/utils/mapAnnotationResources.js';
import { createPrivateMapMediaRepository } from '../src/utils/privateMapMedia.js';
import { MapMediaBucket, png, whereValues } from './helpers/mapAnnotationFixtures.js';

const owner = { id: 7, role: 'standard' };
const shape = (overrides = {}) => ({ id: 'annotation_shape', type: 'rectangle', points: [[1.3, 103.7], [1.31, 103.71]],
    text: 'Planning area', style: { color: '#0F766E', fillColor: '#14B8A6', fillOpacity: 0.14, weight: 3,
        dashed: false, textColor: '#0F172A', fontSize: 14 }, ...overrides });
const body = (annotations, revision = 0) => validatePrintAnnotationDocumentInput({ schemaVersion: 1, annotations, revision });
function database({ document = null, assets = [{ resourceType: 'hard', resourceId: 12 }, { resourceType: 'soft', resourceId: 12 }],
    places = [{ personalPlaceId: 14, personalPlace: { id: 14, userId: 7 } }], conflict = false } = {}) {
    const state = { document, writes: 0, mapWrites: 0, conflict };
    return { state, query: {
        myMaps: { findFirst: async ({ where }) => { assert.deepEqual(whereValues(where), [3, 7]); return { id: 3 }; } },
        myMapPrintAnnotationDocuments: { findFirst: async () => state.document },
        myMapAssets: { findMany: async ({ where }) => { assert.deepEqual(whereValues(where), [3]); return assets; } },
        myMapPersonalPlaceLinks: { findMany: async ({ where }) => { assert.deepEqual(whereValues(where), [3]); return places; } },
    }, insert: () => ({ values: (value) => ({ returning: async () => { state.writes++; state.document = value; return [value]; } }) }),
    update: (table) => ({ set: (value) => ({ where: (where) => {
        if (table === myMaps) { state.mapWrites++; return Promise.resolve(); }
        assert.equal(table, myMapPrintAnnotationDocuments);
        const [mapId, revision] = whereValues(where);
        assert.equal(mapId, 3);
        if (state.conflict || revision !== state.document.revision) return { returning: async () => [] };
        state.writes++; state.document = { ...state.document, ...value };
        return { returning: async () => [state.document] };
    } }) }), };
}

test('compatible schema extension preserves old objects, bounds and unique typed links', () => {
    assert.deepEqual(body([shape()]).annotations, [shape()]);
    const linked = body([shape({ resourceLinks: [{ type: 'hard', id: 12 }, { type: 'soft', id: 12 }], resourceBehaviour: 'pulse' })]);
    assert.equal(linked.annotations[0].resourceLinks.length, 2);
    assert.equal(linked.annotations[0].resourceBehaviour, 'pulse');
    assert.equal(body([shape({ resourceLinks: [{ type: 'hard', id: 12 }] })]).annotations[0].resourceBehaviour, 'highlight');
    const cleared = body([shape({ resourceLinks: [], resourceBehaviour: 'pulse' })]).annotations[0];
    assert.equal(Object.hasOwn(cleared, 'resourceLinks'), false);
    assert.equal(Object.hasOwn(cleared, 'resourceBehaviour'), false);
    for (const links of [[{ type: 'asset', id: 12 }], [{ type: 'hard', id: '12' }], [{ type: 'hard', id: -1 }],
        [{ type: 'hard', id: 12 }, { type: 'hard', id: 12 }], Array.from({ length: 201 }, (_, index) => ({ type: 'hard', id: index + 1 }))]) {
        assert.throws(() => body([shape({ resourceLinks: links })]), /Print annotations is invalid/);
    }
    assert.throws(() => body(Array.from({ length: 11 }, (_, index) => shape({ id: `shape_${index}`,
        resourceLinks: Array.from({ length: 200 }, (_, id) => ({ type: 'hard', id: id + 1 })) }))), /2000 total resources/);
});

test('linked annotations save only current map members and attached owner personal places', async () => {
    const db = database();
    const linked = body([shape({ resourceLinks: [{ type: 'hard', id: 12 }, { type: 'soft', id: 12 }, { type: 'personal_place', id: 14 }] })]);
    const saved = await replacePrintAnnotationDocument(db, owner, 3, linked);
    assert.deepEqual(saved.annotations, linked.annotations);
    assert.equal(saved.revision, 1);
    for (const link of [{ type: 'hard', id: 99 }, { type: 'personal_place', id: 99 }]) {
        await assert.rejects(replacePrintAnnotationDocument(db, owner, 3, body([shape({ resourceLinks: [link] })], 1)), /Linked resources must belong/);
    }
    const foreignPlace = database({ places: [{ personalPlaceId: 14, personalPlace: { id: 14, userId: 8 } }] });
    await assert.rejects(replacePrintAnnotationDocument(foreignPlace, owner, 3, body([shape({ resourceLinks: [{ type: 'personal_place', id: 14 }] })])), /Linked resources must belong/);
    assert.equal(foreignPlace.state.writes, 0);
    await assert.rejects(getPrintAnnotationDocument(db, { ...owner, isImpersonating: true }, 3), { status: 403 });
});

test('optional appearance fields preserve legacy JSON and validate colour and border types strictly', () => {
    const linked = shape({ resourceLinks: [{ type: 'hard', id: 12 }], resourceGlowColor: '#Ab12CD' });
    assert.equal(body([linked]).annotations[0].resourceGlowColor, '#ab12cd');
    assert.deepEqual(body([shape()]).annotations, [shape()]);
    assert.equal(Object.hasOwn(body([shape({ resourceGlowColor: '#123456' })]).annotations[0], 'resourceGlowColor'), false);
    assert.equal(Object.hasOwn(body([{ ...linked, resourceLinks: [] }]).annotations[0], 'resourceGlowColor'), false);
    for (const resourceGlowColor of ['#abc', '#12345678', '#ZZ0000', 'red', ' #123456', 'url(private)', 123456, null]) {
        assert.throws(() => body([{ ...linked, resourceGlowColor }]), /Print annotations is invalid/);
    }
    const image = shape({ type: 'image', image: { assetId: 'a'.repeat(64), width: 1, height: 1, alt: 'Private illustration' } });
    assert.equal(body([{ ...image, imageBorder: true }]).annotations[0].imageBorder, true);
    for (const imageBorder of [false, undefined]) assert.equal(Object.hasOwn(body([{ ...image, imageBorder }]).annotations[0], 'imageBorder'), false);
    for (const imageBorder of ['true', 1, null]) assert.throws(() => body([{ ...image, imageBorder }]), /Print annotations is invalid/);
    for (const imageBorder of [true, false]) assert.throws(() => body([shape({ imageBorder })]), /Image borders are only supported/);
    assert.throws(() => body([{ ...image, image: { ...image.image, showBorder: true } }]), /Print annotations is invalid/);
});

test('owner save and reload retain custom glow and opt-in border without changing media identity or shape style', async () => {
    const bucket = new MapMediaBucket();
    const metadata = await createPrivateMapMediaRepository(bucket, 7).saveAsset(png(), 'image/png');
    const image = { assetId: metadata.assetId, width: 1, height: 1, alt: 'Existing uploaded illustration' };
    const annotation = shape({ type: 'image', image, imageBorder: true,
        resourceLinks: [{ type: 'hard', id: 12 }], resourceGlowColor: '#Ab12CD', resourceBehaviour: 'pulse' });
    const db = database();
    const saved = await replacePrintAnnotationDocument(db, owner, 3, body([annotation]), { mediaBucket: bucket });
    const reloaded = (await getPrintAnnotationDocument(db, owner, 3)).annotations[0];
    assert.equal(reloaded.imageBorder, true);
    assert.equal(reloaded.resourceGlowColor, '#ab12cd');
    assert.deepEqual(reloaded.image, image);
    assert.deepEqual(reloaded.style, annotation.style);
    const changed = await replacePrintAnnotationDocument(db, owner, 3,
        body([{ ...reloaded, imageBorder: false, resourceLinks: [] }], saved.revision), { mediaBucket: bucket });
    assert.equal(Object.hasOwn(changed.annotations[0], 'imageBorder'), false);
    assert.equal(Object.hasOwn(changed.annotations[0], 'resourceGlowColor'), false);
    assert.deepEqual(changed.annotations[0].image, image);
    assert.deepEqual(changed.annotations[0].style, annotation.style);
});

test('partial detach retains private glow while final detach removes it without restyling annotations', async () => {
    const original = shape({ resourceLinks: [{ type: 'hard', id: 12 }, { type: 'soft', id: 12 }], resourceGlowColor: '#123456', resourceBehaviour: 'pulse' });
    const before = structuredClone(original);
    const partial = detachInvalidAnnotationResourceLinks([original], new Set(['soft:12']))[0];
    assert.equal(partial.resourceGlowColor, '#123456');
    assert.deepEqual(partial.resourceLinks, [{ type: 'soft', id: 12 }]);
    assert.deepEqual(original, before);
    assert.deepEqual(detachInvalidAnnotationResourceLinks([partial], new Set()), [shape()]);
    assert.deepEqual(detachInvalidAnnotationResourceLinks([shape({ resourceGlowColor: '#123456' })], new Set()), [shape()]);
    const db = database({ document: { annotations: [original], revision: 2 } });
    await detachAnnotationResourceFromMap(db, 3, 'hard', 12);
    assert.equal(db.state.document.annotations[0].resourceGlowColor, '#123456');
    await detachAnnotationResourceFromMap(db, 3, 'soft', 12);
    assert.deepEqual(db.state.document.annotations, [shape()]);
    assert.equal(db.state.document.revision, 4);
});

test('stale read links detach without deleting shapes, and removal clears the final behaviour', async () => {
    const original = shape({ resourceLinks: [{ type: 'hard', id: 99 }, { type: 'personal_place', id: 14 }], resourceBehaviour: 'appear' });
    const db = database({ document: { annotations: [original], revision: 2 } });
    const read = await getPrintAnnotationDocument(db, owner, 3);
    assert.deepEqual(read.annotations[0].resourceLinks, [{ type: 'personal_place', id: 14 }]);
    assert.equal(read.annotations[0].text, original.text);
    await detachAnnotationResourceFromMap(db, 3, 'personal_place', 14);
    assert.equal(db.state.document.revision, 3);
    assert.equal(db.state.document.annotations.length, 1);
    const after = await getPrintAnnotationDocument(db, owner, 3);
    assert.deepEqual(after.annotations, [shape()]);
    const competing = database({ document: { annotations: [original], revision: 2 }, conflict: true });
    await detachAnnotationResourceFromMap(competing, 3, 'personal_place', 14);
    assert.equal(competing.state.writes, 0);
    await assert.rejects(replacePrintAnnotationDocument(competing, owner, 3, body([shape()], 2)), { status: 409 });
});

test('private image metadata roundtrips only for the owner uploaded bytes and canonical bounds', async () => {
    const bucket = new MapMediaBucket();
    const metadata = await createPrivateMapMediaRepository(bucket, 7).saveAsset(png(), 'image/png');
    const annotation = shape({ type: 'image', text: '', image: { assetId: metadata.assetId, width: 1, height: 1, alt: 'Care map illustration' } });
    const parsed = body([annotation]);
    assert.equal(parsed.annotations[0].isShared, false);
    const db = database();
    const saved = await replacePrintAnnotationDocument(db, owner, 3, parsed, { mediaBucket: bucket });
    assert.deepEqual((await getPrintAnnotationDocument(db, owner, 3)).annotations, saved.annotations);
    for (const bad of [shape({ ...annotation, isShared: true }), shape({ ...annotation, points: [...annotation.points].reverse() }),
        shape({ ...annotation, image: { ...annotation.image, width: 2049 } }), shape({ ...annotation, rotationDegrees: 10 }),
        shape({ image: annotation.image })]) assert.throws(() => body([bad]), /Print annotations is invalid/);
    await assert.rejects(replacePrintAnnotationDocument(database(), owner, 3, body([shape({ ...annotation, image: { ...annotation.image, width: 2 } })]), { mediaBucket: bucket }), /dimensions do not match/);
    await assert.rejects(replacePrintAnnotationDocument(database(), owner, 3, body([shape({ ...annotation, image: { ...annotation.image, assetId: 'a'.repeat(64) } })]), { mediaBucket: bucket }), { status: 404 });
    await assert.rejects(replacePrintAnnotationDocument(database(), owner, 3, parsed), { status: 503 });
    assert.throws(() => body(Array.from({ length: 21 }, (_, index) => ({ ...annotation, id: `image_${index}` }))), /20 image annotations/);
});

test('public and frozen sanitizers strip private bindings and every image but preserve opted-in old geometry', () => {
    const old = shape({ isShared: true });
    const legacyPublic = buildEmbeddedPrintAnnotationSnapshot([old]);
    const linked = { ...old, resourceLinks: [{ type: 'personal_place', id: 987654321 }], resourceBehaviour: 'pulse', resourceGlowColor: '#123456' };
    const privateImage = shape({ id: 'image_private', type: 'image', isShared: true,
        image: { assetId: 'a'.repeat(64), width: 1, height: 1, alt: 'Private photo' } });
    assert.deepEqual(buildEmbeddedPrintAnnotationSnapshot([linked, privateImage]), legacyPublic);
    assert.deepEqual(normalizeEmbeddedPrintAnnotationSnapshot([linked, privateImage]), legacyPublic);
    assert.deepEqual(buildEmbeddedPrintAnnotationSnapshot([{ ...linked, resourceLinks: 'untrusted-private-metadata' }]), legacyPublic);
    assert.deepEqual(buildEmbeddedPrintAnnotationSnapshot([{ ...linked, resourceGlowColor: 'untrusted-private-colour', imageBorder: true }]), legacyPublic);
    assert.deepEqual(normalizeEmbeddedPrintAnnotationSnapshot([{ ...linked, resourceGlowColor: 'untrusted-private-colour', imageBorder: true }]), legacyPublic);
    assert.doesNotMatch(JSON.stringify(legacyPublic), /resourceLinks|resourceBehaviour|assetId|987654321|Private photo/);
    assert.deepEqual(buildEmbeddedPrintAnnotationSnapshot([{ ...linked, isShared: false }, privateImage]), []);
});
