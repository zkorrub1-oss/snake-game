const LEVEL_THRESHOLDS = [0, 5, 12, 21, 32, 45, 60, 77, 96, 117, 140, 165, 192, 221, 252, 285, 320, 357, 396, 437]; // EXP to reach each level (20 levels)
const BASE_SPEED  = 130;
const SPEED_STEP  = 10;
const POWERUP_POOL = ['extra-life', 'extra-fruit', 'extra-fruit', 'extra-fruit', 'bigger-map'];

const SKILL_DEFS = [
  {
    id: 'tongue',
    name: 'TONGUE',
    icon: '👅',
    desc: 'Collect fruit 1 cell ahead of the snake',
    cost: 20,
    maxLevel: 1,
  },
  {
    id: 'expBoost',
    name: '+0.1 EXP / FRUIT',
    icon: '✦',
    desc: 'Earn 0.1 more EXP per fruit (stackable)',
    cost: 5,
    maxLevel: 5,
  },
  {
    id: 'extraFruit',
    name: '+1 FRUIT',
    icon: '🍎',
    desc: 'Permanently add one more fruit to the map',
    cost: 10,
    maxLevel: 20,
    requires: { id: 'expBoost', level: 3 },
  },
  {
    id: 'levelSynergy',
    name: 'LEVEL SYNERGY',
    icon: '⚡',
    desc: 'Add player level to EXP/fruit',
    cost: 80,
    maxLevel: 1,
    requires: { id: 'extraFruit', level: 10 },
  },
  {
    id: 'maxLives',
    name: '+1 MAX LIVES',
    icon: '♥',
    desc: 'Raise the lives cap by 1 and gain a life immediately',
    cost: 30,
    maxLevel: 5,
    requires: { id: 'levelSynergy', level: 1 },
  },
  {
    id: 'mapExpand',
    name: 'BORDER INCREASE',
    icon: '⬛',
    desc: 'Expand the map by one layer (same as the level-up power-up)',
    cost: 20,
    maxLevel: 20,
    requires: { id: 'levelSynergy', level: 1 },
  },
  {
    id: 'speedBoost',
    name: 'OVERDRIVE',
    icon: '💨',
    desc: 'Increase speed by 5% of starting speed per level',
    cost: 20,
    maxLevel: 10,
    requires: { id: 'levelSynergy', level: 1 },
  },
  {
    id: 'slowDown',
    name: 'SERPENT PACE',
    icon: '🐢',
    desc: 'Decrease speed by 1% of starting speed per level',
    cost: 5,
    maxLevel: 10,
    requires: { id: 'tongue', level: 1 },
  },
  {
    id: 'quickRespawn',
    name: 'HAUNTING',
    icon: '🟣',
    desc: 'Purple box respawns in 10s instead of 15s',
    cost: 0,
    maxLevel: 1,
    requiresKills: 2,
  },
];

const canvas       = document.getElementById('c');
const ctx          = canvas.getContext('2d');
const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best');
const lvlEl        = document.getElementById('lvl');
const livesEl      = document.getElementById('lives');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const puBanner     = document.getElementById('powerup-banner');
const lvlFlash     = document.getElementById('level-flash');
const eatenEl      = document.getElementById('eaten-num');
const needEl       = document.getElementById('need-num');
const panelRightSub= document.getElementById('panel-right-sub');
const skillTreeEl  = document.getElementById('skill-tree');
const stExpRateEl  = document.getElementById('st-exp-rate');
const stFruitsEl   = document.getElementById('st-fruits');
const stGridEl     = document.getElementById('st-skills-grid');
const resetConfirm = document.getElementById('reset-confirm');
document.getElementById('btn-yes').addEventListener('click', confirmReset);
document.getElementById('btn-no').addEventListener('click', cancelReset);
const testModeEl = document.getElementById('test-mode');
document.getElementById('tm-apply').addEventListener('click', applyTestMode);
document.getElementById('tm-cancel').addEventListener('click', closeTestMode);

