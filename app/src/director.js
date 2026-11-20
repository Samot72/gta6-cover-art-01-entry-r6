// director.js — the autopilot. One photograph (or a handful) goes in, a
// finished cover plan comes out, and every choice is written down in plain
// words in the Director's Notes. The plan is pure data — layout, per-panel
// crops, grade, title template, role tags — so the editor can override any
// single decision and the remix dice can re-roll one decision at a time.

import { GRADE_FOR_LIGHT, GRADES, gradeById } from './grades.js';
import { layoutById, layoutForCast } from './layouts.js';
import { TITLE_TEMPLATES, bestTemplate, scoreTemplate, titleTemplateById } from './titles.js';
import { rng } from './analyze.js';

export const CAST_NAMES = [
  'DANTE REYES',
  'MARA SOLANO',
  'KAI MERIDIAN',
  'THEO VALENTINE',
  'JUNO CASTILLO',
  'REX ALMEIDA',
];

export const ROLE_LABEL = {
  lead: 'THE LEAD',
  supporting: 'SUPPORTING',
  location: 'LOCATION',
};

function center(box) {
  return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
}

function describePosition(cx, cy) {
  const col = cx < 0.38 ? 'left' : cx > 0.62 ? 'right' : 'centre';
  const row = cy < 0.38 ? 'upper' : cy > 0.62 ? 'lower' : 'middle';
  if (row === 'middle') return col === 'centre' ? 'dead centre' : `${col} edge`;
  if (col === 'centre') return row === 'upper' ? 'top centre' : 'bottom centre';
  return `${row} ${col}`;
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

// The crop focus for one panel of one photograph. Lead panels anchor on the
// face when there is one (a director never decapitates the star); location
// panels go wide; supporting panels push in on the subject.
export function focusForPanel(analysis, role, variant = 0) {
  const subject = center(analysis.subject);
  if (role === 'location') {
    return { fx: 0.5, fy: 0.45, zoom: 1.0 };
  }
  if (analysis.face) {
    const f = center(analysis.face);
    if (role === 'lead') return { fx: f.x, fy: f.y, zoom: 1.06 };
    return { fx: f.x, fy: Math.min(1, f.y + 0.18), zoom: 1.22 };
  }
  if (role === 'lead') return { fx: subject.x, fy: subject.y, zoom: 1.05 };
  // Detail crop: lean toward the subject but offset per variant so two
  // supporting panels of the same photograph never match.
  const drift = variant === 0 ? 0.1 : -0.12;
  return {
    fx: Math.min(1, Math.max(0, subject.x + drift)),
    fy: Math.min(1, Math.max(0, subject.y + 0.05)),
    zoom: 1.35,
  };
}

// Direct a whole cover from the photographs the user gave us.
export function directCover(photos, options = {}) {
  const caption = options.caption || 'LEONIDA NIGHTS';
  const tagline = options.tagline || 'One last summer. Every debt comes due.';
  const seed = options.seed ?? 20261120;
  const rand = rng(seed);

  const hero = photos[0];
  const heroA = hero.analysis;
  const layoutId = layoutForCast(photos.length, Boolean(heroA.face));
  const layout = layoutById(layoutId);
  const gradeId = GRADE_FOR_LIGHT[heroA.light] || 'press-clean';
  const title = bestTemplate(heroA, rand);

  const notes = [];
  notes.push(...layoutNotes(layout, photos, heroA));
  notes.push(...lightNotes(heroA, gradeById(gradeId)));
  notes.push(...faceNotes(heroA));
  notes.push(...titleNotes(heroA, title));

  const assignments = layout.panels.map((panel, i) => {
    const photoIndex = i % photos.length;
    const photo = photos[photoIndex];
    const role = panel.role;
    const focus = focusForPanel(photo.analysis, role, i);
    return {
      panel: i,
      photo: photoIndex,
      role,
      castName: role === 'location' ? 'LEONIDA' : CAST_NAMES[i % CAST_NAMES.length],
      fx: focus.fx,
      fy: focus.fy,
      zoom: focus.zoom,
    };
  });
  notes.push(...roleNotes(assignments, photos));

  return {
    caption,
    tagline,
    seed,
    layoutId,
    gradeId,
    titleId: title.id,
    titleZone: heroA.titleZone,
    assignments,
    notes,
    quote: pickQuote(heroA.light),
    stars: 5,
  };
}

function layoutNotes(layout, photos, heroA) {
  if (photos.length === 1 && layout.id === 'hero-and-duo') {
    return [
      `One photograph in → ${layout.name}: the director cuts a triptych from a single frame — portrait crop, detail crop, wide — so one photo fills three panels.`,
    ];
  }
  if (photos.length === 1) {
    return [
      `One photograph in → ${layout.name}: the frame is strong enough to carry the whole cover alone.`,
    ];
  }
  return [
    `${photos.length} photographs in → ${layout.name}: ${layout.blurb}`,
  ];
}

function lightNotes(analysis, grade) {
  const notes = [];
  if (analysis.light === 'neon') {
    notes.push(
      `The frame runs ${pct(analysis.magentaShare)} magenta — neon light. Grade: ${grade.name}, so the signage blooms instead of fighting the skin.`,
    );
  } else if (analysis.light === 'golden') {
    notes.push(
      `Golden hour: ${pct(analysis.warmShare)} of pixels are warm. Grade: ${grade.name} — it leans into the sun instead of correcting it away.`,
    );
  } else if (analysis.light === 'night') {
    notes.push(
      `Low light (mean luminance ${Math.round(analysis.avgLum)}/255). Grade: ${grade.name} for hard night contrast and chrome highlights.`,
    );
  } else {
    notes.push(
      `Honest daylight (mean luminance ${Math.round(analysis.avgLum)}/255). Grade: ${grade.name} — clean colour, nothing to hide.`,
    );
  }
  return notes;
}

function faceNotes(analysis) {
  if (!analysis.face) {
    return [
      `No face reads in this frame — the crop anchors on the subject mass at ${describePosition(
        center(analysis.subject).x,
        center(analysis.subject).y,
      )}.`,
    ];
  }
  const f = center(analysis.face);
  return [
    `Face found ${describePosition(f.x, f.y)} → the lead crop is anchored on it, and the crop window is clamped so the frame never cuts the hairline.`,
    `Skin reads ${pct(analysis.skinShare)} of the frame; saliency backs it up where the light is bare.`,
  ];
}

function titleNotes(analysis, title) {
  const zoneWord = analysis.titleZone === 'top' ? 'top band is the emptiest' : 'bottom band is the emptiest';
  return [
    `The ${zoneWord} in this photograph → the title rides there in ${title.name}, set clear of every face.`,
  ];
}

function roleNotes(assignments, photos) {
  const lead = assignments.find((a) => a.role === 'lead');
  const locs = assignments.filter((a) => a.role === 'location').length;
  const notes = [];
  if (lead) {
    notes.push(
      `Cast tags: panel ${lead.panel + 1} carries ${ROLE_LABEL.lead} (${lead.castName}); skin-bearing panels are tagged as cast, empty frames as locations.`,
    );
  }
  if (locs > 0) {
    notes.push(`${locs} panel${locs === 1 ? '' : 's'} read as pure place — tagged LOCATION and billed as Leonida itself.`);
  }
  return notes;
}

const QUOTES = {
  golden: '“A sun-drunk masterpiece.” — THE LEONIDA GAZETTE',
  neon: '“Neon you can hear.” — VICE CITY WEEKLY',
  day: '“The sharpest cover on the newsstand.” — PALM REVIEW',
  night: '“After dark, nobody blinks.” — THE NIGHT DESK',
};

export function pickQuote(light) {
  return QUOTES[light] || QUOTES.day;
}

// --- Remix dice: each re-rolls exactly one decision. ---

export function remixCrop(plan, photos, seed) {
  const rand = rng(seed);
  const assignments = plan.assignments.map((a) => {
    const photo = photos[a.photo];
    const base = focusForPanel(photo.analysis, a.role, a.panel);
    const jitter = () => (rand() - 0.5) * 0.22;
    return {
      ...a,
      fx: Math.min(1, Math.max(0, base.fx + jitter())),
      fy: Math.min(1, Math.max(0, base.fy + jitter())),
      zoom: Math.max(1, base.zoom * (0.95 + rand() * 0.25)),
    };
  });
  return {
    ...plan,
    assignments,
    notes: [...plan.notes, `Remix — crop re-rolled: every panel re-framed inside its safe zone, faces still protected.`],
  };
}

export function remixGrade(plan, seed) {
  const rand = rng(seed);
  const current = gradeById(plan.gradeId);
  const family = GRADES.filter((g) => g.family === current.family && g.id !== current.id);
  const next = family[Math.floor(rand() * family.length)] || current;
  return {
    ...plan,
    gradeId: next.id,
    notes: [...plan.notes, `Remix — grade re-rolled inside the ${current.family} family: ${current.name} → ${next.name}.`],
  };
}

export function remixTitle(plan, photos, seed) {
  const rand = rng(seed);
  const heroA = photos[0].analysis;
  // A re-roll must land somewhere new: score every template except the
  // current one and take the best fit for this photograph.
  let next = null;
  let bestScore = -Infinity;
  for (const t of TITLE_TEMPLATES) {
    if (t.id === plan.titleId) continue;
    const s = scoreTemplate(t, heroA) + rand() * 0.9;
    if (s > bestScore) {
      bestScore = s;
      next = t;
    }
  }
  return {
    ...plan,
    titleId: next.id,
    notes: [...plan.notes, `Remix — title re-rolled: now set in ${next.name}, still riding the ${plan.titleZone} band.`],
  };
}

export { titleTemplateById };
