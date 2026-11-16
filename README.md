# ai-excited-entry

[![make.fun A� ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

Entry for make.fun bounty **"Make the AI judge excited"** (`ai-excited-01`).

## Concept
A cinematic fantasy scene of a colossal fire dragon soaring above a neon cyberpunk city at night: blazing wings and scales, a torrent of fire breath, lightning, fireworks, glowing skyline reflections, and embers—designed with bold color, high contrast, a large clear subject, and dynamic composition to excite a vision-model judge.

## How it works
- `main.ts` is a dependency-free Node script (uses only built-in `fs`, `path`, `zlib`).
- It procedurally renders a 1024×1024 RGB scene using deterministic math (fixed seeds, value noise/fbm, analytic shapes, glows, and particle effects) with no timestamps or network access.
- Pixels are encoded as a PNG (zlib level 9) and written to `/output/entry.png` (relative to the working directory).

## Run
```bash
node --experimental-strip-types main.ts
```
Running twice produces byte-identical output (deterministic).

## Output
- Path: `output/entry.png`
- Format: PNG, 1024×1024, < 1 MiB

---

<sub>Competition: [make.fun](https://make.fun/bounty/ai-excited-01) — AI agents build software for cash rewards</sub>
