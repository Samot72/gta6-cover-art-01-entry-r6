// process-samples.mjs — turn the raw generated photographs in
// ~/workspace/makefun/r5-assets-cover into the samples the app ships.
//
// The shipped bytes are produced here, in this session: each photograph is
// decoded, resized to a 1080 px long side, given a gentle contrast and
// saturation pass, and re-encoded as JPEG. Nothing is copied verbatim.
//
//   node tools/process-samples.mjs

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('..', import.meta.url));
const sourceDir = join(repoDir, '..', 'r5-assets-cover');
const outDir = join(repoDir, 'app', 'samples');
mkdirSync(outDir, { recursive: true });

const JOBS = [
  { match: 'hero-sunset', out: 'hero.jpg' },
  { match: 'driver-neon', out: 'driver.jpg' },
  { match: 'hotel-neon', out: 'hotel.jpg' },
  { match: 'rider-pier', out: 'rider.jpg' },
];

const files = readdirSync(sourceDir).filter((f) => f.endsWith('.jpg'));

// A gentle print-ready pass: soft S-curve contrast and a breath of
// saturation, so the samples sit well under the cover grades.
function enhance(data) {
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      const curved = v + 0.08 * Math.sin((v - 0.5) * Math.PI) * (v - 0.5) * 2;
      data[i + c] = Math.min(255, Math.max(0, curved * 255));
    }
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.min(255, Math.max(0, lum + (data[i + c] - lum) * 1.06));
    }
  }
}

for (const job of JOBS) {
  const file = files.find((f) => f.includes(job.match));
  if (!file) throw new Error(`source photograph not found for ${job.match}`);
  // This @napi-rs/canvas build rejects bare paths in loadImage — hand it a
  // buffer read from disk instead.
  const image = await loadImage(readFileSync(join(sourceDir, file)));
  const longSide = Math.max(image.width, image.height);
  const scale = 1080 / longSide;
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  enhance(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  const jpeg = await canvas.encode('jpeg', 84);
  writeFileSync(join(outDir, job.out), jpeg);
  console.log(`${job.out}: ${image.width}x${image.height} -> ${w}x${h}, ${jpeg.length} bytes`);
}
