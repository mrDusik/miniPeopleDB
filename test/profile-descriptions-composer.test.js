import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeDescriptions,
  generateContextFingerprint,
  hasContextChanged,
  shouldRegenerateDescription,
} from '../src/profile-descriptions-composer.js';

test('Profile Descriptions Composer', async (t) => {
  await t.test('composeDescriptions: empty context', () => {
    const result = composeDescriptions({});
    assert.strictEqual(result.own, null);
    assert.strictEqual(result.public, null);
    assert.strictEqual(result.templateVersion, '1.0.0');
  });

  await t.test('composeDescriptions: null input', () => {
    const result = composeDescriptions(null);
    assert.strictEqual(result.own, null);
    assert.strictEqual(result.public, null);
  });

  await t.test('composeDescriptions: with DNA and achievements', () => {
    const context = {
      level: 15,
      dnaPercentages: {
        rarityHunter: 35,
        explorer: 20,
        collector: 25,
        fan: 20,
      },
      achievements: {
        ids: ['first-minifig', 'collector-10'],
        counts: { 'first-minifig': 1, 'collector-10': 2 },
        highlighted: ['first-minifig'],
      },
      recentFigures: {
        collection: [{ id: 'fig1' }],
        searching: [{ id: 'fig2' }],
      },
      favoriteCategories: ['Series', 'Architecture'],
    };

    const result = composeDescriptions(context);

    assert(typeof result.own === 'string' || result.own === null);
    assert(typeof result.public === 'string' || result.public === null);
    if (result.own) {
      assert(result.own.length <= 240);
    }
    if (result.public) {
      assert(result.public.length <= 240);
    }
  });

  await t.test('composeDescriptions: second person for own', () => {
    const context = {
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievements: { ids: ['achievement-1'], counts: {}, highlighted: [] },
      recentFigures: { collection: [{ id: 'fig1' }], searching: [] },
    };

    const result = composeDescriptions(context);

    if (result.own) {
      // Should not contain "Una persona" (third person) in own
      assert(!result.own.includes('Una persona'));
    }
  });

  await t.test('composeDescriptions: third person for public', () => {
    const context = {
      dnaPercentages: { collector: 50, explorer: 30, fan: 15, rarityHunter: 5 },
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
    };

    const result = composeDescriptions(context);

    if (result.public) {
      // Should contain "Una persona" (third person)
      assert(result.public.includes('Una persona'));
    }
  });

  await t.test('composeDescriptions: null for no meaningful context', () => {
    const context = {
      level: 1,
      dnaPercentages: { explorer: 0, collector: 0, fan: 0, rarityHunter: 0 },
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
      favoriteCategories: [],
    };

    const result = composeDescriptions(context);

    assert.strictEqual(result.own, null);
    assert.strictEqual(result.public, null);
  });

  await t.test('composeDescriptions: no achievement names in output', () => {
    const context = {
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievements: {
        ids: ['legendary-collector', 'achievement-name-with-details'],
        counts: { 'legendary-collector': 5 },
        highlighted: ['legendary-collector'],
      },
      recentFigures: {
        collection: [{ id: 'fig1', name: 'Darth Vader' }],
        searching: [{ id: 'fig2', name: 'Luke Skywalker' }],
      },
    };

    const result = composeDescriptions(context);

    if (result.own) {
      assert(!result.own.includes('legendary-collector'));
      assert(!result.own.includes('Darth Vader'));
      assert(!result.own.includes('Luke Skywalker'));
      assert(!result.own.includes('achievement-name'));
    }

    if (result.public) {
      assert(!result.public.includes('legendary-collector'));
      assert(!result.public.includes('Darth Vader'));
      assert(!result.public.includes('Luke Skywalker'));
    }
  });

  await t.test('composeDescriptions: no category names directly', () => {
    const context = {
      favoriteCategories: ['DC Universe', 'Star Wars', 'Marvel'],
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
    };

    const result = composeDescriptions(context);

    if (result.own) {
      assert(!result.own.includes('DC Universe'));
      assert(!result.own.includes('Star Wars'));
      assert(!result.own.includes('Marvel'));
    }
  });

  await t.test('composeDescriptions: no DNA percentages in output', () => {
    const context = {
      dnaPercentages: {
        explorer: 35,
        collector: 28,
        fan: 22,
        rarityHunter: 15,
      },
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
    };

    const result = composeDescriptions(context);

    if (result.own) {
      assert(!result.own.includes('35'));
      assert(!result.own.includes('28'));
      assert(!result.own.includes('15'));
      assert(!result.own.includes('%'));
    }
  });

  await t.test('composeDescriptions: respects 240 character limit', () => {
    const context = {
      level: 50,
      dnaPercentages: {
        explorer: 100,
        collector: 100,
        fan: 100,
        rarityHunter: 100,
      },
      achievements: {
        ids: Array.from({ length: 20 }, (_, i) => `achievement-${i}`),
        counts: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`achievement-${i}`, 5]),
        ),
        highlighted: Array.from({ length: 5 }, (_, i) => `achievement-${i}`),
      },
      recentFigures: {
        collection: Array.from({ length: 5 }, (_, i) => ({ id: `fig-col-${i}` })),
        searching: Array.from({ length: 5 }, (_, i) => ({ id: `fig-search-${i}` })),
      },
      favoriteCategories: ['Series 1', 'Series 2', 'Series 3'],
    };

    const result = composeDescriptions(context);

    assert(result.own === null || result.own.length <= 240);
    assert(result.public === null || result.public.length <= 240);
  });

  await t.test('composeDescriptions: deterministic', () => {
    const context = {
      level: 20,
      dnaPercentages: {
        explorer: 40,
        collector: 30,
        fan: 20,
        rarityHunter: 10,
      },
      achievements: {
        ids: ['achievement-1', 'achievement-2'],
        counts: { 'achievement-1': 1, 'achievement-2': 3 },
        highlighted: ['achievement-1'],
      },
      recentFigures: {
        collection: [{ id: 'fig1' }, { id: 'fig2' }],
        searching: [{ id: 'fig3' }],
      },
      favoriteCategories: ['Series'],
    };

    const result1 = composeDescriptions(context);
    const result2 = composeDescriptions(context);

    assert.strictEqual(result1.own, result2.own);
    assert.strictEqual(result1.public, result2.public);
  });

  await t.test('generateContextFingerprint: null input', () => {
    assert.strictEqual(generateContextFingerprint(null), null);
  });

  await t.test('generateContextFingerprint: returns hex string', () => {
    const context = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievements: { ids: ['ach-1'], counts: {}, highlighted: [] },
    };

    const fp = generateContextFingerprint(context);

    assert(typeof fp === 'string');
    assert(/^[a-f0-9]+$/.test(fp));
    assert(fp.length > 0);
  });

  await t.test('generateContextFingerprint: same fingerprint for identical context', () => {
    const context = {
      level: 15,
      dnaPercentages: { rarityHunter: 30, explorer: 25, collector: 25, fan: 20 },
      achievements: {
        ids: ['ach-1', 'ach-2'],
        counts: { 'ach-1': 1, 'ach-2': 3 },
        highlighted: ['ach-1'],
      },
      recentFigures: {
        collection: [{ id: 'fig1' }],
        searching: [],
      },
      favoriteCategories: ['Cat1', 'Cat2'],
    };

    const fp1 = generateContextFingerprint(context);
    const fp2 = generateContextFingerprint(context);

    assert.strictEqual(fp1, fp2);
  });

  await t.test('generateContextFingerprint: different fingerprint for different context', () => {
    const context1 = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
    };

    const context2 = {
      level: 20,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
    };

    const fp1 = generateContextFingerprint(context1);
    const fp2 = generateContextFingerprint(context2);

    assert.notStrictEqual(fp1, fp2);
  });

  await t.test('generateContextFingerprint: normalizes order', () => {
    const context1 = {
      achievements: {
        ids: ['ach-a', 'ach-b', 'ach-c'],
        counts: { 'ach-a': 1 },
        highlighted: [],
      },
      favoriteCategories: ['Cat1', 'Cat2'],
    };

    const context2 = {
      achievements: {
        ids: ['ach-c', 'ach-a', 'ach-b'],
        counts: { 'ach-a': 1 },
        highlighted: [],
      },
      favoriteCategories: ['Cat2', 'Cat1'],
    };

    const fp1 = generateContextFingerprint(context1);
    const fp2 = generateContextFingerprint(context2);

    assert.strictEqual(fp1, fp2);
  });

  await t.test('hasContextChanged: null previous snapshot', () => {
    const current = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
    };

    const result = hasContextChanged(current, null);

    assert.strictEqual(result.hasChanged, true);
  });

  await t.test('hasContextChanged: detects level change', () => {
    const current = { level: 15, dnaPercentages: {} };
    const previous = { level: 14, dnaPercentages: {} };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('level')));
  });

  await t.test('hasContextChanged: detects DNA change exceeding threshold', () => {
    const current = {
      level: 10,
      dnaPercentages: { explorer: 55, collector: 30, fan: 10, rarityHunter: 5 },
    };
    const previous = {
      level: 10,
      dnaPercentages: { explorer: 40, collector: 30, fan: 10, rarityHunter: 20 },
    };

    const result = hasContextChanged(current, previous, { dnaChangeThreshold: 5 });

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('explorer')));
  });

  await t.test('hasContextChanged: ignores small DNA changes below threshold', () => {
    const current = {
      level: 10,
      dnaPercentages: { explorer: 42, collector: 30, fan: 10, rarityHunter: 18 },
    };
    const previous = {
      level: 10,
      dnaPercentages: { explorer: 40, collector: 30, fan: 10, rarityHunter: 20 },
    };

    const result = hasContextChanged(current, previous, { dnaChangeThreshold: 5 });

    assert(!result.reasons.some(r => r.includes('explorer')));
  });

  await t.test('hasContextChanged: detects new achievement', () => {
    const current = {
      achievements: { ids: ['ach-1', 'ach-2'], counts: {}, highlighted: [] },
    };
    const previous = {
      achievementIds: ['ach-1'],
      achievementCounts: {},
      achievementHighlighted: [],
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('achievement')));
  });

  await t.test('hasContextChanged: detects achievement quantity change', () => {
    const current = {
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 5 }, highlighted: [] },
    };
    const previous = {
      achievementIds: ['ach-1'],
      achievementCounts: { 'ach-1': 3 },
      achievementHighlighted: [],
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('quantity')));
  });

  await t.test('hasContextChanged: detects highlighted achievement change', () => {
    const current = {
      achievements: { ids: ['ach-1', 'ach-2'], counts: {}, highlighted: ['ach-2'] },
    };
    const previous = {
      achievementIds: ['ach-1', 'ach-2'],
      achievementCounts: {},
      achievementHighlighted: ['ach-1'],
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('highlighted')));
  });

  await t.test('hasContextChanged: detects recent collection changes', () => {
    const current = {
      recentFigures: { collection: [{ id: 'fig1' }, { id: 'fig2' }], searching: [] },
    };
    const previous = {
      recentCollectionCount: 1,
      recentSearchingCount: 0,
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('recent collection')));
  });

  await t.test('hasContextChanged: detects favorite category changes', () => {
    const current = {
      favoriteCategories: ['Cat1', 'Cat2', 'Cat3'],
    };
    const previous = {
      favoriteCategories: ['Cat1', 'Cat2'],
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, true);
    assert(result.reasons.some(r => r.includes('favorite')));
  });

  await t.test('hasContextChanged: no changes for identical context', () => {
    const current = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 1 }, highlighted: [] },
      recentFigures: { collection: [{ id: 'fig1' }], searching: [] },
      favoriteCategories: ['Cat1'],
    };
    const previous = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievementIds: ['ach-1'],
      achievementCounts: { 'ach-1': 1 },
      achievementHighlighted: [],
      recentCollectionCount: 1,
      recentSearchingCount: 0,
      favoriteCategories: ['Cat1'],
    };

    const result = hasContextChanged(current, previous);

    assert.strictEqual(result.hasChanged, false);
    assert.strictEqual(result.reasons.length, 0);
  });

  await t.test('hasContextChanged: respects custom dnaChangeThreshold', () => {
    const current = {
      dnaPercentages: { explorer: 57, collector: 30, fan: 10, rarityHunter: 3 },
    };
    const previous = {
      dnaPercentages: { explorer: 50, collector: 30, fan: 10, rarityHunter: 10 },
    };

    const result1 = hasContextChanged(current, previous, { dnaChangeThreshold: 5 });
    const result2 = hasContextChanged(current, previous, { dnaChangeThreshold: 10 });

    assert(result1.hasChanged);
    assert(!result2.hasChanged);
  });

  await t.test('shouldRegenerateDescription: first generation without activity', () => {
    const context = {
      level: 1,
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
      favoriteCategories: ['Cat1', 'Cat2'],
    };

    const result = shouldRegenerateDescription(context, null);

    assert.strictEqual(result.shouldRegenerate, false);
    assert(result.reason.includes('first generation'));
    assert(result.reason.includes('requires activity'));
  });

  await t.test('shouldRegenerateDescription: first generation with one achievement', () => {
    const context = {
      level: 1,
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 1 }, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
      favoriteCategories: [],
    };

    const result = shouldRegenerateDescription(context, null);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('first generation'));
  });

  await t.test('shouldRegenerateDescription: first generation with recent collection', () => {
    const context = {
      level: 1,
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [{ id: 'fig1' }], searching: [] },
      favoriteCategories: [],
    };

    const result = shouldRegenerateDescription(context, null);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('first generation'));
  });

  await t.test('shouldRegenerateDescription: first generation with recent searching', () => {
    const context = {
      level: 1,
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [{ id: 'fig1' }] },
      favoriteCategories: [],
    };

    const result = shouldRegenerateDescription(context, null);

    assert.strictEqual(result.shouldRegenerate, true);
  });

  await t.test('shouldRegenerateDescription: favorites alone do NOT trigger first generation', () => {
    const context = {
      level: 1,
      achievements: { ids: [], counts: {}, highlighted: [] },
      recentFigures: { collection: [], searching: [] },
      favoriteCategories: ['Cat1', 'Cat2', 'Cat3'],
    };

    const result = shouldRegenerateDescription(context, null);

    assert.strictEqual(result.shouldRegenerate, false);
    assert(result.reason.includes('first generation'));
  });

  await t.test('shouldRegenerateDescription: level change triggers regeneration', () => {
    const current = { level: 15, achievements: { ids: [], counts: {}, highlighted: [] } };
    const previous = { level: 14, achievementIds: [], achievementCounts: {}, achievementHighlighted: [] };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: achievement addition triggers regeneration', () => {
    const current = {
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 1 }, highlighted: [] },
    };
    const previous = {
      achievementIds: [],
      achievementCounts: {},
      achievementHighlighted: [],
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: achievement count increase triggers regeneration', () => {
    const current = {
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 5 }, highlighted: [] },
    };
    const previous = {
      achievementIds: ['ach-1'],
      achievementCounts: { 'ach-1': 3 },
      achievementHighlighted: [],
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: DNA threshold change triggers regeneration', () => {
    const current = {
      dnaPercentages: { explorer: 55, collector: 30, fan: 10, rarityHunter: 5 },
    };
    const previous = {
      dnaPercentages: { explorer: 40, collector: 30, fan: 10, rarityHunter: 20 },
    };

    const result = shouldRegenerateDescription(current, previous, { dnaChangeThreshold: 5 });

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: no changes means no regeneration', () => {
    const current = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievements: { ids: ['ach-1'], counts: { 'ach-1': 1 }, highlighted: [] },
      recentFigures: { collection: [{ id: 'fig1' }], searching: [] },
      favoriteCategories: ['Cat1'],
    };
    const previous = {
      level: 10,
      dnaPercentages: { explorer: 50, collector: 25, fan: 15, rarityHunter: 10 },
      achievementIds: ['ach-1'],
      achievementCounts: { 'ach-1': 1 },
      achievementHighlighted: [],
      recentCollectionCount: 1,
      recentSearchingCount: 0,
      favoriteCategories: ['Cat1'],
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, false);
    assert(result.reason.includes('no meaningful changes'));
  });

  await t.test('shouldRegenerateDescription: recent collection change triggers regeneration', () => {
    const current = {
      recentFigures: { collection: [{ id: 'fig1' }, { id: 'fig2' }], searching: [] },
    };
    const previous = {
      recentCollectionCount: 1,
      recentSearchingCount: 0,
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: favorite change triggers regeneration', () => {
    const current = {
      favoriteCategories: ['Cat1', 'Cat2', 'Cat3'],
    };
    const previous = {
      favoriteCategories: ['Cat1', 'Cat2'],
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
    assert(result.reason.includes('changes detected'));
  });

  await t.test('shouldRegenerateDescription: highlighted achievement change triggers regeneration', () => {
    const current = {
      achievements: { ids: ['ach-1', 'ach-2'], counts: {}, highlighted: ['ach-2'] },
    };
    const previous = {
      achievementIds: ['ach-1', 'ach-2'],
      achievementCounts: {},
      achievementHighlighted: ['ach-1'],
    };

    const result = shouldRegenerateDescription(current, previous);

    assert.strictEqual(result.shouldRegenerate, true);
  });

  await t.test('shouldRegenerateDescription: respects DNA threshold option', () => {
    const current = {
      dnaPercentages: { explorer: 56, collector: 30, fan: 10, rarityHunter: 4 },
    };
    const previous = {
      dnaPercentages: { explorer: 50, collector: 30, fan: 10, rarityHunter: 10 },
    };

    // With threshold 5: 6% change is detected
    const result1 = shouldRegenerateDescription(current, previous, { dnaChangeThreshold: 5 });
    assert.strictEqual(result1.shouldRegenerate, true);

    // With threshold 10: 6% change is NOT detected
    const result2 = shouldRegenerateDescription(current, previous, { dnaChangeThreshold: 10 });
    assert.strictEqual(result2.shouldRegenerate, false);
  });
});
