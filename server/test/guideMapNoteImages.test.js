import test from 'node:test';
import assert from 'node:assert/strict';
import { answerGuideAnnotationFeatures, guideAnnotationFeatureFact, guideAnnotationFeatureIntent, guideAnnotationGroundingFacts } from '../src/utils/guideAnnotationFeatures.js';

test('Map Notes search and preview shortcuts have reviewed localized instructions without exposing other owners', () => {
    const answer = answerGuideAnnotationFeatures({ question: 'How do I find recent pins or search my Care Map notes?', actor: { id: 7, role: 'standard' } });
    assert.equal(answer.topicId, 'map-notes-resource-navigation');
    assert.match(answer.message, /last five pins/);
    assert.match(answer.message, /resource preview card/);
    assert.match(answer.message, /personal-place notes and images stay private/);
    assert.equal(guideAnnotationFeatureIntent('Search someone elses Care Map notes'), null);
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        const fact = guideAnnotationFeatureFact('noteNavigation', locale);
        assert.ok(fact.title); assert.ok(fact.message.length > 100);
        assert.equal(fact.reviewed, '2026-10-14');
    }
});

test('Map Notes image procedures are distinct from private spatial image annotations', () => {
    const answer = answerGuideAnnotationFeatures({ question: 'How can I add, download and share images in my Care Map notes?', actor: { id: 7, role: 'standard' } });
    assert.equal(answer.topicId, 'map-note-image-attachments'); assert.equal(answer.sources.length, 1);
    assert.match(answer.message, /Share this image/); assert.match(answer.message, /publish or update/);
    assert.match(answer.message, /Personal-place images stay private/); assert.match(answer.message, /website embeds do not include/);
    assert.equal(guideAnnotationFeatureIntent('Add an image on my Care Map'), 'image');
    assert.equal(guideAnnotationFeatureIntent('Show my colleagues Care Map note images'), null);
    assert.equal(guideAnnotationGroundingFacts([], { question: 'How do I share my Care Map note images?' })[0].id, 'map-note-image-attachments');
});
test('touch editing instructions cover tools, options and north-up without renewing any actor permissions', () => {
    const answer = answerGuideAnnotationFeatures({ question: 'How can I annotate my Care Map on a mobile phone?', actor: { role: 'guest' } });
    assert.equal(answer.topicId, 'map-annotation-mobile-editing'); assert.equal(answer.actions[0].route, '/login');
    assert.match(answer.message, /Annotation options/); assert.match(answer.message, /north-up/);
    assert.match(answer.message, /phone, tablet or desktop/);
});
test('new Guide facts and existing image/boundary instructions match the four-language mobile capability', () => {
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        for (const kind of ['noteImages', 'editing', 'image', 'boundaries']) {
            const fact = guideAnnotationFeatureFact(kind, locale);
            assert.ok(fact.title); assert.ok(fact.message.length > 100); assert.ok(fact.evidence);
        }
    }
    assert.doesNotMatch(guideAnnotationFeatureFact('image', 'en').message, /desktop with a fine pointer/);
    assert.doesNotMatch(guideAnnotationFeatureFact('boundaries', 'en').message, /desktop with a fine pointer/);
});