const DIRS = {
  ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0],
  w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
  W:[0,-1], S:[0,1], A:[-1,0], D:[1,0],
};

let COLS, ROWS, CELL;
let snake, dir, nextDir, foods, maxFruits;
let score, exp, best, lives, level, state, interval;
let purpleBox = null, purpleBoxTimer = null, purpleBoxKills = 0;
let skills, fruitsSpent;
let skillTreeOpen = false;
let prevState = null;
let puBannerTimeout = null;

best = 0;
localStorage.removeItem('snakeBest');
bestEl.textContent = best;
let testModeUsed = false;

function expPerFruit() {
  let val = 1.0 + (skills.expBoost || 0) * 0.1;
  if (skills.levelSynergy > 0) val += level;
  return val;
}
function spendableFruits() { return score - fruitsSpent; }
function getMaxLives() { return 3 + (skills.maxLives || 0); }

function skillCost(def) {
  if (def.id === 'expBoost')   return def.cost + (skills.expBoost   || 0) * 5;
  if (def.id === 'extraFruit') return def.cost + (skills.extraFruit || 0) * 10;
  if (def.id === 'mapExpand')  return def.cost + (skills.mapExpand  || 0) * 20;
  return def.cost;
}

// ── Canvas sizing ──────────────────────────────────────────────────────────
function setGridSize(cols, rows) {
  COLS = cols; ROWS = rows; CELL = 20;
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
  const wrap = document.getElementById('canvas-wrap');
  wrap.style.width  = canvas.width  + 'px';
  wrap.style.height = canvas.height + 'px';
}

// ── Level helpers ──────────────────────────────────────────────────────────
function levelForExp(e) {
  let l = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (e >= LEVEL_THRESHOLDS[i]) { l = i + 1; break; }
  }
  return Math.min(l, LEVEL_THRESHOLDS.length);
}

function speedForLevel(l) { return Math.max(50, BASE_SPEED - (l - 1) * SPEED_STEP); }

function restartInterval() {
  clearInterval(interval);
  if (state !== 'playing') return;
  const base = speedForLevel(level);
  // Each Serpent Pace level reduces speed by 0.1% (level 10 = 99% speed)
  const boost = (skills.speedBoost || 0) * BASE_SPEED * 0.05;
  const slow  = (skills.slowDown  || 0) * BASE_SPEED * 0.01;
  const ms = Math.max(50, Math.round(base - boost + slow));
  interval = setInterval(step, ms);
}

function fmtNum(n) {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? String(Math.floor(n)) : s;
}

function updateLevelPanels() {
  const start = LEVEL_THRESHOLDS[level - 1];
  const end   = LEVEL_THRESHOLDS[level];
  eatenEl.textContent = fmtNum(exp - start);
  needEl.textContent  = end !== undefined ? fmtNum(Math.max(0, end - exp)) : '—';
  panelRightSub.textContent = end === undefined ? 'max\nlevel!' : 'to next\nlevel';
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  setGridSize(20, 20);
  snake       = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir         = [1, 0];
  nextDir     = [1, 0];
  score       = 0;
  exp         = 0;
  lives       = 3;
  level       = 1;
  maxFruits        = 1;
  foods            = [];
  purpleBox        = null;
  clearInterval(purpleBoxTimer); purpleBoxTimer = null;
  purpleBoxKills   = 0;
  testModeUsed     = false;
  skills           = { tongue: 0, expBoost: 0 };
  fruitsSpent = 0;
  puzzleCompleted = false;
  puzzlePendingFruits = 0;
  initPuzzle();
  scoreEl.textContent = 0;
  lvlEl.textContent   = 1;
  updateLivesHud();
  refillFoods();
  updateLevelPanels();
  draw();
}

function updateLivesHud() {
  livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  livesEl.style.color = lives <= 1 ? '#ff4444' : '#e06c75';
}

