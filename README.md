# Snake

A browser-based Snake game with RPG progression, a skill tree, enemies, and a leaderboard. No dependencies, no build step — just open `snake.html`.

## How to Play

| Key | Action |
|---|---|
| WASD / Arrow keys | Move |
| Enter | Start / retry |
| P | Pause / resume |
| E | Open skill tree |
| R | Reset (confirms before wiping) |

Touch: swipe to steer, tap to start.

## Progression

**Leveling** — Eating fruit earns EXP. Speed increases each level up to level 9, then jumps harder at level 10, then harder again at level 20. EXP required per level doubles every level from level 10, then triples every level from level 20.

**Skill tree (E)** — Spend fruit on permanent upgrades for the current run. Skills reset on death.

| Skill | Effect | Unlocks after |
|---|---|---|
| 👅 Tongue | Collect fruit 1 cell ahead | Always |
| ✦ +1 EXP/Fruit | +1 EXP per fruit per level (max 5) | Always |
| 🍎 +1 Fruit | Permanent extra fruit on map (max 20) | +1 EXP lv 3 |
| ⚡ Level Synergy | Adds player level to EXP/fruit | +1 Fruit lv 5 |
| ♥ +1 Max Lives | Raise lives cap and gain a life | Level Synergy |
| ⬛ Border Increase | Expand the map by one layer (max 3) | Level Synergy |
| 💨 Overdrive | Slow snake by 5%/level (max 3) | Level Synergy |
| 🐢 Serpent Pace | Slow snake by 1%/level (max 10) | Tongue |
| 🍏 +1 Fruit (bonus) | Extra fruit on map (max 5) | Serpent Pace lv 5 |
| ⏳ Patience | +1 EXP/fruit per level (max 5) | Serpent Pace lv 5 |
| 🟣 Haunting | Purple box respawns in 10s not 15s — free! | Kill purple box twice |

**Level-up power-ups** — Each level-up randomly grants one of: extra life, +1 fruit on map, or bigger map.

## Enemies

- **Purple box** — Spawns at level 15. One additional box per multiple of 15 (level 30 → 2, level 45 → 3, …). Moves randomly every 3s. Hitting it with your head costs a life. If it walks into your body, it dies and gives EXP — respawns after 15s (10s with Haunting skill).

- **Red box** — Spawns at level 50 and chases directly toward your head every 1s. One additional box every 20 levels (level 70 → 2, level 90 → 3, …). Same kill/EXP mechanic as purple, but respawns after 20s.

## Sliding Puzzle

Scroll below the game while idle or paused to find a 3×3 sliding puzzle. Solve it to earn **+10 fruits and EXP** — once per run. The reward is applied immediately when paused, or carried into the next game start if solved on the idle screen.

## Leaderboard

Enter up to 3 initials on the start screen. Your top-10 scores are saved locally and shown on the leaderboard every time you die.

## Files

| File | Contents |
|---|---|
| `snake.html` | HTML structure + boot script |
| `snake.css` | All styles |
| `js/game.js` | Core game logic, rendering, skills, enemies |
| `js/puzzle.js` | Sliding puzzle feature |

## Test Mode

Press **T three times within 2 seconds** from any state to open test mode. Set snake length, level, lives, fruits, and skill levels freely. Test-mode scores are not saved to the leaderboard.
