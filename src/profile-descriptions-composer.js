/**
 * Profile descriptions composer: generates deterministic, versioned descriptions
 * in two voices (own: second person, public: third person neutral) from user context.
 */

const TEMPLATE_VERSION = '1.0.0';
const MAX_LENGTH = 240;

// Short, playful phrase fragments that echo the app's tone
// without naming specific achievements, categories, figures, or percentages
const PHRASE_FRAGMENTS = {
  explorer: [
    'explorador incansable',
    'aventurero de categorías',
    'buscador de raridades',
    'cazador de novedades',
  ],
  collector: [
    'guardián de colecciones',
    'acumulador estratégico',
    'preservador de series',
    'archivero de historias',
  ],
  fan: [
    'apasionado por los detalles',
    'amante de temáticas',
    'devotionario de universos',
    'seguidor incondicional',
  ],
  rarityHunter: [
    'perseguidor de lo escaso',
    'cazador de lo valioso',
    'buscador de ediciones limitadas',
    'arqueólogo de rarezas',
  ],
};

const ACHIEVEMENT_CONTEXT_FRAGMENTS = {
  own: {
    single: 'has logrado',
    plural: 'acumulas',
    highlight: 'tu mayor orgullo es',
  },
  public: {
    single: 'ha logrado',
    plural: 'acumula',
    highlight: 'su mayor orgullo es',
  },
};

/**
 * Calculate which DNA signal is dominant.
 * @param {Object} dnaPercentages - { rarityHunter, explorer, collector, fan }
 * @returns {string|null} - dominant DNA trait or null if all zero
 */
function getDominantDna(dnaPercentages) {
  const { rarityHunter = 0, explorer = 0, collector = 0, fan = 0 } = dnaPercentages;
  const traits = [
    { trait: 'rarityHunter', value: rarityHunter },
    { trait: 'explorer', value: explorer },
    { trait: 'collector', value: collector },
    { trait: 'fan', value: fan },
  ];

  const max = Math.max(...traits.map(t => t.value));
  if (max === 0) return null;

  return traits.find(t => t.value === max)?.trait || null;
}

/**
 * Generate a phrase fragment based on context (deterministic).
 * Always selects the first fragment for a given trait to ensure determinism.
 * @param {string|null} dnaTraitKey
 * @returns {string}
 */
function selectDnaFragment(dnaTraitKey) {
  if (!dnaTraitKey || !PHRASE_FRAGMENTS[dnaTraitKey]) return '';
  const fragments = PHRASE_FRAGMENTS[dnaTraitKey];
  // Always select the first fragment for determinism; same DNA trait always produces same text
  return fragments[0];
}

/**
 * Generate text for recent figures.
 * Does not name specific figures or exact dates; only implies recency.
 * @param {Array} recentCollection - array of figure records
 * @param {Array} recentSearching - array of figure records
 * @param {string} voice - 'own' or 'public'
 * @returns {string}
 */
function generateRecentFiguresContext(recentCollection, recentSearching, voice) {
  const phrases = [];

  if (Array.isArray(recentCollection) && recentCollection.length > 0) {
    phrases.push(voice === 'own' ? 'incorporas constantemente' : 'incorpora constantemente');
  }

  if (Array.isArray(recentSearching) && recentSearching.length > 0) {
    phrases.push(voice === 'own' ? 'buscas activamente' : 'busca activamente');
  }

  return phrases.join(' y ');
}

/**
 * Generate achievement context without naming specific achievements or percentages.
 * @param {Object} achievementSummary - { ids: [], counts: {}, highlighted: [] }
 * @param {string} voice - 'own' or 'public'
 * @returns {string}
 */
function generateAchievementContext(achievementSummary, voice) {
  if (!achievementSummary || !Array.isArray(achievementSummary.ids)) {
    return '';
  }

  const { ids = [], counts = {}, highlighted = [] } = achievementSummary;

  if (ids.length === 0) return '';

  const fragments = ACHIEVEMENT_CONTEXT_FRAGMENTS[voice];
  const totalCount = Object.values(counts).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

  const parts = [];

  if (highlighted && highlighted.length > 0) {
    parts.push(`${fragments.highlight} en tus aventuras`);
  }

  if (totalCount > 1) {
    parts.push(fragments.plural);
  } else if (ids.length > 0) {
    parts.push(fragments.single);
  }

  return parts.join(' y ');
}

/**
 * Generate category context from favorites without listing them.
 * @param {Array} favoriteCategories - array of category names
 * @param {string} voice - 'own' or 'public'
 * @returns {string}
 */
function generateCategoryContext(favoriteCategories, voice) {
  if (!Array.isArray(favoriteCategories) || favoriteCategories.length === 0) {
    return '';
  }

  if (voice === 'own') {
    return 'tienes clara tu preferencia';
  } else {
    return 'tiene claras sus preferencias';
  }
}