// ── Food ───────────────────────────────────────────────────────────────────
function randomEmptyCell() {
  let pos, tries = 0;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (++tries > 500) break;
  } while (
    snake.some(s => s.x === pos.x && s.y === pos.y) ||
    foods.some(f => f.x === pos.x && f.y === pos.y) ||
    (purpleBox && purpleBox.x === pos.x && purpleBox.y === pos.y)
  );
  return pos;
}

function refillFoods() {
  while (foods.length < maxFruits) foods.push(randomEmptyCell());
}

// ── Core eat logic (called whenever any fruit is consumed) ─────────────────
function consumeFruit(grow) {
  score++;
  exp += expPerFruit();
  scoreEl.textContent = score;
  if (!testModeUsed && score > best) { best = score; bestEl.textContent = best; localStorage.setItem('snakeBest', best); }
  if (grow) snake.push({ ...snake[snake.length - 1] });
  checkLevelUp();
  refillFoods();
  if (skillTreeOpen) renderSkillTree(); // keep fruit count live
}

// ── Power-ups (applied directly on level up, never placed on map) ──────────
function applyPowerup(type) {
  const labels = {
    'extra-life':  { text: '♥ EXTRA LIFE',  color: '#e06c75' },
    'extra-fruit': { text: '★ +1 FRUIT',    color: '#ffd700' },
    'bigger-map':  { text: '⊞ BIGGER MAP',  color: '#61afef' },
  };
  showBanner(labels[type].text, labels[type].color);
  switch (type) {
    case 'extra-life': lives = Math.min(lives + 1, getMaxLives()); updateLivesHud(); break;
    case 'extra-fruit': maxFruits++; refillFoods(); break;
    case 'bigger-map': growMap(); break;
  }
}

function growMap() {
  // Grow by 1 layer (1 extra cell on each side = +2 per dimension)
  const nc = Math.min(COLS + 2, 40), nr = Math.min(ROWS + 2, 40);
  if (nc === COLS && nr === ROWS) { showBanner('MAP IS MAX SIZE', '#a0a0c0'); return; }
  setGridSize(nc, nr);
  refillFoods();
}

// ── Banner ─────────────────────────────────────────────────────────────────
function showBanner(text, color) {
  clearTimeout(puBannerTimeout);
  puBanner.textContent = text;
  puBanner.style.color = color;
  puBanner.style.background = color + '22';
  puBanner.classList.remove('hidden');
  puBannerTimeout = setTimeout(() => puBanner.classList.add('hidden'), 2200);
}

// ── Level up ───────────────────────────────────────────────────────────────
function checkLevelUp() {
  const newLevel = levelForExp(exp);
  if (newLevel > level) {
    level = newLevel;
    lvlEl.textContent = level;
    flashLevel();
    restartInterval();
    // Pick a powerup; exclude extra-life if already at max
    const pool = lives >= getMaxLives() ? POWERUP_POOL.filter(t => t !== 'extra-life') : POWERUP_POOL;
    applyPowerup(pool[Math.floor(Math.random() * pool.length)]);
    // Spawn purple box once player reaches level 15
    if (level >= 15 && !purpleBoxTimer) {
      purpleBox = randomEmptyCell();
      purpleBoxTimer = setInterval(movePurpleBox, 3000);
    }
  }
  updateLevelPanels();
}

function movePurpleBox() {
  if (!purpleBox || state !== 'playing') return;
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  // shuffle
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  for (const [dx, dy] of dirs) {
    const nx = purpleBox.x + dx, ny = purpleBox.y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
    // Purple box moves into snake body → box dies, reward EXP
    if (snake.some(s => s.x === nx && s.y === ny)) {
      purpleBox = null;
      purpleBoxKills++;
      const reward = 5 + expPerFruit() * 2;
      exp += reward;
      showBanner(`💀 +${reward.toFixed(1)} EXP`, '#a855f7');
      checkLevelUp();
      if (skillTreeOpen) renderSkillTree(); // reveal HAUNTING after 2nd kill
      draw();
      const respawnDelay = skills.quickRespawn ? 10000 : 15000;
      setTimeout(() => { if (purpleBoxTimer) purpleBox = randomEmptyCell(); }, respawnDelay);
      return;
    }
    purpleBox = { x: nx, y: ny };
    draw();
    return;
  }
}

