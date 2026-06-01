---
name: snake-context
description: Load background context for the snake game project. Use this when starting a new session to work on snake.html — architecture, state, skill tree, controls, and current feature list.
---

# Snake Game — Session Context

Single-file browser game: `/Users/zainkorrub/claude-workspace/snake.html` (~1000 lines).  
GitHub: `https://github.com/zkorrub1-oss/snake-game` (branch: `main`).  
Open locally: `open /Users/zainkorrub/claude-workspace/snake.html`  
After every significant change: `git add snake.html && git commit -m "..." && git push`

---

## Architecture

Everything is in one HTML file: inline CSS → HTML shell → one `<script>` block. No build step, no dependencies.

**Rendering:** `<canvas id="c">` drawn by `draw()`, called from `step()` (the game tick) and `animLoop()` (requestAnimationFrame for glow effects). Canvas size is dynamic — starts 20×20 cells at 20px each (400×400px), can grow up to 40×40.

**Game loop:** `setInterval(step, ms)` stored in `interval`. Speed `ms` is recalculated by `restartInterval()` every time level, or speed skills change.

**Overlays:** All overlays are `position:absolute` divs inside `#canvas-wrap`, toggled with `.hidden`. Stack order (last in DOM = on top): `#overlay` (start/pause/death) → `#skill-tree` → `#reset-confirm` → `#test-mode`.

---

## Key State Variables

```js
// Game
COLS, ROWS, CELL          // grid dimensions (dynamic)
snake                     // [{x,y}, ...] head at index 0
dir, nextDir              // [dx,dy] — nextDir queued from input
foods                     // [{x,y}, ...] array — multiple fruits possible
maxFruits                 // how many foods to keep on map
purpleBox, purpleBoxTimer // enemy: {x,y} | null, setInterval handle

// Progression
score      // raw fruits eaten (= skill tree currency)
exp        // accumulated EXP (used for leveling, NOT score)
level      // current player level (1–20)
lives      // current lives (starts 3, max = getMaxLives())
best       // high score (NOT updated in test mode)

// Skills (reset on death)
skills     // { tongue, expBoost, extraFruit, levelSynergy, maxLives, mapExpand, speedBoost, slowDown }
fruitsSpent // fruits spent on skills this run; spendableFruits() = score - fruitsSpent

// Flags
state         // 'idle' | 'playing' | 'paused' | 'dead' | 'confirm-reset'
skillTreeOpen // bool
testModeUsed  // bool — disables best-score updates
```

---

## Core Functions

| Function | What it does |
|---|---|
| `init()` | Full reset — grid, snake, all state, skills, timers |
| `step()` | One game tick: move head, wall/self/purpleBox collision, eat food, tongue check, draw |
| `draw()` | Renders grid dots → foods → purple box → snake → tongue |
| `restartInterval()` | Clears and restarts `interval` with correct ms (factors level speed + Overdrive - Serpent Pace) |
| `consumeFruit(grow)` | Handles score++, exp+=expPerFruit(), best update, checkLevelUp, refillFoods |
| `checkLevelUp()` | Compares exp to LEVEL_THRESHOLDS; on level-up: flash, restartInterval, applyPowerup, spawn purpleBox at 15 |
| `applyPowerup(type)` | 'extra-life' / 'extra-fruit' / 'bigger-map' — applied directly, never placed on map |
| `loseLife()` | lives--; respawn snake or die() |
| `expPerFruit()` | `1.0 + expBoost×0.1 + (levelSynergy ? min(level,20)/10 : 0)` |
| `getMaxLives()` | `3 + skills.maxLives` |
| `skillCost(def)` | expBoost: +5/level · extraFruit: +10/level · mapExpand: +20/level · others: flat |
| `movePurpleBox()` | Called every 3s; moves box randomly; if it enters snake body → destroy + reward 5+expPerFruit×2 EXP, respawn after 15s |

---

## Leveling

`LEVEL_THRESHOLDS = [0, 5, 12, 21, 32, 45, 60, 77, 96, 117, 140, 165, 192, 221, 252, 285, 320, 357, 396, 437]` — 20 levels, differences increase by 2 each level.

Leveling uses **EXP** (`exp`), not raw fruit count (`score`). Speed increases per level: `BASE_SPEED(130) - (level-1) × SPEED_STEP(10)`, capped at 50ms minimum.

On level-up: random powerup from `POWERUP_POOL` (extra-life excluded if at max lives). At level 15: purple box spawns.

---

## Skill Tree (press E)

Skills reset on death. Unlocked/hidden based on `requires`. Costs scale for expBoost/extraFruit/mapExpand.

```
Always visible:
  👅 Tongue        20 fruits, lv1  — eats fruit 1 cell ahead each tick
  ✦ +0.1 EXP/fruit  5→10→15→20→25, lv5

Requires expBoost lv3:
  🍎 +1 Fruit      10→20→…→200, lv20  — permanent extra fruit on map

Requires extraFruit lv10:
  ⚡ Level Synergy  80 fruits, lv1  — adds level÷10 to EXP/fruit (cap lv20)

Requires levelSynergy lv1:
  ♥ +1 Max Lives   30 fruits, lv5  — raises cap + gives life immediately
  ⬛ Border Increase 20→40→…, lv20  — calls growMap() (adds 1 layer = +2 each dim)
  💨 Overdrive      20 fruits, lv10  — +5% of BASE_SPEED per level (faster)

Requires tongue lv1:
  🐢 Serpent Pace   5 fruits, lv10  — +1% of BASE_SPEED per level (slower)
```

Speed formula: `ms = max(50, round(speedForLevel(level) - speedBoost×6.5 + slowDown×1.3))`

---

## Controls & Special Modes

| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Space | Pause / Resume |
| E | Skill tree (pauses) |
| R | Reset confirm → Yes = idle screen, No = pause menu, Esc = cancel |
| T×3 (within 2s) | Test mode — set snake length, level, lives, fruits, all skills |

**Test mode** (`testModeUsed = true`): score/EXP don't update best. Accessible any time via T×3.

---

## Purple Box Enemy

Spawns at player level 15. Moves 1 cell in a random direction every 3 seconds (skips if not `state === 'playing'`).
- Snake head hits box → `loseLife()`
- Box moves into snake body → box dies, player gets `5 + expPerFruit() × 2` EXP, box respawns after 15s
- Persists across life-loss (not death). Cleared by `init()` and `die()`.

---

## Power-ups (level-up only, never on map)

`POWERUP_POOL = ['extra-life'×1, 'extra-fruit'×3, 'bigger-map'×1]`

- `extra-life`: lives++ capped at `getMaxLives()` — excluded from pool if already at max
- `extra-fruit`: maxFruits++ then refillFoods()
- `bigger-map`: COLS/ROWS += 2 each (1 layer), max 40×40

---

## Things to Know

- **No build step** — edit snake.html and refresh browser.
- **Git remote** is set up; always push after changes.
- **Best score** is stored in localStorage but was intentionally reset to 0 and test-mode runs never write it.
- `skills` object in `init()` only declares `{ tongue: 0, expBoost: 0 }` — other skills default via `|| 0` pattern throughout; adding a new skill requires only adding to `SKILL_DEFS` and handling side-effects in `buySkill()`.
- Overlays inside `#canvas-wrap` resize automatically because the wrap tracks canvas dimensions via inline style.
- The sliding puzzle below the game (in-progress feature) was being discussed — not yet implemented.
