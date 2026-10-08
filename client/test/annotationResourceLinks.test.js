import test from 'node:test';
import assert from 'node:assert/strict';
import { ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR, ANNOTATION_RESOURCE_LINK_LIMIT, annotationResourceCardState, annotationResourceKey,
    getAnnotationResourceGlowColor,
    getAnnotationResourceLinkBudget, buildAnnotationLinkIndex, buildAnnotationResourceCatalog, buildAnnotationResourceEffects,
    normalizeAnnotationResourceLinks, normalizeAnnotationResourceBehaviour,
    resolveAnnotationResourceActivation, resourceLinksForGroup, resourceLinksForPlaceKey } from '../src/lib/annotationResourceLinks.js';

const hard = { type: 'hard', id: 1 }, soft = { type: 'soft', id: 2 }, personal = { type: 'personal_place', id: 1 };
const place = { placeKey: 'place:1', rows: [{ rowKey: '100:place:1', resourceType: 'hard', resourceId: 1, name: 'Fictional Centre', status: 'available' },
    { rowKey: '101:place:1', resourceType: 'soft', resourceId: 2, name: 'Fictional Programme', status: 'available' }] };
const secondHost = { placeKey: 'place:2', rows: [{ rowKey: '101:place:2', resourceType: 'soft', resourceId: 2, name: 'Fictional Programme', status: 'available' }] };
const privatePlace = { placeKey: 'personal-place-1', rows: [{ resourceType: 'personal_place', resourceId: 1, personalPlaceId: 1, name: 'Fictional Home', status: 'available' }] };
const directory = { id: 7, assets: [{ resourceType: 'hard', resourceId: 1 }, { resourceType: 'soft', resourceId: 2 }],
    personalPlaces: privatePlace.rows, places: [place, secondHost, privatePlace] };

test('active glow colours use persisted annotation order across overlapping resources and host cards', () => {
    const annotations = [
        { id: 'z-first', resourceLinks: [soft, hard], resourceBehaviour: 'pulse', resourceGlowColor: '#12AbCD' },
        { id: 'a-second', resourceLinks: [soft], resourceBehaviour: 'highlight', resourceGlowColor: '#AA00FF' },
    ];
    const before = structuredClone(annotations), index = buildAnnotationLinkIndex(annotations, buildAnnotationResourceCatalog(directory));
    const effects = buildAnnotationResourceEffects({ annotations, index,
        selection: { origin: 'resources', resourceLinks: [hard, soft] }, pulseActive: true });
    assert.deepEqual([...effects.annotationGlowColors], [['z-first', '#12abcd'], ['a-second', '#aa00ff']]);
    assert.deepEqual([...effects.resourceGlowColors], [['soft:2', '#12abcd'], ['hard:1', '#12abcd']]);
    const interaction = { activeResourceKeys: new Set(effects.resourceKeys), resourceGlowColors: effects.resourceGlowColors };
    assert.equal(annotationResourceCardState(place, interaction).glowColor, '#12abcd');
    assert.equal(annotationResourceCardState({ ...place, rows: [...place.rows].reverse() }, interaction).glowColor, '#12abcd');
    assert.equal(annotationResourceCardState(secondHost, interaction).glowColor, '#12abcd');
    assert.equal(annotationResourceCardState(privatePlace, interaction).glowColor, ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR);
    const reverse = buildAnnotationResourceEffects({ annotations, index, selection: { origin: 'annotation', annotationId: 'a-second' } });
    assert.deepEqual([...reverse.resourceGlowColors], [['soft:2', '#aa00ff']]);
    assert.deepEqual(annotations, before);
});