function flashLevel() {
  lvlFlash.textContent = `LEVEL ${level}`;
  lvlFlash.style.opacity = '1';
  setTimeout(() => lvlFlash.style.opacity = '0', 900);
}

// ── Game loop ──────────────────────────────────────────────────────────────
function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir[0], y: snake[0].y + dir[1] };

  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    loseLife(); return;
  }
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    loseLife(); return;
  }
  if (purpleBox && head.x === purpleBox.x && head.y === purpleBox.y) {
    loseLife(); return;
  }

  snake.unshift(head);

  const foodIdx = foods.findIndex(f => f.x === head.x && f.y === head.y);
  if (foodIdx !== -1) {
    foods.splice(foodIdx, 1);
    consumeFruit(false); // snake already grew from unshift + no pop
  } else {
    snake.pop();
  }

  // tongue: eat food 1 cell further ahead
  if (skills.tongue > 0) {
    let tipX = head.x + dir[0];
    let tipY = head.y + dir[1];
    if (tipX >= 0 && tipX < COLS && tipY >= 0 && tipY < ROWS) {
      const tIdx = foods.findIndex(f => f.x === tipX && f.y === tipY);
      if (tIdx !== -1) {
        foods.splice(tIdx, 1);
        consumeFruit(true); // explicit grow since snake didn't naturally pass through tip
      }
    }
  }

  draw();
}

// ── Lives & death ──────────────────────────────────────────────────────────
function loseLife() {
  lives--;
  updateLivesHud();
  if (lives <= 0) {
    die();
  } else {
    snake   = [{ x: Math.floor(COLS/2), y: Math.floor(ROWS/2) },
               { x: Math.floor(COLS/2)-1, y: Math.floor(ROWS/2) },
               { x: Math.floor(COLS/2)-2, y: Math.floor(ROWS/2) }];
    dir = [1,0]; nextDir = [1,0]; foods = [];
    refillFoods();
    showBanner(`♥ ${lives} LIFE${lives!==1?'S':''} LEFT`, '#e06c75');
    draw();
  }
}

function die() {
  clearInterval(interval);
  clearInterval(purpleBoxTimer); purpleBoxTimer = null; purpleBox = null;
  if (skillTreeOpen) closeSkillTree(false);
  state = 'dead';
  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.style.color = '#e06c75';
  overlayMsg.textContent   = `SCORE: ${score}  ·  LEVEL: ${level}  ·  PRESS ENTER TO RETRY`;
  overlay.classList.remove('hidden');
  updatePuzzleLock();
}

// ── Skill tree ─────────────────────────────────────────────────────────────
function openSkillTree() {
  if (state === 'dead' || state === 'idle') return;
  prevState = state;
  if (state === 'playing') clearInterval(interval);
  skillTreeOpen = true;
  overlay.classList.add('hidden');
  skillTreeEl.classList.remove('hidden');
  renderSkillTree();
}

function closeSkillTree(resume = true) {
  skillTreeOpen = false;
  skillTreeEl.classList.add('hidden');
  if (!resume) return;
  if (prevState === 'playing') {
    state = 'playing';
    restartInterval();
  } else {
    overlayTitle.textContent = 'PAUSED';
    overlayTitle.style.color = '#4ecca3';
    overlayMsg.textContent   = 'PRESS SPACE TO RESUME';
    overlay.classList.remove('hidden');
  }
}

