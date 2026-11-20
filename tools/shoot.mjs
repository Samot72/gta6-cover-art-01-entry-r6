// shoot.mjs — render the entry's screenshots with the app's own code.
//
// Every screenshot is a scene from app/src/scenes.js (the same scenes the
// editor's Showcase view paints), drawn headlessly through
// @napi-rs/canvas: the autopilot directs a real plan from the shipped
// sample photographs, and the scenes render it. Output goes to
// screenshots/ as JPEGs inside the gate's limits (long side <= 1280,
// short side >= 480, <= 256 KiB — quality steps down until it fits).
//
//   node tools/shoot.mjs

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzePhoto } from '../app/src/analyze.js';
import { directCover, remixCrop, remixGrade, remixTitle } from '../app/src/director.js';
import { drawBeforeAfterScene, drawCoverScene, drawNotesScene, drawRemixScene } from '../app/src/scenes.js';

const repoDir = fileURLToPath(new URL('..', import.meta.url));

// A heavy display face for the title lettering: the app asks for the
// family "CoverHeavy" first, which browsers resolve to their black poster
// faces; here we register the VM's boldest sans under that name.
for (const [path, name] of [
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'CoverHeavy'],
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 'CoverHeavy'],
]) {
  if (existsSync(path)) {
    try {
      GlobalFonts.registerFromPath(path, name);
      break;
    } catch {
      /* try the next candidate */
    }
  }
}

const env = { makeCanvas: (w, h) => createCanvas(w, h) };

async function loadPhoto(key) {
  const file = join(repoDir, 'app', 'samples', `${key}.jpg`);
  const image = await loadImage(readFileSync(file));
  const w = 160;
  const h = Math.max(8, Math.round((w * image.height) / image.width));
  const probe = createCanvas(w, h);
  const pctx = probe.getContext('2d');
  pctx.drawImage(image, 0, 0, w, h);
  const pixels = pctx.getImageData(0, 0, w, h);
  return {
    image,
    width: image.width,
    height: image.height,
    analysis: analyzePhoto({ data: pixels.data, width: w, height: h }),
  };
}

async function encodeFitting(canvas, name) {
  for (const q of [88, 82, 76, 70, 64, 58, 52]) {
    const buf = await canvas.encode('jpeg', q);
    if (buf.length <= 250 * 1024) {
      writeFileSync(join(repoDir, 'screenshots', name), buf);
      console.log(`${name}: ${canvas.width}x${canvas.height}, ${buf.length} bytes @ q${q}`);
      return;
    }
  }
  throw new Error(`${name} would not fit 256 KiB`);
}

const shots = JSON.parse(readFileSync(join(repoDir, 'shots.json'), 'utf8'));
mkdirSync(join(repoDir, 'screenshots'), { recursive: true });

for (const [index, shot] of shots.entries()) {
  const photo = await loadPhoto(shot.photo);
  const photos = [photo];
  const plan = directCover(photos, {
    caption: shot.caption,
    tagline: 'One last summer. Every debt comes due.',
    seed: 20261120 + index * 101,
  });
  const canvas = createCanvas(shot.w, shot.h);
  const ctx = canvas.getContext('2d');
  if (shot.scene === 'cover') {
    drawCoverScene(ctx, env, plan, photos, shot.w, shot.h);
  } else if (shot.scene === 'notes') {
    drawNotesScene(ctx, env, plan, photos, shot.w, shot.h);
  } else if (shot.scene === 'beforeafter') {
    drawBeforeAfterScene(ctx, env, plan, photos, shot.w, shot.h);
  } else if (shot.scene === 'remix') {
    const variants = [
      remixCrop(plan, photos, plan.seed + 11),
      remixGrade(plan, plan.seed + 23),
      remixTitle(plan, photos, plan.seed + 37),
    ];
    drawRemixScene(ctx, env, variants, photos, shot.w, shot.h);
  } else {
    throw new Error(`unknown scene ${shot.scene}`);
  }
  console.log(
    `  plan: layout=${plan.layoutId} grade=${plan.gradeId} title=${plan.titleId} light=${photo.analysis.light}` +
      ` face=${photo.analysis.face ? 'yes' : 'no'} notes=${plan.notes.length}`,
  );
  await encodeFitting(canvas, shot.name);
}