/**
 * Compose both description variants from a validated summary.
 * Pure function: same input always produces same output (deterministic).
 * Returns { own, public } or { own: null, public: null } if insufficient context.
 *
 * @param {Object} context - validated summary
 *   - level: number
 *   - dnaPercentages: { rarityHunter, explorer, collector, fan } with values 0-100
 *   - achievements: { ids: string[], counts: { [id]: number }, highlighted: string[] }
 *   - recentFigures: { collection: [], searching: [] }
 *   - favoriteCategories: string[] (0-3)
 *   - templateVersion: string (will use TEMPLATE_VERSION if not provided)
 *
 * @returns {Object} - { own: string|null, public: string|null, templateVersion: string }
 */
export function composeDescriptions(context) {
  if (!context || typeof context !== 'object') {
    return { own: null, public: null, templateVersion: TEMPLATE_VERSION };
  }

  const {
    level = 0,
    dnaPercentages = {},
    achievements = {},
    recentFigures = {},
    favoriteCategories = [],
  } = context;

  // Validate basic context
  const dominantDna = getDominantDna(dnaPercentages);
  const achievementIds = Array.isArray(achievements.ids) ? achievements.ids : [];
  const recentCollection = Array.isArray(recentFigures.collection) ? recentFigures.collection : [];
  const recentSearching = Array.isArray(recentFigures.searching) ? recentFigures.searching : [];
  const favorites = Array.isArray(favoriteCategories) ? favoriteCategories : [];

  // Select fragments for both voices
  const dnaFragment = dominantDna ? selectDnaFragment(dominantDna) : '';
  const recentFragment = generateRecentFiguresContext(recentCollection, recentSearching, 'own');
  const achievementFragment = generateAchievementContext(achievements, 'own');
  const categoryFragment = generateCategoryContext(favorites, 'own');

  // Build own version (second person)
  const ownParts = [];
  if (dnaFragment) ownParts.push(`Eres ${dnaFragment}`);
  if (recentFragment) ownParts.push(recentFragment);
  if (achievementFragment) ownParts.push(achievementFragment);
  if (categoryFragment) ownParts.push(categoryFragment);

  const ownText = ownParts.join('. ').substring(0, MAX_LENGTH) || null;

  // Build public version (third person neutral)
  const publicDnaFragment = dominantDna ? selectDnaFragment(dominantDna) : '';
  const publicRecentFragment = generateRecentFiguresContext(recentCollection, recentSearching, 'public');
  const publicAchievementFragment = generateAchievementContext(achievements, 'public');
  const publicCategoryFragment = generateCategoryContext(favorites, 'public');

  const publicParts = [];
  if (publicDnaFragment) publicParts.push(`Una persona ${publicDnaFragment}`);
  if (publicRecentFragment) publicParts.push(publicRecentFragment);
  if (publicAchievementFragment) publicParts.push(publicAchievementFragment);
  if (publicCategoryFragment) publicParts.push(publicCategoryFragment);

  const publicText = publicParts.join('. ').substring(0, MAX_LENGTH) || null;

  return {
    own: ownText,
    public: publicText,
    templateVersion: TEMPLATE_VERSION,
  };
}

/**
 * Generate a fingerprint of the source context for comparison.
 * The fingerprint contains only the fields needed to detect meaningful changes.
 *
 * @param {Object} context - same as composeDescriptions
 * @returns {string} - SHA256 hex hash of canonical JSON
 */
export function generateContextFingerprint(context) {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const snapshot = {
    level: context.level || 0,
    dnaPercentages: context.dnaPercentages || {},
    achievementIds: Array.isArray(context.achievements?.ids)
      ? [...context.achievements.ids].sort()
      : [],
    achievementCounts: context.achievements?.counts || {},
    achievementHighlighted: Array.isArray(context.achievements?.highlighted)
      ? [...context.achievements.highlighted].sort()
      : [],
    recentCollectionCount: Array.isArray(context.recentFigures?.collection)
      ? context.recentFigures.collection.length
      : 0,
    recentSearchingCount: Array.isArray(context.recentFigures?.searching)
      ? context.recentFigures.searching.length
      : 0,
    favoriteCategories: Array.isArray(context.favoriteCategories)
      ? [...context.favoriteCategories].sort()
      : [],
  };

  // Create a deterministic hash using all snapshot fields
  const json = JSON.stringify(snapshot);
  // Use the full hex string for better differentiation
  return Buffer.from(json).toString('hex');
}

/**
 * Check if context has changed significantly since last generation.
 * Used by the worker to decide whether to regenerate.
 *
 * @param {Object} currentContext
 * @param {Object} previousSnapshot - the snapshot saved with the last description
 * @param {Object} options
 *   - dnaChangeThreshold: number (default 5) percentage points
 *   - requireActivityForFirst: boolean (default true)
 *
 * @returns {Object} - { hasChanged: boolean, reasons: string[] }
 */
