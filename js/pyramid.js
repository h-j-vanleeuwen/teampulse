import { COL } from './config.js';
import { t } from './i18n.js';

// Lencioni pyramid : levels are stacked, each one rests on the one below it.
// Index 0 is the foundation (Trust), last index is the apex (Results).
// We repair a team from the bottom up, hence this exact order matters.
const PYRAMID_ORDER = ['Confiance', 'Conflit', 'Engagement', 'Responsabilite', 'Resultats'];

// Scores live on a 1-5 scale (Never -> Always).
const HEALTHY_THRESHOLD = 3.5;
const FRAGILE_THRESHOLD = 2.5;

const STATUS = {
  HEALTHY: 'healthy',
  FRAGILE: 'fragile',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
};

function getStatus(score) {
  if (score === null || score === undefined) return STATUS.UNKNOWN;
  if (score >= HEALTHY_THRESHOLD) return STATUS.HEALTHY;
  if (score >= FRAGILE_THRESHOLD) return STATUS.FRAGILE;
  return STATUS.CRITICAL;
}

function isWeak(status) {
  return status === STATUS.FRAGILE || status === STATUS.CRITICAL;
}

/**
 * Builds the ordered pyramid data from a calcScores() result.
 * Pure function : data in (scores by category), data out (levels bottom -> top).
 *
 * @param {Object} scores - e.g. { Confiance: 4.2, Conflit: null, ... }, values 1-5 or null
 * @returns {{ levels: Array, priorityKey: (string|null) }}
 *   levels: one entry per stage, ordered foundation -> apex, each carrying
 *           level rank, FR/EN labels, score, color, status, and isPriority flag.
 *   priorityKey: the lowest weak stage (the Lencioni leverage point), or null.
 */
export function buildPyramidData(scores) {
  const levels = PYRAMID_ORDER.map((key, index) => {
    const score = scores[key] ?? null;
    const k = key.toLowerCase();
    const labelDesc = t(`lencioni.${k}.desc`);
    const labelKey  = t(`lencioni.${k}.key`);
    return {
      level: index + 1,
      key,
      labelDesc,
      labelKey,
      labelFull: `${labelDesc} ${labelKey}`,
      score,
      color: COL[key],
      status: getStatus(score),
      isPriority: false,
    };
  });

  // The priority is the lowest weak stage : first weak one walking up from the base.
  const priorityLevel = levels.find(stage => isWeak(stage.status));
  if (priorityLevel) priorityLevel.isPriority = true;

  return {
    levels,
    priorityKey: priorityLevel ? priorityLevel.key : null,
  };
}