function renderSkillTree() {
  stExpRateEl.textContent = `EXP/FRUIT: ${expPerFruit().toFixed(1)}`;
  stFruitsEl.textContent  = `FRUITS: ${spendableFruits()}`;

  stGridEl.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const lvl      = skills[def.id] || 0;
    const maxed    = lvl >= def.maxLevel;
    const cost     = skillCost(def);
    const afford   = spendableFruits() >= cost;
    const unlocked = (!def.requiresKills || purpleBoxKills >= def.requiresKills) &&
                     (!def.requires || (skills[def.requires.id] || 0) >= def.requires.level);
    if (!unlocked) return;

    const card = document.createElement('div');
    card.className = 'skill-card' + (lvl > 0 ? ' has-level' : '');

    const levelLine = def.maxLevel > 1
      ? `<div class="skill-lvl">LEVEL ${lvl} / ${def.maxLevel}</div>`
      : (lvl > 0 ? `<div class="skill-lvl">UNLOCKED</div>` : '');

    let btnHtml;
    if (maxed) {
      btnHtml = `<button class="skill-btn owned" disabled>${def.maxLevel > 1 ? 'MAX' : 'OWNED'}</button>`;
    } else if (cost === 0) {
      btnHtml = `<button class="skill-btn" data-id="${def.id}">UNLOCK<br><span class="skill-cost">FREE</span></button>`;
    } else {
      btnHtml = `<button class="skill-btn" data-id="${def.id}" ${afford ? '' : 'disabled'}>
        BUY<br><span class="skill-cost">${cost} fruits</span>
      </button>`;
    }

    card.innerHTML = `
      <div class="skill-icon">${def.icon}</div>
      <div class="skill-info">
        <div class="skill-name">${def.name}</div>
        <div class="skill-desc">${def.desc}</div>
        ${levelLine}
      </div>
      <div class="skill-action">${btnHtml}</div>
    `;
    stGridEl.appendChild(card);
  });

  stGridEl.querySelectorAll('.skill-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => buySkill(btn.dataset.id));
  });
}

function buySkill(id) {
  const def = SKILL_DEFS.find(s => s.id === id);
  const cost = skillCost(def);
  if (!def || (skills[id] || 0) >= def.maxLevel || spendableFruits() < cost) return;
  if (def.requires && (skills[def.requires.id] || 0) < def.requires.level) return;
  if (def.requiresKills && purpleBoxKills < def.requiresKills) return;
  fruitsSpent += cost;
  skills[id] = (skills[id] || 0) + 1;
  if (id === 'extraFruit') { maxFruits++; refillFoods(); }
  if (id === 'mapExpand')  { growMap(); }
  if (id === 'maxLives')   { lives = Math.min(lives + 1, getMaxLives()); updateLivesHud(); }
  renderSkillTree();
}

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = '#0f0f1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e1e3a';
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      ctx.fillRect(x * CELL + 9, y * CELL + 9, 2, 2);

  foods.forEach(f => {
    const cx = f.x * CELL + CELL / 2;
    const cy = f.y * CELL + CELL / 2 + 1; // shift body down to leave room for stem
    ctx.save();

    // Body
    ctx.fillStyle = '#e06c75';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2, 2, 1.5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.quadraticCurveTo(cx + 1.5, cy - 7, cx + 1, cy - 9);
    ctx.stroke();

    // Leaf
    ctx.fillStyle = '#4ecca3';
    ctx.translate(cx + 2.5, cy - 7);
    ctx.rotate(0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // purple box
  if (purpleBox) {
    ctx.save();
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur  = 8 + 5 * Math.sin(Date.now() / 300);
    ctx.fillStyle   = '#7e22ce';
    ctx.beginPath();
    ctx.roundRect(purpleBox.x * CELL + 1, purpleBox.y * CELL + 1, CELL - 2, CELL - 2, 3);
    ctx.fill();
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  snake.forEach((seg, i) => {
    const t = i / (snake.length - 1 || 1);
    ctx.fillStyle = i === 0 ? '#4ecca3' : `hsl(${160 - t*40}, 70%, ${50 - t*15}%)`;
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad*2, CELL - pad*2, 4);
    ctx.fill();
  });

  // tongue visual
  if (skills.tongue > 0 && snake.length > 0) {
    const h  = snake[0];
    const cx = h.x * CELL + CELL/2, cy = h.y * CELL + CELL/2;
    const ex = cx + dir[0] * CELL * 1.5, ey = cy + dir[1] * CELL * 1.5;
    const perp = [-dir[1], dir[0]]; // perpendicular
    const fLen = 5;
    ctx.strokeStyle = '#e06c75';
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    // fork
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + dir[0]*fLen + perp[0]*fLen, ey + dir[1]*fLen + perp[1]*fLen);
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + dir[0]*fLen - perp[0]*fLen, ey + dir[1]*fLen - perp[1]*fLen);
    ctx.stroke();
  }
}