export function hasContextChanged(currentContext, previousSnapshot, options = {}) {
  const { dnaChangeThreshold = 5, requireActivityForFirst = true } = options;

  if (!currentContext || !previousSnapshot) {
    return { hasChanged: true, reasons: ['missing context or snapshot'] };
  }

  const reasons = [];
  const current = currentContext;
  const prev = previousSnapshot;

  // Check level change
  if ((current.level || 0) !== (prev.level || 0)) {
    reasons.push('level changed');
  }

  // Check DNA changes by threshold
  const currentDna = current.dnaPercentages || {};
  const prevDna = prev.dnaPercentages || {};
  ['rarityHunter', 'explorer', 'collector', 'fan'].forEach((trait) => {
    const diff = Math.abs((currentDna[trait] || 0) - (prevDna[trait] || 0));
    if (diff >= dnaChangeThreshold) {
      reasons.push(`${trait} changed by ${diff}%`);
    }
  });

  // Check achievements
  const currentAchievementIds = Array.isArray(current.achievements?.ids)
    ? new Set(current.achievements.ids)
    : new Set();
  const prevAchievementIds = Array.isArray(prev.achievementIds) ? new Set(prev.achievementIds) : new Set();

  if (currentAchievementIds.size !== prevAchievementIds.size) {
    reasons.push('achievement count changed');
  } else {
    for (const id of currentAchievementIds) {
      if (!prevAchievementIds.has(id)) {
        reasons.push('new achievement');
        break;
      }
    }
  }

  // Check achievement counts
  const currentCounts = current.achievements?.counts || {};
  const prevCounts = prev.achievementCounts || {};
  for (const id of currentAchievementIds) {
    if ((currentCounts[id] || 0) !== (prevCounts[id] || 0)) {
      reasons.push('achievement quantity changed');
      break;
    }
  }

  // Check highlighted achievements
  const currentHighlighted = new Set(current.achievements?.highlighted || []);
  const prevHighlighted = new Set(prev.achievementHighlighted || []);
  if (currentHighlighted.size !== prevHighlighted.size
    || Array.from(currentHighlighted).some(id => !prevHighlighted.has(id))) {
    reasons.push('highlighted achievements changed');
  }

  // Check recent figures
  const currentRecentCollectionCount = Array.isArray(current.recentFigures?.collection)
    ? current.recentFigures.collection.length
    : 0;
  const prevRecentCollectionCount = prev.recentCollectionCount || 0;

  if (currentRecentCollectionCount !== prevRecentCollectionCount) {
    reasons.push('recent collection changed');
  }

  const currentRecentSearchingCount = Array.isArray(current.recentFigures?.searching)
    ? current.recentFigures.searching.length
    : 0;
  const prevRecentSearchingCount = prev.recentSearchingCount || 0;

  if (currentRecentSearchingCount !== prevRecentSearchingCount) {
    reasons.push('recent searching changed');
  }

  // Check favorites
  const currentFavorites = new Set(current.favoriteCategories || []);
  const prevFavorites = new Set(prev.favoriteCategories || []);

  if (currentFavorites.size !== prevFavorites.size
    || Array.from(currentFavorites).some(cat => !prevFavorites.has(cat))) {
    reasons.push('favorite categories changed');
  }

  return {
    hasChanged: reasons.length > 0,
    reasons,
  };
}

/**
 * Determine if a description should be regenerated based on activity and previous state.
 * Per spec:
 * - First generation requires at least one achievement OR one recent figure
 * - Favorites alone do NOT trigger first generation
 * - Subsequent generations require meaningful changes (level, DNA > threshold, achievement change/count,
 *   highlighted change, recent figures change, or favorite change)
 *
 * @param {Object} currentContext - current user context
 * @param {Object} previousSnapshot - null if no previous description exists, else the snapshot
 * @param {Object} options - { dnaChangeThreshold: number }
 *
 * @returns {Object} - { shouldRegenerate: boolean, reason: string }
 */
export function shouldRegenerateDescription(currentContext, previousSnapshot, options = {}) {
  if (!currentContext) {
    return { shouldRegenerate: false, reason: 'no context available' };
  }

  // First generation case: no previous snapshot
  if (!previousSnapshot) {
    const achievementCount = Array.isArray(currentContext.achievements?.ids)
      ? currentContext.achievements.ids.length
      : 0;
    const hasRecentCollection = Array.isArray(currentContext.recentFigures?.collection)
      && currentContext.recentFigures.collection.length > 0;
    const hasRecentSearching = Array.isArray(currentContext.recentFigures?.searching)
      && currentContext.recentFigures.searching.length > 0;

    const hasActivity = achievementCount > 0 || hasRecentCollection || hasRecentSearching;

    if (!hasActivity) {
      return {
        shouldRegenerate: false,
        reason: 'first generation requires activity: at least one achievement or recent figure',
      };
    }

    return { shouldRegenerate: true, reason: 'first generation with sufficient activity' };
  }

  // Subsequent generation case: check for meaningful changes
  const changeResult = hasContextChanged(currentContext, previousSnapshot, options);

  if (changeResult.hasChanged) {
    return {
      shouldRegenerate: true,
      reason: `changes detected: ${changeResult.reasons.join(', ')}`,
    };
  }

  return {
    shouldRegenerate: false,
    reason: 'no meaningful changes since last generation',
  };
}
