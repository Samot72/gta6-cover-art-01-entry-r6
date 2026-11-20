// main.js — the Director's Cut editor.
//
// Flow: load photographs (your own, read locally, or the shipped samples) →
// press DIRECT IT → the autopilot analyses each frame (saliency, skin,
// light), picks layout, crops, grade and title, tags the cast, and writes
// its Director's Notes. From there you can override any single decision,
// re-roll one decision at a time with the dice, inspect the showcase
// scenes, and export the cover as a PNG in the three post sizes.

import { analyzePhoto } from './analyze.js';
import {
  CAST_NAMES,
  directCover,
  focusForPanel,
  remixCrop,
  remixGrade,
  remixTitle,
} from './director.js';
import { GRADES } from './grades.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { TITLE_TEMPLATES } from './titles.js';
import { drawCover, renderCoverCanvas } from './render.js';
import { drawBeforeAfterScene, drawNotesScene, drawRemixScene } from './scenes.js';

const env = {
  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
};

const SAMPLES = {
  hero: { file: 'samples/hero.jpg', label: 'Sunset Hero' },
  driver: { file: 'samples/driver.jpg', label: 'Neon Driver' },
  hotel: { file: 'samples/hotel.jpg', label: 'Hotel Neon' },
  rider: { file: 'samples/rider.jpg', label: 'Pier Rider' },
};

const state = {
  photos: [], // { id, name, image, width, height, analysis }
  plan: null,
  view: 'cover',
  seed: 20261120,
  nextPhotoId: 1,
};

const $ = (id) => document.getElementById(id);
const stage = $('stage');

// --- photograph intake -------------------------------------------------

function analyzeImage(image) {
  const w = 160;
  const h = Math.max(8, Math.round((w * image.naturalHeight) / image.naturalWidth));
  const c = env.makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return analyzePhoto({ data: data.data, width: w, height: h });
}

function addPhoto(image, name) {
  const photo = {
    id: state.nextPhotoId++,
    name,
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    analysis: analyzeImage(image),
  };
  state.photos.push(photo);
  state.plan = null;
  ensurePlan();
  refreshChrome();
  render();
}

function loadImageFrom(src, name) {
  const image = new Image();
  image.onload = () => addPhoto(image, name);
  image.src = src;
}

function ensurePlan() {
  if (!state.plan && state.photos.length > 0) {
    state.plan = directCover(state.photos, {
      caption: $('captionInput').value,
      tagline: $('taglineInput').value,
      seed: state.seed,
    });
  }
}

// --- rendering -----------------------------------------------------------

function render() {
  const ctx = stage.getContext('2d');
  const W = stage.width;
  const H = stage.height;
  if (state.photos.length === 0 || !state.plan) {
    ctx.fillStyle = '#0b0e1d';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd23c';
    ctx.font = '900 34px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOAD A PHOTOGRAPH', W / 2, H / 2 - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 17px "Segoe UI", sans-serif';
    ctx.fillText('The director is waiting. One photo is enough.', W / 2, H / 2 + 24);
    return;
  }
  const { plan, photos } = state;
  if (state.view === 'cover') {
    drawCover(ctx, env, plan, photos, W, H);
  } else if (state.view === 'notes') {
    drawNotesScene(ctx, env, plan, photos, W, H);
  } else if (state.view === 'beforeafter') {
    drawBeforeAfterScene(ctx, env, plan, photos, W, H);
  } else if (state.view === 'remix') {
    const variants = [
      remixCrop(plan, photos, state.seed + 11),
      remixGrade(plan, state.seed + 23),
      remixTitle(plan, photos, state.seed + 37),
    ];
    drawRemixScene(ctx, env, variants, photos, W, H);
  }
}

// --- chrome (lists, selects, notes) --------------------------------------

function refreshChrome() {
  const list = $('photoList');
  list.innerHTML = '';
  for (const photo of state.photos) {
    const li = document.createElement('li');
    const a = photo.analysis;
    const meta = `${photo.width}×${photo.height} · ${a.light} light${a.face ? ' · face found' : ''}`;
    li.innerHTML = `<span>${photo.name}<br><span class="meta">${meta}</span></span>`;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.onclick = () => {
      state.photos = state.photos.filter((p) => p.id !== photo.id);
      state.plan = null;
      ensurePlan();
      refreshChrome();
      render();
    };
    li.appendChild(del);
    list.appendChild(li);
  }

  const notes = $('notesList');
  notes.innerHTML = '';
  if (state.plan) {
    for (const note of state.plan.notes) {
      const li = document.createElement('li');
      li.textContent = note;
      notes.appendChild(li);
    }
  }
  refreshOverridePanel();
}