test('glow defaults to actual pin orange and cannot expose hidden, stale or inactive annotation colours', () => {
    assert.equal(ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR, '#f97316');
    assert.equal(getAnnotationResourceGlowColor(), '#f97316');
    assert.equal(getAnnotationResourceGlowColor({ resourceGlowColor: 'url(https://example.invalid)' }), '#f97316');
    const annotations = [
        { id: 'hidden', resourceLinks: [soft], resourceGlowColor: '#123456' },
        { id: 'stale', resourceLinks: [{ type: 'hard', id: 999 }], resourceGlowColor: '#abcdef' },
        { id: 'visible', resourceLinks: [soft], resourceBehaviour: 'pulse' },
    ];
    const index = buildAnnotationLinkIndex(annotations, buildAnnotationResourceCatalog(directory), ['visible', 'stale']);
    const options = { annotations, index, visibleAnnotationIds: ['visible', 'stale'],
        selection: { origin: 'resources', resourceLinks: [soft] }, pulseActive: true, reducedMotion: true };
    const effects = buildAnnotationResourceEffects(options);
    assert.deepEqual([...effects.annotationGlowColors], [['visible', '#f97316']]);
    assert.deepEqual([...effects.resourceGlowColors], [['soft:2', '#f97316']]);
    assert.equal(effects.pulseIds.size, 0);
    const cleared = buildAnnotationResourceEffects({ ...options, enabled: false });
    assert.equal(cleared.annotationGlowColors.size, 0);
    assert.equal(cleared.resourceGlowColors.size, 0);
    assert.equal(annotationResourceCardState(place, { resourceGlowColors: new Map([['soft:2', '#123456']]) }).glowColor, '#f97316');
});

test('annotation references are typed, bounded and deduplicated without coercing invalid identities', () => {
    const input = [hard, soft, personal, { ...hard }, { type: 'asset', id: 1 }, { type: 'hard', id: '1' },
        { type: 'hard', id: -1 }, { type: 'soft', id: 1.5 }, { type: 'hard', id: Number.MAX_SAFE_INTEGER + 1 }, null];
    const before = structuredClone(input);
    assert.deepEqual(normalizeAnnotationResourceLinks(input), [hard, soft, personal]);
    assert.deepEqual(input, before);
    assert.equal(annotationResourceKey(hard), 'hard:1');
    assert.notEqual(annotationResourceKey(hard), annotationResourceKey(personal));
    assert.equal(normalizeAnnotationResourceLinks(Array.from({ length: 250 }, (_, n) => ({ type: 'soft', id: n + 1 }))).length, ANNOTATION_RESOURCE_LINK_LIMIT);
    assert.equal(normalizeAnnotationResourceBehaviour('unknown'), 'highlight');
});

test('catalogue uses actual map members and source IDs across all locations without mutating the directory', () => {
    const value = structuredClone(directory);
    value.places.push({ placeKey: 'external', rows: [{ resourceType: 'hard', resourceId: 999, name: 'Not a member' }] });
    const before = structuredClone(value), catalog = buildAnnotationResourceCatalog(value);
    assert.deepEqual(catalog.map((item) => item.link), [hard, soft, personal]);
    assert.deepEqual(catalog.find((item) => item.key === 'soft:2').placeKeys, ['place:1', 'place:2']);
    assert.equal(catalog.some((item) => item.name === 'Not a member'), false);
    assert.deepEqual(value, before);
    assert.deepEqual(resourceLinksForGroup({ placeKey: 'postal:fictional', rows: [], nestedPlaces: [place, secondHost] }), [hard, soft]);
    assert.deepEqual(resourceLinksForPlaceKey({ displayGroups: [{ placeKey: 'postal:fictional', rows: [], nestedPlaces: [place, secondHost] }] }, 'place:2'), [soft]);
});

test('one programme activates several linked annotations and annotation selection identifies all linked resources', () => {
    const annotations = [{ id: 'a', resourceLinks: [soft, hard], resourceBehaviour: 'pulse' },
        { id: 'b', resourceLinks: [soft, personal], resourceBehaviour: 'highlight' }];
    const index = buildAnnotationLinkIndex(annotations, buildAnnotationResourceCatalog(directory));
    assert.deepEqual(resolveAnnotationResourceActivation(index, { origin: 'resources', resourceLinks: [soft] }),
        { annotationIds: ['a', 'b'], resourceKeys: ['soft:2'] });
    assert.deepEqual(resolveAnnotationResourceActivation(index, { origin: 'annotation', annotationId: 'b' }),
        { annotationIds: ['b'], resourceKeys: ['soft:2', 'personal_place:1'] });
    const interaction = { onActivateResources() {}, taggedResourceKeys: new Set(index.byResource.keys()),
        activeResourceKeys: new Set(['soft:2']), pulsingResourceKeys: new Set() };
    assert.equal(annotationResourceCardState(place, interaction).active, true);
    assert.equal(annotationResourceCardState(secondHost, interaction).active, true);
    assert.equal(annotationResourceCardState(privatePlace, interaction).active, false);
});

