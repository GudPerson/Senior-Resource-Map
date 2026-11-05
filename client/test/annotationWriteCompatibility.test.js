import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PRINT_ANNOTATION_CLIENT_CAPABILITIES as capabilities, acknowledgesAnnotationFeatures,
    requiresCurrentAnnotationWrites, supportsCurrentAnnotationWrites,
} from '../../shared/annotationWriteCompatibility.js';
import {
    annotationDraftNeedsQuarantine, clearAnnotationLocalDraft, quarantineAnnotationLocalDraft,
    readAnnotationLocalDraft, writeAnnotationLocalDraft,
} from '../src/lib/annotationDraftStorage.js';
import { createPrintAnnotation } from '../src/lib/printAnnotations.js';

const circle = index => ({ ...createPrintAnnotation({ type: 'circle', points: [[1.3, 103.7], [1.31, 103.71]] }), id: `circle-${index}` });
const legacy = Array.from({ length: 100 }, (_, index) => circle(index));
const expanded = [...legacy, circle(100)];
const grouped = [{ ...circle(0), groupName: 'Owner group' }];
class MemoryStorage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
}
const key = 'carearound:print-annotations:7:3';
const raw = JSON.stringify({ schemaVersion: 1, baseRevision: 3, annotations: legacy, unknownLegacyValue: 'keep exact\nbytes' }, null, 2);

test('new write features require both count200 and group support; unchanged legacy drawings do not', () => {
    assert.equal(requiresCurrentAnnotationWrites(legacy), false);
    assert.equal(requiresCurrentAnnotationWrites(expanded), true);
    assert.equal(requiresCurrentAnnotationWrites(grouped), true);
    assert.equal(requiresCurrentAnnotationWrites([{ ...circle(0), groupName: '  ' }]), false);
    for (const candidate of [undefined, {}, { maxCount: 100, groups: true }, { maxCount: 200 }, { maxCount: 200, groups: false }]) {
        assert.equal(supportsCurrentAnnotationWrites(candidate), false);
    }
    assert.equal(supportsCurrentAnnotationWrites(capabilities), true);
});

test('new-feature acknowledgements reject count clipping, reordered ids and stripped group metadata', () => {
    assert.equal(acknowledgesAnnotationFeatures(expanded, expanded), true);
    assert.equal(acknowledgesAnnotationFeatures(expanded, legacy), false);
    assert.equal(acknowledgesAnnotationFeatures(expanded, [...expanded].reverse()), false);
    assert.equal(acknowledgesAnnotationFeatures(grouped, [circle(0)]), false);
    assert.equal(acknowledgesAnnotationFeatures(grouped, [{ ...grouped[0], groupName: ' Owner   group ' }]), true);
    assert.equal(acknowledgesAnnotationFeatures(legacy, undefined), true, 'legacy acknowledgement flow stays unchanged');
});

test('legacy local drafts remain restorable for legacy maps while newer stored features require quarantine', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, raw);
    const draft = readAnnotationLocalDraft(storage, key);
    assert.equal(draft.raw, raw);
    assert.equal(draft.baseRevision, 3);
    assert.deepEqual(draft.annotations, legacy);
    assert.equal(annotationDraftNeedsQuarantine(draft, legacy), false);
    assert.equal(annotationDraftNeedsQuarantine(draft, expanded), true);
    assert.equal(annotationDraftNeedsQuarantine(draft, grouped), true);
    assert.equal(writeAnnotationLocalDraft(storage, key, 4, grouped), true);
    const currentDraft = readAnnotationLocalDraft(storage, key);
    assert.deepEqual(currentDraft.clientCapabilities, capabilities);
    assert.equal(annotationDraftNeedsQuarantine(currentDraft, expanded), false);
    assert.equal(JSON.parse(storage.getItem(key)).schemaVersion, 1);
});

test('quarantine verifies an exact local copy and ordinary future writes/cleanup never remove the backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, raw);
    const retained = quarantineAnnotationLocalDraft(storage, key, raw);
    assert.deepEqual(retained, { preserved: true, backupKey: `${key}:preserved-legacy-draft`, protectPrimary: false });
    assert.equal(storage.getItem(retained.backupKey), raw);
    assert.equal(storage.getItem(key), raw, 'loading and quarantine are copy-only');
    writeAnnotationLocalDraft(storage, key, 4, expanded);
    clearAnnotationLocalDraft(storage, key);
    assert.equal(storage.getItem(retained.backupKey), raw);
});

test('existing different backups are preserved and an identical copy can be reused safely', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, raw);
    storage.setItem(`${key}:preserved-legacy-draft`, 'another owner draft');
    const retained = quarantineAnnotationLocalDraft(storage, key, raw);
    assert.equal(retained.backupKey, `${key}:preserved-legacy-draft:1`);
    assert.equal(storage.getItem(`${key}:preserved-legacy-draft`), 'another owner draft');
    storage.setItem(key, raw);
    assert.deepEqual(quarantineAnnotationLocalDraft(storage, key, raw), retained);
});

test('quota failure preserves the original through later failed drafts and successful-save cleanup', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, raw);
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    const retained = quarantineAnnotationLocalDraft(storage, key, raw);
    assert.equal(retained.preserved, false);
    assert.equal(retained.protectPrimary, true);
    const protectedKeys = new Set([key]);
    assert.equal(writeAnnotationLocalDraft(storage, key, 4, expanded, protectedKeys), false);
    assert.equal(clearAnnotationLocalDraft(storage, key, protectedKeys), false);
    assert.equal(storage.getItem(key), raw);
});

test('failed backup readback and changed primary do not permit destructive cleanup', () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(key, raw);
    const set = corrupt.setItem.bind(corrupt);
    corrupt.setItem = (name, value) => set(name, `${value} changed`);
    assert.equal(quarantineAnnotationLocalDraft(corrupt, key, raw).protectPrimary, true);
    assert.equal(corrupt.getItem(key), raw);
    const changed = new MemoryStorage();
    changed.setItem(key, 'newer draft from another tab');
    const retained = quarantineAnnotationLocalDraft(changed, key, raw);
    assert.equal(retained.preserved, true);
    assert.equal(retained.protectPrimary, true);
    assert.equal(changed.getItem(key), 'newer draft from another tab');
});

test('exhausted backup slots preserve every previous value and protect the original', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, raw);
    for (let index = 0; index < 10; index += 1) storage.setItem(`${key}:preserved-legacy-draft${index ? `:${index}` : ''}`, `kept ${index}`);
    const before = new Map(storage.values);
    assert.equal(quarantineAnnotationLocalDraft(storage, key, raw).protectPrimary, true);
    assert.deepEqual(storage.values, before);
});
