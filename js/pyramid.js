import { COL } from './config.js';

// Lencioni pyramid : levels are stacked, each one rests on the one below it.
// Index 0 is the foundation (Trust), last index is the apex (Results).
// We repair a team from the bottom up, hence this exact order matters.
const PYRAMID_ORDER = ['Confiance', 'Conflit', 'Engagement', 'Responsabilite', 'Resultats'];

// Descriptor phrase shown above the key word (e.g. "Manque de" / "CONFIANCE").
const LABEL_DESC = {
  Confiance:      'Manque de',
  Conflit:        'Peur de la',
  Engagement:     'Absence',
  Responsabilite: 'Évitement de la',
  Resultats:      'Inattention portée aux',
};

// Key word shown in bold/uppercase on the second line.
const LABEL_KEY = {
  Confiance:      'Confiance',
  Conflit:        'Confrontation',
  Engagement:     "d'Engagement",
  Responsabilite: 'Responsabilisation',
  Resultats:      'Résultats',
};

// English dysfunction names shown as sublabel.
const LABEL_EN = {
  Confiance:      'Absence of Trust',
  Conflit:        'Fear of Conflict',
  Engagement:     'Lack of Commitment',
  Responsabilite: 'Avoidance of Accountability',
  Resultats:      'Inattention to Results',
};

// One-line meaning of each level, used as a caption in the visual / PDF later.
const DESCRIPTION_FR = {
  Confiance:      'Oser être vulnérable, admettre ses erreurs.',
  Conflit:        'Débattre franchement, sans crainte du désaccord.',
  Engagement:     'Adhérer clairement aux décisions prises.',
  Responsabilite: 'Se tenir mutuellement responsables.',
  Resultats:      'Faire passer le collectif avant l\'ego.',
};

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
    return {
      level: index + 1,
      key,
      labelDesc: LABEL_DESC[key],
      labelKey: LABEL_KEY[key],
      labelFull: `${LABEL_DESC[key]} ${LABEL_KEY[key]}`,
      labelEn: LABEL_EN[key],
      description: DESCRIPTION_FR[key],
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
