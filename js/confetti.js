// Small brand-flavoured reward: a few CBTW-coloured triangles burst out of the
// rating button when a user picks a score. Wired via event delegation so the
// survey rendering code stays untouched.

const BRAND_COLORS = ['#1E9FD8', '#F4D93B', '#F7A81C', '#EC4F26'];
const PIECE_COUNT = 7;
const PIECE_LIFETIME_MS = 650;
const MIN_DISTANCE_PX = 26;
const MAX_DISTANCE_PX = 64;
const MAX_ROTATION_DEG = 220;
const HALF_TURN_DEG = 180;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function spawnPiece(originX, originY, index) {
  const piece = document.createElement('span');
  piece.className = 'confetti-tri';

  // Spread pieces over a half-circle pointing upwards from the click point.
  const angle = (Math.PI / (PIECE_COUNT - 1)) * index - Math.PI / 2;
  const distance = randomBetween(MIN_DISTANCE_PX, MAX_DISTANCE_PX);
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - distance * 0.4;
  const rotation = randomBetween(-MAX_ROTATION_DEG, MAX_ROTATION_DEG) + HALF_TURN_DEG;

  piece.style.left = `${originX}px`;
  piece.style.top = `${originY}px`;
  piece.style.setProperty('--c', BRAND_COLORS[index % BRAND_COLORS.length]);
  piece.style.setProperty('--dx', `${dx.toFixed(1)}px`);
  piece.style.setProperty('--dy', `${dy.toFixed(1)}px`);
  piece.style.setProperty('--rot', `${rotation.toFixed(0)}deg`);

  document.body.appendChild(piece);
  window.setTimeout(() => piece.remove(), PIECE_LIFETIME_MS);
}

function burstConfetti(originX, originY) {
  for (let i = 0; i < PIECE_COUNT; i++) {
    spawnPiece(originX, originY, i);
  }
}

function resolveOrigin(event, button) {
  // Keyboard activation reports (0, 0); fall back to the button centre.
  if (event.clientX === 0 && event.clientY === 0) {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: event.clientX, y: event.clientY };
}

export function initConfetti() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.scale-btn');
    if (!button) return;
    const origin = resolveOrigin(event, button);
    burstConfetti(origin.x, origin.y);
  });
}