test('large grouped cards still activate a tagged member beyond the annotation metadata limit', () => {
    const rows = Array.from({ length: 250 }, (_, index) => ({ resourceType: 'soft', resourceId: index + 1, name: `Fictional programme ${index + 1}` }));
    const value = { id: 7, assets: rows, personalPlaces: [], places: [{ placeKey: 'large-card', rows }] };
    const link = { type: 'soft', id: 250 };
    const index = buildAnnotationLinkIndex([{ id: 'last-member', resourceLinks: [link] }], buildAnnotationResourceCatalog(value));
    assert.deepEqual(resolveAnnotationResourceActivation(index, { origin: 'resources', resourceLinks: resourceLinksForGroup(value.places[0]) }),
        { annotationIds: ['last-member'], resourceKeys: ['soft:250'] });
});

test('removed membership and hidden annotations cannot activate or reveal links', () => {
    const annotations = [{ id: 'visible', resourceLinks: [hard, { type: 'hard', id: 999 }] }, { id: 'hidden', resourceLinks: [soft], resourceBehaviour: 'appear' }];
    const before = structuredClone(annotations);
    const index = buildAnnotationLinkIndex(annotations, buildAnnotationResourceCatalog(directory), ['visible']);
    assert.deepEqual(resolveAnnotationResourceActivation(index, { origin: 'annotation', annotationId: 'hidden' }), { annotationIds: [], resourceKeys: [] });
    assert.deepEqual(resolveAnnotationResourceActivation(index, { origin: 'resources', resourceLinks: [soft, { type: 'hard', id: 999 }] }), { annotationIds: [], resourceKeys: [] });
    const effects = buildAnnotationResourceEffects({ annotations, index, selection: { origin: 'annotation', annotationId: 'hidden' }, visibleAnnotationIds: ['visible'] });
    assert.deepEqual([...effects.visibleIds], ['visible']);
    assert.deepEqual(annotations, before);
});

test('appear is conditional, pulses settle to steady emphasis and reduced motion keeps static emphasis', () => {
    const annotations = [{ id: 'appear', resourceLinks: [soft], resourceBehaviour: 'appear' },
        { id: 'pulse', resourceLinks: [soft], resourceBehaviour: 'pulse' }, { id: 'plain' }];
    const before = structuredClone(annotations), index = buildAnnotationLinkIndex(annotations, buildAnnotationResourceCatalog(directory));
    assert.deepEqual([...buildAnnotationResourceEffects({ annotations, index }).visibleIds], ['pulse', 'plain']);
    const selection = { origin: 'resources', resourceLinks: [soft] };
    const active = buildAnnotationResourceEffects({ annotations, index, selection, pulseActive: true });
    assert.deepEqual([...active.visibleIds], ['appear', 'pulse', 'plain']);
    assert.deepEqual([...active.activeIds], ['appear', 'pulse']);
    assert.deepEqual([...active.pulseIds], ['pulse']);
    for (const options of [{ pulseActive: false }, { pulseActive: true, reducedMotion: true }]) {
        const steady = buildAnnotationResourceEffects({ annotations, index, selection, ...options });
        assert.equal(steady.pulseIds.size, 0); assert.deepEqual([...steady.activeIds], ['appear', 'pulse']);
    }
    assert.deepEqual(annotations, before);
});

test('tag budget keeps large maps within the document limit and frees capacity after removal', () => {
    const links = Array.from({length:200}, (_,i) => ({type:'soft',id:i+1}));
    const others = Array.from({length:9}, (_,i) => ({id:`other-${i}`,resourceLinks:links}));
    const annotations = [...others,{id:'partial',resourceLinks:links.slice(0,195)},{id:'selected',resourceLinks:links.slice(0,2)}];
    const before = structuredClone(annotations);
    assert.equal(getAnnotationResourceLinkBudget(annotations,'selected'),5);
    assert.equal(getAnnotationResourceLinkBudget(annotations.filter(a=>a.id!=='partial'),'selected'),200);
    assert.equal(getAnnotationResourceLinkBudget([...others,{id:'full',resourceLinks:links}],'selected'),0);
    assert.equal(getAnnotationResourceLinkBudget([],'selected'),200);
    assert.deepEqual(annotations,before);
});