function fillSelect(select, items, current) {
  select.innerHTML = '';
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    if (item.id === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function refreshOverridePanel() {
  if (!state.plan) return;
  fillSelect($('layoutSelect'), LAYOUTS, state.plan.layoutId);
  fillSelect($('gradeSelect'), GRADES, state.plan.gradeId);
  fillSelect($('titleSelect'), TITLE_TEMPLATES, state.plan.titleId);
  const panelSelect = $('panelSelect');
  panelSelect.innerHTML = '';
  state.plan.assignments.forEach((a, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Panel ${i + 1} — photo ${a.photo + 1}`;
    panelSelect.appendChild(opt);
  });
  syncPanelEditors();
}

function currentAssignment() {
  if (!state.plan) return null;
  const idx = Number($('panelSelect').value || 0);
  return state.plan.assignments[idx] || state.plan.assignments[0];
}

function syncPanelEditors() {
  const a = currentAssignment();
  if (!a) return;
  $('roleSelect').value = a.role;
  $('castInput').value = a.castName;
  $('fxRange').value = a.fx;
  $('fyRange').value = a.fy;
  $('zoomRange').value = a.zoom;
}

// Rebuild panel assignments for a different layout, keeping the director's
// focus logic, so an override never strands a panel without a photograph.
function applyLayout(layoutId) {
  const plan = state.plan;
  const layout = layoutById(layoutId);
  plan.layoutId = layoutId;
  plan.assignments = layout.panels.map((panel, i) => {
    const photoIndex = i % state.photos.length;
    const photo = state.photos[photoIndex];
    const focus = focusForPanel(photo.analysis, panel.role, i);
    return {
      panel: i,
      photo: photoIndex,
      role: panel.role,
      castName: panel.role === 'location' ? 'LEONIDA' : CAST_NAMES[i % CAST_NAMES.length],
      fx: focus.fx,
      fy: focus.fy,
      zoom: focus.zoom,
    };
  });
  plan.notes = [...plan.notes, `Override — layout changed by hand to ${layout.name}; crops re-anchored by the same face-aware rules.`];
  refreshChrome();
  render();
}

// --- events ---------------------------------------------------------------

$('fileInput').addEventListener('change', (ev) => {
  for (const file of ev.target.files) {
    loadImageFrom(URL.createObjectURL(file), file.name);
  }
  ev.target.value = '';
});

$('sampleRow').addEventListener('click', (ev) => {
  const key = ev.target.dataset?.sample;
  if (!key) return;
  const sample = SAMPLES[key];
  loadImageFrom(sample.file, sample.label);
});

$('directBtn').addEventListener('click', () => {
  if (state.photos.length === 0) return;
  state.seed = (Date.now() % 100000) + 7;
  state.plan = directCover(state.photos, {
    caption: $('captionInput').value,
    tagline: $('taglineInput').value,
    seed: state.seed,
  });
  refreshChrome();
  render();
});

$('captionInput').addEventListener('input', () => {
  if (state.plan) state.plan.caption = $('captionInput').value || 'LEONIDA NIGHTS';
  render();
});
$('taglineInput').addEventListener('input', () => {
  if (state.plan) state.plan.tagline = $('taglineInput').value;
  render();
});

$('diceCrop').addEventListener('click', () => {
  if (!state.plan) return;
  state.plan = remixCrop(state.plan, state.photos, (Date.now() % 90000) + 3);
  refreshChrome();
  render();
});
$('diceGrade').addEventListener('click', () => {
  if (!state.plan) return;
  state.plan = remixGrade(state.plan, (Date.now() % 90000) + 5);
  refreshChrome();
  render();
});
$('diceTitle').addEventListener('click', () => {
  if (!state.plan) return;
  state.plan = remixTitle(state.plan, state.photos, (Date.now() % 90000) + 9);
  refreshChrome();
  render();
});

document.querySelectorAll('.view-tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tabs .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.view = tab.dataset.view;
    render();
  });
});

$('layoutSelect').addEventListener('change', () => applyLayout($('layoutSelect').value));
$('gradeSelect').addEventListener('change', () => {
  state.plan.gradeId = $('gradeSelect').value;
  render();
});
$('titleSelect').addEventListener('change', () => {
  state.plan.titleId = $('titleSelect').value;
  render();
});
$('panelSelect').addEventListener('change', syncPanelEditors);
$('roleSelect').addEventListener('change', () => {
  const a = currentAssignment();
  if (a) a.role = $('roleSelect').value;
  render();
});
$('castInput').addEventListener('input', () => {
  const a = currentAssignment();
  if (a) a.castName = $('castInput').value.toUpperCase() || a.castName;
  render();
});
for (const [id, key] of [['fxRange', 'fx'], ['fyRange', 'fy'], ['zoomRange', 'zoom']]) {
  $(id).addEventListener('input', () => {
    const a = currentAssignment();
    if (a) a[key] = Number($(id).value);
    render();
  });
}

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.plan) return;
    const [w, h] = btn.dataset.export.split('x').map(Number);
    const canvas = renderCoverCanvas(env, state.plan, state.photos, w, h);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `directors-cut-cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      $('exportNote').textContent = `Exported ${w}×${h} PNG.`;
    }, 'image/png');
  });
});

// Boot with the sunset sample so the studio opens on a directed cover.
loadImageFrom(SAMPLES.hero.file, SAMPLES.hero.label);
render();
