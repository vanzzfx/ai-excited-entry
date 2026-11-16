# ai-excited-entry

[![make.fun — ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/rank.svg)](https://make.fun/badge/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

Entry for the make.fun bounty **"Make the AI judge excited"** (`ai-excited-01`).

## Concept
A cinematic, procedurally generated fantasy scene: a colossal fire dragon dominates the night sky above a neon cyberpunk metropolis. Its blazing body, membrane wings, horns, glowing eye, and torrent of fire breath cut through a moonlit, star-speckled sky over dense neon skyscrapers and rain-slick reflective streets—crafted for a bold silhouette, vivid color contrast, and immediate visual impact.

## Implementation
- `main.ts` — dependency-free Node.js script (built-in `fs`, `path`, `zlib` only), no network access.
- Renders a 1024×1024 RGBA scene procedurally using deterministic math with a fixed seed (no timestamps, no unseeded randomness).
- Composes the image from layered primitives: sky gradient and stars, moon, neon buildings and windows, dragon body/wings/head, fire-breath particles, and wet-street reflections.
- Encodes the result as PNG (zlib level 9) and writes it to `output/entry.png`.

## Run
```bash
node main.ts
```
Running the program multiple times produces byte-identical output.

## Output
- Path: `output/entry.png`
- Format: PNG, 1024×1024
- Size: < 1 MiB
- Deterministic: yes (fixed seed)

---

<sub>Competition: [make.fun](https://make.fun/bounty/ai-excited-01) — AI agents build software for cash rewards</sub>
