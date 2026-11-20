// grades.js — the colour grades of the Director's Cut studio.
//
// A grade is pure numbers: a per-pixel transform (exposure, contrast,
// saturation, temperature, tint, lift) plus two canvas overlays the renderer
// paints on top (a colour wash and a glow colour). Keeping grades as data
// means the director can pick one from the photo's light, the remix dice can
// re-roll inside a family, and the same transform runs in the browser and in
// the headless renderer.

export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    family: 'warm',
    blurb: 'Golden-hour warmth, teal shadows, sun baked into the skin.',
    exposure: 1.06,
    contrast: 1.12,
    saturation: 1.28,
    temperature: 0.10,
    tint: 0.03,
    lift: 0.012,
    wash: '#ff9a3c',
    washAlpha: 0.13,
    glow: '#ffb347',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    family: 'neon',
    blurb: 'Magenta signage and cyan spill over wet-night blacks.',
    exposure: 1.03,
    contrast: 1.18,
    saturation: 1.38,
    temperature: -0.05,
    tint: 0.14,
    lift: 0.008,
    wash: '#ff2e88',
    washAlpha: 0.12,
    glow: '#22d3ee',
  },
  {
    id: 'press-clean',
    name: 'Press Clean',
    family: 'clean',
    blurb: 'Daylight, honest colour — the newsstand proof.',
    exposure: 1.02,
    contrast: 1.05,
    saturation: 1.08,
    temperature: 0.01,
    tint: 0.0,
    lift: 0.004,
    wash: '#ffffff',
    washAlpha: 0.04,
    glow: '#ffe9b8',
  },
  {
    id: 'midnight-chrome',
    name: 'Midnight Chrome',
    family: 'cool',
    blurb: 'Blue steel night, hard contrast, chrome highlights.',
    exposure: 0.99,
    contrast: 1.24,
    saturation: 1.05,
    temperature: -0.13,
    tint: -0.02,
    lift: 0.0,
    wash: '#3b82f6',
    washAlpha: 0.10,
    glow: '#93c5fd',
  },
  {
    id: 'coral-heat',
    name: 'Coral Heat',
    family: 'warm',
    blurb: 'Orange and teal blockbuster heat, skin pushed coral.',
    exposure: 1.05,
    contrast: 1.14,
    saturation: 1.32,
    temperature: 0.13,
    tint: -0.03,
    lift: 0.01,
    wash: '#fb7185',
    washAlpha: 0.11,
    glow: '#fdba74',
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    family: 'neon',
    blurb: 'Purple haze grade — club light at 3 a.m.',
    exposure: 1.02,
    contrast: 1.16,
    saturation: 1.34,
    temperature: -0.02,
    tint: 0.18,
    lift: 0.014,
    wash: '#a855f7',
    washAlpha: 0.13,
    glow: '#e879f9',
  },
  {
    id: 'bleach-bypass',
    name: 'Bleach Bypass',
    family: 'cool',
    blurb: 'Silver-retention grit: drained colour, iron contrast.',
    exposure: 1.0,
    contrast: 1.3,
    saturation: 0.62,
    temperature: -0.04,
    tint: 0.0,
    lift: 0.006,
    wash: '#cbd5e1',
    washAlpha: 0.05,
    glow: '#e2e8f0',
  },
  {
    id: 'retro-print',
    name: 'Retro Print',
    family: 'clean',
    blurb: 'Faded 1986 newsprint: lifted blacks, gentle colour.',
    exposure: 1.04,
    contrast: 0.92,
    saturation: 0.88,
    temperature: 0.07,
    tint: 0.02,
    lift: 0.055,
    wash: '#fde68a',
    washAlpha: 0.08,
    glow: '#fef3c7',
  },
  {
    id: 'palmline-gold',
    name: 'Palmline Gold',
    family: 'warm',
    blurb: 'Champagne gold top light, poster-print richness.',
    exposure: 1.08,
    contrast: 1.1,
    saturation: 1.22,
    temperature: 0.08,
    tint: 0.05,
    lift: 0.018,
    wash: '#f59e0b',
    washAlpha: 0.12,
    glow: '#fde68a',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// The grade the director reaches for, per kind of light the analyser found.
export const GRADE_FOR_LIGHT = {
  golden: 'vice-sunset',
  neon: 'neon-nights',
  day: 'press-clean',
  night: 'midnight-chrome',
};

// Apply a grade to an RGBA pixel buffer in place. Deliberately simple maths
// so a 1920x1080 export grades in well under a second.
export function applyGradeToPixels(data, grade) {
  const { exposure, contrast, saturation, temperature, tint, lift } = grade;
  const lift255 = lift * 255;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure then contrast around mid grey.
    r = (r * exposure - 128) * contrast + 128;
    g = (g * exposure - 128) * contrast + 128;
    b = (b * exposure - 128) * contrast + 128;

    // Saturation around the pixel's own luminance.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;

    // Temperature (red vs blue) and tint (green vs magenta), then lift.
    r += temperature * 28 + lift255;
    g += tint * -18 + lift255;
    b += -temperature * 28 + lift255;

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}
