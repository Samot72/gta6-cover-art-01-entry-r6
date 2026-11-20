// analyze.js — photo intelligence for the Director's Cut autopilot.
//
// Everything here works on raw pixel buffers ({ data, width, height } in
// RGBA order), never on DOM or Node objects, so the exact same code runs in
// the browser editor and in the headless screenshot renderer. The director
// (director.js) turns these measurements into crop, grade and title choices,
// and quotes the numbers in its Director's Notes.

export const SKIN_WEIGHT = 0.65; // how strongly skin pulls the subject box
export const SUBJECT_THRESHOLD = 0.58; // share of peak score a cell needs

// Is this pixel plausibly skin? Classic RGB rule set, widened a little for
// golden-hour light: red leads, green sits well above blue, and the pixel is
// neither grey nor blown out.
export function isSkinPixel(r, g, b) {
  if (r < 60 || g < 30 || b < 15) return false;
  if (r - g < 12 || r - b < 25) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 18) return false;
  if (r > 235 && g > 200 && b > 170) return false; // blown highlight, not skin
  return true;
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// Analyse one photo. `pixels` is any { data, width, height } RGBA buffer —
// the caller downscales first (160 px wide is plenty) so this stays cheap.
export function analyzePhoto(pixels) {
  const { data, width, height } = pixels;
  const cellsX = 32;
  const cellsY = Math.max(8, Math.round((cellsX * height) / width));
  const cellW = width / cellsX;
  const cellH = height / cellsY;

  const sal = new Float32Array(cellsX * cellsY); // saliency per cell
  const skin = new Float32Array(cellsX * cellsY); // skin share per cell
  const cellCount = new Float32Array(cellsX * cellsY);

  let lumSum = 0;
  let magenta = 0;
  let warm = 0;
  let cool = 0;
  let pixelTotal = 0;

  for (let y = 0; y < height; y++) {
    const cy = Math.min(cellsY - 1, Math.floor(y / cellH));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      const sat = saturation(r, g, b);
      lumSum += lum;
      pixelTotal++;

      // Light census: magenta neon, warm sun, cool shade.
      if (r > 90 && b > 70 && g < r * 0.72 && g < b * 0.95) magenta++;
      else if (r > 110 && r > g && g > b && r - b > 45) warm++;
      else if (b > r && b > g && b - r > 18) cool++;

      const cx = Math.min(cellsX - 1, Math.floor(x / cellW));
      const cell = cy * cellsX + cx;
      cellCount[cell]++;
      // Saliency: saturated or unusually bright/dark cells draw the eye.
      sal[cell] += sat * 0.7 + Math.abs(lum - 128) / 255;
      if (isSkinPixel(r, g, b)) skin[cell]++;
    }
  }

  for (let c = 0; c < sal.length; c++) {
    const n = cellCount[c] || 1;
    sal[c] /= n;
    skin[c] /= n;
  }

  // Combined subject score: skin dominates, saliency supports.
  const score = new Float32Array(sal.length);
  let peak = 0;
  for (let c = 0; c < score.length; c++) {
    score[c] = skin[c] * SKIN_WEIGHT + sal[c] * (1 - SKIN_WEIGHT);
    if (score[c] > peak) peak = score[c];
  }

  const box = boxAboveThreshold(score, cellsX, cellsY, peak * SUBJECT_THRESHOLD);
  const subject = resolveSubjectBox(box, score, cellsX, cellsY);
  const face = faceBox(skin, cellsX, cellsY);
  const avgLum = lumSum / Math.max(1, pixelTotal);
  const light = classifyLight({
    magentaShare: magenta / pixelTotal,
    warmShare: warm / pixelTotal,
    coolShare: cool / pixelTotal,
    avgLum,
  });
  const titleZone = emptiestBand(score, cellsX, cellsY);

  return {
    width,
    height,
    cellsX,
    cellsY,
    score,
    subject, // { x0, y0, x1, y1 } in 0..1 frame coordinates
    face, // same shape, or null when no skin cluster reads as a face
    skinShare: totalShare(skin),
    light, // 'golden' | 'neon' | 'day' | 'night'
    avgLum,
    magentaShare: magenta / pixelTotal,
    warmShare: warm / pixelTotal,
    titleZone, // 'top' | 'bottom' — where the frame is emptiest
  };
}

