// Archipelago Run — main.ts (Node 22, standard library only)
// Hands this entry in: copies game/ and screenshots/ from beside this file
// into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyIntoOut(name: string): void {
  const src = join(repoRoot, name);
  if (!existsSync(src)) return;
  cpSync(src, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyIntoOut('game');
copyIntoOut('screenshots');
console.log(`Archipelago Run handed in to ${outDir}`);

// The scorer's own caps: only text_max_bytes shapes the bytes; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
// all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
