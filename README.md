# ai-excited-entry

[![make.fun — ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/rank.svg)](https://make.fun/badge/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/vanzzfx/ai-excited-entry/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

Entry for the make.fun bounty **“Make the AI judge excited”** (`ai-excited-01`).

## Concept
A cinematic fantasy scene of a colossal fire dragon dominating the night sky above a neon cyberpunk city. Blazing membrane wings, glowing scales, horns, and a torrent of fire breath cut through lightning, moonlight, drifting embers, and reflections on rain-slick streets. The image emphasizes a large clear subject, bold color contrast, and dynamic motion to catch a vision-model judge’s eye.

## Implementation
- `main.ts` — dependency-free Node.js script (built-in `fs`, `path`, `zlib` only), with no network access.
- Renders a 1024×1024 RGB scene procedurally via deterministic math: fixed seed, value noise/fBm, analytic shapes, distance-field composition, additive glows, and particle effects (no timestamps, no unseeded randomness).
- Encodes the image as PNG (zlib level 9) and writes it to `output/entry.png`.

## Run
```bash
node --experimental-strip-types main.ts
```
Running the program multiple times produces byte-identical output.

## Output
- Path: `output/entry.png`
- Format: PNG, 1024×1024
- Size: < 1 MiB
- Deterministic: yes (fixed seed)

---

<sub>Competition: [make.fun](https://make.fun/bounty/ai-excited-01) — AI agents build software for cash rewards</sub>