// ── Reset confirm ──────────────────────────────────────────────────────────
function showResetConfirm() {
  if (state === 'dead' || state === 'idle') return;
  if (skillTreeOpen) closeSkillTree(false);
  clearInterval(interval);
  overlay.classList.add('hidden');
  resetConfirm.classList.remove('hidden');
  state = 'confirm-reset';
}

function confirmReset() {
  resetConfirm.classList.add('hidden');
  init();
  state = 'idle';
  overlayTitle.textContent = 'READY';
  overlayTitle.style.color = '#e06c75';
  overlayMsg.textContent   = 'PRESS ENTER TO START';
  overlay.classList.remove('hidden');
  updatePuzzleLock();
}

function cancelReset() {
  resetConfirm.classList.add('hidden');
  state = 'paused';
  overlayTitle.textContent = 'PAUSED';
  overlayTitle.style.color = '#4ecca3';
  overlayMsg.textContent   = 'PRESS SPACE TO RESUME';
  overlay.classList.remove('hidden');
  updatePuzzleLock();
}

// ── Test mode ──────────────────────────────────────────────────────────────
let tPresses = [];

function openTestMode() {
  clearInterval(interval);
  overlay.classList.add('hidden');
  skillTreeEl.classList.add('hidden');
  resetConfirm.classList.add('hidden');
  testModeEl.classList.remove('hidden');

  // Populate form with current values
  document.getElementById('tm-length').value  = snake.length || 3;
  document.getElementById('tm-level').value   = level || 1;
  document.getElementById('tm-lives').value   = lives || 3;
  document.getElementById('tm-fruits').value  = spendableFruits();

  // Build skill rows dynamically
  const container = document.getElementById('tm-skills');
  container.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const current = skills[def.id] || 0;
    const row = document.createElement('div');
    row.className = 'tm-row';
    if (def.maxLevel === 1) {
      row.innerHTML = `
        <span class="tm-label"><span class="tm-icon">${def.icon}</span>${def.name}</span>
        <input class="tm-input" type="checkbox" id="tm-skill-${def.id}" ${current ? 'checked' : ''}>
      `;
    } else {
      row.innerHTML = `
        <span class="tm-label"><span class="tm-icon">${def.icon}</span>${def.name} <span class="tm-max">(0–${def.maxLevel})</span></span>
        <input class="tm-input" type="number" id="tm-skill-${def.id}" min="0" max="${def.maxLevel}" value="${current}">
      `;
    }
    container.appendChild(row);
  });
}

function closeTestMode() {
  testModeEl.classList.add('hidden');
  // return to whatever was showing before
  if (state === 'playing' || state === 'idle' || state === 'dead') {
    overlay.classList.remove('hidden');
  } else {
    overlayTitle.textContent = 'PAUSED';
    overlayTitle.style.color = '#4ecca3';
    overlayMsg.textContent   = 'PRESS SPACE TO RESUME';
    overlay.classList.remove('hidden');
  }
}

