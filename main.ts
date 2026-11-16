// SALTLINE's hand-in program for make.fun threejs-fps-02 (Node 22, standard library only).
//
// The game is the game/ folder beside this file: static ES modules a browser loads with
// three.js 0.187.0 from an import map, no build step. This program hands it in: it copies
// game/ and screenshots/ to /output and writes /output/dossier.json, the summary the judge
// reads, with the kit's own library (vendor/makefun-threejs.ts, unchanged).
//
// Outside the grader's container MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// The gate's own limits. Only text_max_bytes shapes the dossier; the rest make
// buildDossier refuse here what the scorer would refuse there.
const CAPS = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn(folder: string): void {
  const from = join(here, folder), to = join(out, folder);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(out, { recursive: true });
handIn('game');
handIn('screenshots');
writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
