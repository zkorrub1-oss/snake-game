// Sliding puzzle — self-contained feature.
// Depends on game.js globals: state, score, exp, scoreEl, expPerFruit,
//   checkLevelUp, updateLevelPanels, renderSkillTree, skillTreeOpen, showBanner
// game.js calls: initPuzzle(), updatePuzzleLock()
// game.js resets: puzzleCompleted, puzzlePendingFruits  (inside init())

const PUZZLE_GOAL   = [1,2,3,4,5,6,7,8,0];
const puzzleSection = document.getElementById('puzzle-section');
const puzzleGridEl  = document.getElementById('puzzle-grid');
const puzzleMsgEl   = document.getElementById('puzzle-msg');
const puzzleLockEl  = document.getElementById('puzzle-lock');
let puzzleTiles = [], puzzleCompleted = false, puzzlePendingFruits = 0;

// Fade in when scrolled into view — stays hidden until user scrolls down
const _puzzleObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    puzzleSection.classList.add('revealed');
    _puzzleObs.disconnect();
  }
}, { threshold: 0.05 });
_puzzleObs.observe(puzzleSection);

function puzzleNeighbors(i) {
  const r = Math.floor(i / 3), c = i % 3, n = [];
  if (r > 0) n.push(i - 3);
  if (r < 2) n.push(i + 3);
  if (c > 0) n.push(i - 1);
  if (c < 2) n.push(i + 1);
  return n;
}

function initPuzzle() {
  puzzleTiles = [...PUZZLE_GOAL];
  for (let k = 0; k < 200; k++) {
    const ei = puzzleTiles.indexOf(0);
    const nb = puzzleNeighbors(ei);
    const pick = nb[Math.floor(Math.random() * nb.length)];
    [puzzleTiles[ei], puzzleTiles[pick]] = [puzzleTiles[pick], puzzleTiles[ei]];
  }
  // ensure not accidentally solved
  if (puzzleTiles.every((v, i) => v === PUZZLE_GOAL[i]))
    [puzzleTiles[0], puzzleTiles[1]] = [puzzleTiles[1], puzzleTiles[0]];
  puzzleMsgEl.textContent = '';
  puzzleMsgEl.className   = '';
  renderPuzzle();
}

function renderPuzzle() {
  puzzleGridEl.innerHTML = '';
  puzzleTiles.forEach((val, idx) => {
    const tile = document.createElement('div');
    tile.className = 'p-tile' + (val === 0 ? ' p-empty' : (puzzleCompleted ? ' p-done' : ''));
    tile.textContent = val === 0 ? '' : val;
    if (val !== 0 && !puzzleCompleted) tile.addEventListener('click', () => puzzleClick(idx));
    puzzleGridEl.appendChild(tile);
  });
}

function puzzleClick(idx) {
  if (state !== 'idle' && state !== 'paused') return;
  if (puzzleCompleted) return;
  const ei = puzzleTiles.indexOf(0);
  if (!puzzleNeighbors(ei).includes(idx)) return;
  [puzzleTiles[ei], puzzleTiles[idx]] = [puzzleTiles[idx], puzzleTiles[ei]];
  renderPuzzle();
  if (puzzleTiles.every((v, i) => v === PUZZLE_GOAL[i])) {
    puzzleCompleted = true;
    grantPuzzleReward();
  }
}

function grantPuzzleReward() {
  const n = 10, expGain = n * expPerFruit();
  if (state === 'paused') {
    score += n; exp += expGain;
    scoreEl.textContent = score;
    checkLevelUp(); updateLevelPanels();
    if (skillTreeOpen) renderSkillTree();
    puzzleMsgEl.textContent = `✓  +${n} FRUITS · +${expGain.toFixed(1)} EXP`;
  } else {
    // idle — defer to startGame (in game.js)
    puzzlePendingFruits = n;
    puzzleMsgEl.textContent = `✓  +${n} FRUITS · +${expGain.toFixed(1)} EXP — CLAIMED ON START`;
  }
  puzzleMsgEl.className = 'p-won';
  renderPuzzle();
}

function updatePuzzleLock() {
  puzzleLockEl.classList.toggle('active', state !== 'idle' && state !== 'paused');
}