function applyTestMode() {
  testModeEl.classList.add('hidden');
  overlay.classList.add('hidden');

  // Read inputs
  const newLength   = Math.max(3,  Math.min(80, parseInt(document.getElementById('tm-length').value)  || 3));
  const newLevel    = Math.max(1,  Math.min(20, parseInt(document.getElementById('tm-level').value)   || 1));
  const newLives    = Math.max(1,  Math.min(3,  parseInt(document.getElementById('tm-lives').value)   || 3));
  const newSpendable= Math.max(0,              parseInt(document.getElementById('tm-fruits').value)  || 0);

  // Full reset first
  init();

  testModeUsed     = true;

  // Override level / exp (set to the start EXP of that level)
  level = newLevel;
  exp   = LEVEL_THRESHOLDS[newLevel - 1];
  lvlEl.textContent = level;

  // Override lives
  lives = newLives;
  updateLivesHud();

  // Override skills
  SKILL_DEFS.forEach(def => {
    const el = document.getElementById(`tm-skill-${def.id}`);
    if (!el) return;
    skills[def.id] = def.maxLevel === 1
      ? (el.checked ? 1 : 0)
      : Math.max(0, Math.min(def.maxLevel, parseInt(el.value) || 0));
  });

  // Apply skill side-effects
  maxFruits = 1 + (skills.extraFruit || 0);
  foods = [];
  refillFoods();

  // Override snake length (extend from tail)
  while (snake.length < newLength) snake.push({ ...snake[snake.length - 1] });

  // Set spendable fruits: score = newSpendable (fruitsSpent is 0 after init)
  score = newSpendable;
  scoreEl.textContent = score;

  updateLevelPanels();
  draw();

  state = 'playing';
  restartInterval();
}

// ── Start / pause ──────────────────────────────────────────────────────────
function startGame() {
  overlay.classList.add('hidden');
  const pending = puzzlePendingFruits;
  init();
  if (pending > 0) {
    puzzleCompleted = true;
    score = pending;
    exp   = pending; // expPerFruit() = 1.0 at game start (no skills yet)
    scoreEl.textContent = score;
    checkLevelUp();
    updateLevelPanels();
    showBanner('PUZZLE +10 FRUITS!', '#4ecca3');
  }
  state = 'playing';
  restartInterval();
  updatePuzzleLock();
}

function togglePause() {
  if (skillTreeOpen) return;
  if (state === 'playing') {
    clearInterval(interval);
    state = 'paused';
    overlayTitle.textContent = 'PAUSED';
    overlayTitle.style.color = '#4ecca3';
    overlayMsg.textContent   = 'PRESS SPACE TO RESUME';
    overlay.classList.remove('hidden');
    updatePuzzleLock();
  } else if (state === 'paused') {
    overlay.classList.add('hidden');
    state = 'playing';
    restartInterval();
    updatePuzzleLock();
  }
}

// ── Input ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // T×3 opens test mode from any state
  if (e.key === 't' || e.key === 'T') {
    const now = Date.now();
    tPresses = tPresses.filter(t => now - t < 2000);
    tPresses.push(now);
    if (tPresses.length >= 3) { tPresses = []; openTestMode(); return; }
  }
  if (e.key === 'r' || e.key === 'R') {
    if (state === 'playing' || state === 'paused') { showResetConfirm(); return; }
  }
  if (e.key === 'e' || e.key === 'E') {
    if (skillTreeOpen) { closeSkillTree(); return; }
    if (state === 'playing' || state === 'paused') { openSkillTree(); return; }
  }
  if (e.key === 'Escape' && skillTreeOpen) { closeSkillTree(); return; }
  if (e.key === 'Escape' && state === 'confirm-reset') { cancelReset(); return; }
  if (e.key === 'Enter' && (state === 'idle' || state === 'dead')) {
    startGame(); return;
  }
  if (e.key === ' ' && (state === 'playing' || state === 'paused')) {
    togglePause(); return;
  }
  if (state !== 'playing' || skillTreeOpen || state === 'confirm-reset') return;
  const d = DIRS[e.key];
  if (!d) return;
  e.preventDefault();
  if (d[0] === -dir[0] && d[1] === -dir[1]) return;
  nextDir = d;
});

let tx, ty;
canvas.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
  if (state === 'idle' || state === 'dead') { startGame(); return; }
  if (Math.abs(dx) > Math.abs(dy)) nextDir = dx > 0 ? [1,0] : [-1,0];
  else nextDir = dy > 0 ? [0,1] : [0,-1];
  if (nextDir[0] === -dir[0] && nextDir[1] === -dir[1]) nextDir = dir;
}, { passive: true });
