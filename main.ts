// Director's Cut — entry program for gta6-cover-art-01.
//
// What this program does, and all it does: it carries the finished studio
// from this repository into the output directory and writes the dossier
// the judge reads. The studio itself is the static web app under app/
// (open app/index.html in a browser; it runs fully offline). The dossier
// is produced by the kit's own library, vendor/makefun-app.ts, called
// here with the competition's caps, so the bytes in dossier.json are
// exactly the bytes the scorer will rebuild and compare.
//
// Runs on Node 22 with the standard library only; nothing is installed,
// nothing is fetched. Outside the grader, MAKEFUN_OUTPUT_DIR names the
// output directory in place of /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The competition's caps, mirrored from the kit so a mistake here fails
// loudly at handoff time instead of silently at the gate.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

mkdirSync(outDir, { recursive: true });

// The app, whole and untouched.
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });

// The screenshots, when the repository carries them.
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The dossier, written by the kit's library from what now stands in the
// output directory — the same ground truth the scorer will see.
const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(
  `directors-cut: handed in ${countFiles(join(outDir, 'app'))} app files, ` +
    `${existsSync(join(outDir, 'screenshots')) ? countFiles(join(outDir, 'screenshots')) : 0} screenshots, ` +
    `dossier ${dossier.length} bytes -> ${outDir}`,
);