function totalShare(grid) {
  let s = 0;
  for (const v of grid) s += v;
  return s / grid.length;
}

// Bounding box (in cell units) of every cell at or above `cut`.
function boxAboveThreshold(score, cellsX, cellsY, cut) {
  let x0 = cellsX;
  let y0 = cellsY;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      if (score[y * cellsX + x] >= cut && cut > 0) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, cellsX, cellsY };
}

// Turn the threshold box into a subject box in frame coordinates. A box that
// swallows (nearly) the whole frame says nothing, so fall back to a centroid
// box around the strongest cluster of score.
function resolveSubjectBox(box, score, cellsX, cellsY) {
  if (!box) return centroidBox(score, cellsX, cellsY);
  const w = (box.x1 - box.x0) / cellsX;
  const h = (box.y1 - box.y0) / cellsY;
  if (w * h >= 0.98 || (w >= 0.99 && h >= 0.99)) return centroidBox(score, cellsX, cellsY);
  const padX = 0.03;
  const padY = 0.03;
  return {
    x0: clamp01(box.x0 / cellsX - padX),
    y0: clamp01(box.y0 / cellsY - padY),
    x1: clamp01(box.x1 / cellsX + padX),
    y1: clamp01(box.y1 / cellsY + padY),
  };
  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }
}

function centroidBox(score, cellsX, cellsY) {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const w = score[y * cellsX + x];
      sw += w;
      sx += w * (x + 0.5);
      sy += w * (y + 0.5);
    }
  }
  const cx = sw > 0 ? sx / sw / cellsX : 0.5;
  const cy = sw > 0 ? sy / sw / cellsY : 0.45;
  const halfW = 0.30;
  const halfH = 0.30;
  return {
    x0: Math.max(0, cx - halfW),
    y0: Math.max(0, cy - halfH),
    x1: Math.min(1, cx + halfW),
    y1: Math.min(1, cy + halfH),
  };
}

// The face is the strongest skin cluster in the upper two thirds of the
// frame. Returns null when no cell is convincingly skin.
function faceBox(skin, cellsX, cellsY) {
  let peak = 0;
  for (const v of skin) if (v > peak) peak = v;
  if (peak < 0.18) return null;
  const cut = peak * 0.55;
  let x0 = cellsX;
  let y0 = cellsY;
  let x1 = -1;
  let y1 = -1;
  const yLimit = Math.ceil(cellsY * 0.72);
  for (let y = 0; y < yLimit; y++) {
    for (let x = 0; x < cellsX; x++) {
      if (skin[y * cellsX + x] >= cut) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return {
    x0: x0 / cellsX,
    y0: y0 / cellsY,
    x1: (x1 + 1) / cellsX,
    y1: (y1 + 1) / cellsY,
  };
}

export function classifyLight({ magentaShare, warmShare, coolShare, avgLum }) {
  if (magentaShare > 0.1) return 'neon';
  if (avgLum < 62 && coolShare > 0.10) return 'night';
  if (warmShare > 0.26) return 'golden';
  if (avgLum < 70) return 'night';
  return 'day';
}

// Where can the title ride? Compare mean score of the top band against the
// bottom band; the emptier one wins.
function emptiestBand(score, cellsX, cellsY) {
  const bandRows = Math.max(2, Math.round(cellsY * 0.22));
  let top = 0;
  let bottom = 0;
  let n = 0;
  for (let y = 0; y < bandRows; y++) {
    for (let x = 0; x < cellsX; x++) {
      top += score[y * cellsX + x];
      bottom += score[(cellsY - 1 - y) * cellsX + x];
      n++;
    }
  }
  return top <= bottom ? 'top' : 'bottom';
}

// A tiny deterministic RNG (mulberry32) so remixes and barcodes are stable
// per seed in the browser and in the screenshot renderer alike.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
