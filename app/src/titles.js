// titles.js — twenty title treatments the director can set a caption in.
//
// A template turns the poster's caption into display lines and declares a
// lettering style: chrome (striped metal gradient), neon (glow sign), block
// (flat poster colour), outline (hollow display type) or stencil. The
// renderer does the drawing; templates stay pure data plus a line splitter,
// so the director can score every template against a photo's empty band and
// the remix dice can re-roll the title without touching the crop or grade.

export const TITLE_FONT_STACK = '"CoverHeavy","Arial Black","Archivo Black",Impact,"Franklin Gothic Heavy",sans-serif';

function words(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
}

// Split a caption into display lines the way the template likes it.
function splitLines(caption, mode) {
  const ws = words(caption);
  if (ws.length === 0) return ['LEONIDA'];
  if (mode === 'single' || ws.length === 1) return [ws.join(' ')];
  if (mode === 'stack') {
    const mid = Math.ceil(ws.length / 2);
    return [ws.slice(0, mid).join(' '), ws.slice(mid).join(' ')].filter(Boolean);
  }
  if (mode === 'each') return ws;
  return [ws.join(' ')];
}

function template(id, name, style, fill, zone, split) {
  return { id, name, style, fill, zone, split };
}

export const TITLE_TEMPLATES = [
  template('chrome-stack', 'Chrome Stack', 'chrome', '#e8f2ff', 'bottom', 'stack'),
  template('chrome-one', 'Chrome Marquee', 'chrome', '#ffe9a8', 'top', 'single'),
  template('neon-sign', 'Neon Sign', 'neon', '#ff5da2', 'top', 'single'),
  template('neon-stack', 'Neon Stack', 'neon', '#22d3ee', 'bottom', 'stack'),
  template('block-poster', 'Block Poster', 'block', '#ffffff', 'bottom', 'stack'),
  template('block-sun', 'Sun Block', 'block', '#ffd23c', 'top', 'single'),
  template('outline-ghost', 'Ghost Outline', 'outline', '#ffffff', 'bottom', 'single'),
  template('outline-stack', 'Hollow Stack', 'outline', '#a5f3fc', 'top', 'stack'),
  template('stencil-army', 'Stencil', 'block', '#f8fafc', 'bottom', 'each'),
  template('slant-rush', 'Slant Rush', 'chrome', '#fecdd3', 'bottom', 'single'),
  template('drive-in', 'Drive-In', 'neon', '#fbbf24', 'top', 'stack'),
  template('high-noon', 'High Noon', 'block', '#fff7ed', 'top', 'single'),
  template('lowrider', 'Lowrider Script', 'chrome', '#fbcfe8', 'bottom', 'single'),
  template('heatwave', 'Heatwave', 'block', '#ff7847', 'bottom', 'stack'),
  template('vice-serif', 'Vice Serif', 'block', '#fef3c7', 'top', 'single'),
  template('chrome-band', 'Chrome Band', 'chrome', '#dbeafe', 'bottom', 'single'),
  template('neon-band', 'Neon Band', 'neon', '#a3e635', 'bottom', 'single'),
  template('poster-max', 'Poster Max', 'block', '#ffffff', 'bottom', 'each'),
  template('skyline', 'Skyline', 'outline', '#fde68a', 'top', 'single'),
  template('finale', 'Finale', 'chrome', '#ffffff', 'bottom', 'stack'),
];

export function titleTemplateById(id) {
  return TITLE_TEMPLATES.find((t) => t.id === id) || TITLE_TEMPLATES[0];
}

export function titleLines(templateDef, caption) {
  return splitLines(caption, templateDef.split);
}

// Score a template for a photograph: does its preferred zone match the
// photo's empty band, and does its fill family suit the light? Higher wins.
export function scoreTemplate(templateDef, analysis) {
  let score = 0;
  if (templateDef.zone === analysis.titleZone) score += 2;
  if (analysis.light === 'neon' && templateDef.style === 'neon') score += 2;
  if (analysis.light === 'golden' && templateDef.style === 'chrome') score += 2;
  if (analysis.light === 'day' && templateDef.style === 'block') score += 1;
  if (analysis.light === 'night' && templateDef.style === 'outline') score += 1;
  return score;
}

export function bestTemplate(analysis, rngFn) {
  let best = TITLE_TEMPLATES[0];
  let bestScore = -Infinity;
  for (const t of TITLE_TEMPLATES) {
    const s = scoreTemplate(t, analysis) + rngFn() * 0.9; // a whisper of taste
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best;
}
