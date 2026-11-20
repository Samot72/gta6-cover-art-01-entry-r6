// render.js — draws a directed cover onto any Canvas 2D context.
//
// The renderer never touches the DOM: the caller passes an `env` with a
// makeCanvas(w, h) factory, plus drawable images. The browser passes
// document-created canvases and HTMLImageElements; the headless screenshot
// tool passes @napi-rs/canvas objects. Same code, same cover.
//
// A cover is built in layers: graded photo panels with white keylines, a
// colour wash and glow in the grade's colours, the title lettering riding
// the photograph's empty band, then the furniture of a real poster — cast
// role tags, press stars and quote, the Director's Cut seal, a barcode and
// the billing block. Every text element has a reserved band so nothing
// collides.

import { applyGradeToPixels, gradeById } from './grades.js';
import { layoutById } from './layouts.js';
import { TITLE_FONT_STACK, titleLines, titleTemplateById } from './titles.js';
import { ROLE_LABEL } from './director.js';

// Face-aware cover-fit: which rectangle of the source photograph fills a
// panel of panelW x panelH, focused on (fx, fy) at the given zoom, clamped
// inside the frame — and shifted, when a face is known, until the whole
// face is inside the crop. The director's promise: never decapitate.
export function computeSourceRect(imgW, imgH, panelW, panelH, fx, fy, zoom, face) {
  const scale = Math.max(panelW / imgW, panelH / imgH) * Math.max(1, zoom);
  let sw = panelW / scale;
  let sh = panelH / scale;
  if (sw > imgW) sw = imgW;
  if (sh > imgH) sh = imgH;
  let sx = fx * imgW - sw / 2;
  let sy = fy * imgH - sh / 2;
  sx = Math.min(Math.max(sx, 0), imgW - sw);
  sy = Math.min(Math.max(sy, 0), imgH - sh);
  if (face) {
    const fx0 = face.x0 * imgW;
    const fy0 = face.y0 * imgH;
    const fx1 = face.x1 * imgW;
    const fy1 = face.y1 * imgH;
    if (fx1 - fx0 <= sw) {
      if (fx0 < sx) sx = fx0;
      if (fx1 > sx + sw) sx = fx1 - sw;
    }
    if (fy1 - fy0 <= sh) {
      if (fy0 < sy) sy = fy0;
      if (fy1 > sy + sh) sy = fy1 - sh;
    }
    sx = Math.min(Math.max(sx, 0), imgW - sw);
    sy = Math.min(Math.max(sy, 0), imgH - sh);
  }
  return { sx, sy, sw, sh };
}

function panelPath(ctx, panel, W, H) {
  const x = panel.x * W;
  const y = panel.y * H;
  const w = panel.w * W;
  const h = panel.h * H;
  ctx.beginPath();
  if (panel.slash !== undefined) {
    const topX = 0.58 * W;
    const botX = (0.58 + panel.slash) * W;
    if (panel.second) {
      ctx.moveTo(topX, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(botX, H);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(topX, 0);
      ctx.lineTo(botX, H);
      ctx.lineTo(0, H);
    }
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }
  return { x, y, w, h };
}

function drawGradedPanel(ctx, env, image, photo, panel, assignment, grade, W, H) {
  const { x, y, w, h } = panelPath(ctx, panel, W, H);
  const pw = Math.max(2, Math.round(w));
  const ph = Math.max(2, Math.round(h));
  const rect = computeSourceRect(
    photo.width,
    photo.height,
    pw,
    ph,
    assignment.fx,
    assignment.fy,
    assignment.zoom,
    photo.analysis.face,
  );
  const tmp = env.makeCanvas(pw, ph);
  const tctx = tmp.getContext('2d');
  tctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, pw, ph);
  const imgData = tctx.getImageData(0, 0, pw, ph);
  applyGradeToPixels(imgData.data, grade);
  tctx.putImageData(imgData, 0, 0);

  ctx.save();
  panelPath(ctx, panel, W, H);
  ctx.clip();
  ctx.drawImage(tmp, x, y);
  ctx.restore();
  return { x, y, w, h };
}

function strokePanel(ctx, panel, W, H) {
  panelPath(ctx, panel, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, W * 0.0022);
  ctx.stroke();
  panelPath(ctx, panel, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(3, W * 0.0042);
  ctx.stroke();
}

function spaced(text) {
  return String(text).split('').join(' ');
}

function fitFont(ctx, lines, maxWidth, startPx, weight, stack) {
  let size = startPx;
  while (size > 10) {
    ctx.font = `${weight} ${size}px ${stack}`;
    let ok = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxWidth) {
        ok = false;
        break;
      }
    }
    if (ok) return size;
    size *= 0.94;
  }
  return size;
}

function drawTitleLine(ctx, line, cx, cy, size, templateDef) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (templateDef.style === 'chrome') {
    const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    grad.addColorStop(0, '#fbfdfe');
    grad.addColorStop(0.32, '#aebfe0');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(0.55, '#5d7ca8');
    grad.addColorStop(0.78, '#c9daf2');
    grad.addColorStop(1, '#7e97bd');
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#0d1b2e';
    ctx.strokeText(line, cx, cy);
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, cy);
  } else if (templateDef.style === 'neon') {
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    ctx.save();
    ctx.shadowColor = templateDef.fill;
    ctx.shadowBlur = size * 0.38;
    ctx.fillStyle = templateDef.fill;
    ctx.fillText(line, cx, cy);
    ctx.fillText(line, cx, cy);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.88;
    ctx.font = `900 ${size * 0.99}px ${TITLE_FONT_STACK}`;
    ctx.fillText(line, cx, cy);
    ctx.globalAlpha = 1;
  } else if (templateDef.style === 'outline') {
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = templateDef.fill;
    ctx.strokeText(line, cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillText(line, cx, cy);
  } else {
    // block: hard offset shadow, flat poster colour
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    ctx.fillStyle = 'rgba(10,10,20,0.55)';
    ctx.fillText(line, cx + size * 0.045, cy + size * 0.05);
    ctx.fillStyle = templateDef.fill;
    ctx.fillText(line, cx, cy);
  }
}

function drawTitle(ctx, plan, W, H) {
  const templateDef = titleTemplateById(plan.titleId);
  const lines = titleLines(templateDef, plan.caption);
  const zoneTop = plan.titleZone === 'top';
  const bandY0 = zoneTop ? H * 0.03 : H * 0.585;
  const bandY1 = zoneTop ? H * 0.315 : H * 0.865;

  // Legibility gradient behind the lettering.
  const grad = ctx.createLinearGradient(0, bandY0, 0, bandY1);
  if (zoneTop) {
    grad.addColorStop(0, 'rgba(5,5,15,0.52)');
    grad.addColorStop(1, 'rgba(5,5,15,0)');
  } else {
    grad.addColorStop(0, 'rgba(5,5,15,0)');
    grad.addColorStop(1, 'rgba(5,5,15,0.55)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY0, W, bandY1 - bandY0);

  const skew = templateDef.id === 'slant-rush' ? -0.06 : 0;
  const maxWidth = W * 0.8;
  const startPx = (bandY1 - bandY0) / Math.max(1, lines.length) / 0.92;
  const size = fitFont(ctx, lines, maxWidth, startPx, 900, TITLE_FONT_STACK);
  const lineH = size * 1.04;
  const totalH = lineH * lines.length;
  let cy = (bandY0 + bandY1) / 2 - totalH / 2 + lineH / 2;

  ctx.save();
  if (skew) {
    ctx.translate(W / 2, (bandY0 + bandY1) / 2);
    ctx.transform(1, 0, Math.tan(skew), 1, 0, 0);
    ctx.translate(-W / 2, -(bandY0 + bandY1) / 2);
  }
  for (const line of lines) {
    drawTitleLine(ctx, line, W / 2, cy, size, templateDef);
    cy += lineH;
  }
  ctx.restore();

  // Tagline under (or over) the title, letterspaced small caps, with a
  // soft shadow so it stays readable where it crosses bright sky.
  ctx.font = `700 ${Math.max(11, H * 0.021)}px ${TITLE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const tagY = zoneTop ? bandY1 + H * 0.028 : bandY0 - H * 0.026;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = Math.max(3, H * 0.006);
  ctx.fillText(spaced(plan.tagline.toUpperCase()), W / 2, tagY);
  ctx.restore();
}

function drawRoleChips(ctx, plan, layout, W, H) {
  const chipAtBottom = plan.titleZone === 'top';
  // The seal owns the top-right corner; a chip that would run under it is
  // moved to the bottom of its own panel instead.
  const sealR = Math.min(W, H) * 0.075;
  const sealBox = {
    x0: W - sealR * 2 - W * 0.018,
    y0: 0,
    x1: W,
    y1: sealR * 2 + H * 0.018,
  };
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const a of plan.assignments) {
    const panel = layout.panels[a.panel];
    if (panel.w < 0.2 || panel.h < 0.14) continue;
    const panelPxW = panel.w * W;
    const fontPx = Math.max(9, Math.min(W, H) * 0.021);
    ctx.font = `800 ${fontPx}px ${TITLE_FONT_STACK}`;
    // Shorten the label until it fits its panel: full cast tag, then role
    // alone, then nothing — a clipped chip is worse than a short one.
    let label =
      a.role === 'location' ? `${ROLE_LABEL.location} · LEONIDA` : `${ROLE_LABEL[a.role]} · ${a.castName}`;
    const maxChipW = panelPxW - W * 0.024;
    if (ctx.measureText(label).width + fontPx * 1.2 > maxChipW) label = ROLE_LABEL[a.role];
    if (ctx.measureText(label).width + fontPx * 1.2 > maxChipW) continue;
    const tw = ctx.measureText(label).width;
    const padX = fontPx * 0.6;
    const chipW = tw + padX * 2;
    const chipH = fontPx * 1.7;
    const cx = panel.x * W + W * 0.012;
    let cy = chipAtBottom
      ? (panel.y + panel.h) * H - chipH - H * 0.012
      : panel.y * H + H * 0.012;
    const hitsSeal = cx < sealBox.x1 && cx + chipW > sealBox.x0 && cy < sealBox.y1 && cy + chipH > sealBox.y0;
    if (hitsSeal && !chipAtBottom) cy = (panel.y + panel.h) * H - chipH - H * 0.012;
    ctx.fillStyle = 'rgba(5,8,18,0.62)';
    ctx.fillRect(cx, cy, chipW, chipH);
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(cx, cy, 3, chipH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx + padX, cy + chipH / 2 + 1);
  }
}

function drawSeal(ctx, W, H) {
  const r = Math.min(W, H) * 0.075;
  const cx = W - r - W * 0.018;
  const cy = r + H * 0.018;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.strokeStyle = '#ffd23c';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.stroke();
  // Star in the middle.
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r * 0.34 : r * 0.15;
    const ang = (Math.PI * i) / spikes - Math.PI / 2;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Circular legend.
  const legend = "DIRECTOR'S CUT • ORIGINAL COVER ART • ";
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${r * 0.19}px ${TITLE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = (Math.PI * 2) / legend.length;
  for (let i = 0; i < legend.length; i++) {
    const ang = step * i - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * r * 0.62, cy + Math.sin(ang) * r * 0.62);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(legend[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawBarcode(ctx, plan, W, H) {
  const bw = W * 0.105;
  const bh = H * 0.052;
  const x = W * 0.016;
  const y = H - bh - H * 0.016;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, bw, bh);
  // Deterministic bars from the plan seed.
  let state = (plan.seed * 2654435761) >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  ctx.fillStyle = '#0a0a0a';
  let bx = x + bw * 0.06;
  const innerW = bw * 0.88;
  while (bx < x + innerW) {
    const barW = 1 + next() * 3;
    if (next() > 0.42) ctx.fillRect(bx, y + bh * 0.1, barW, bh * 0.62);
    bx += barW + 1 + next() * 2;
  }
  ctx.font = `600 ${bh * 0.2}px ${TITLE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText('2 61120 26001 7', x + bw / 2, y + bh * 0.87);
}

function drawRatingBox(ctx, W, H) {
  const s = H * 0.062;
  const x = W - s - W * 0.016;
  const y = H - s - H * 0.016;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, s, s);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${s * 0.52}px ${TITLE_FONT_STACK}`;
  ctx.fillText('18', x + s / 2, y + s * 0.38);
  ctx.font = `700 ${s * 0.13}px ${TITLE_FONT_STACK}`;
  ctx.fillText('LEONIDA BOARD', x + s / 2, y + s * 0.78);
}

function drawBilling(ctx, plan, W, H) {
  const cast = plan.assignments
    .filter((a) => a.role !== 'location')
    .map((a) => a.castName)
    .join('  •  ');
  const line1 = `${cast}  in  “${plan.caption.toUpperCase()}”`;
  const line2 =
    'LEONIDA PICTURES presents a DIRECTOR’S CUT production · photography the owner’s own · graded in the studio · no studio was harmed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 ${Math.max(8, H * 0.0145)}px ${TITLE_FONT_STACK}`;
  ctx.fillText(line1, W / 2, H * 0.955);
  ctx.font = `500 ${Math.max(7, H * 0.0115)}px ${TITLE_FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(line2, W / 2, H * 0.978);
}

function drawPressLine(ctx, plan, W, H) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd23c';
  ctx.font = `${Math.max(12, H * 0.026)}px ${TITLE_FONT_STACK}`;
  const stars = '★★★★★'.slice(0, plan.stars);
  ctx.fillText(stars, W * 0.145, H * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `italic 600 ${Math.max(10, H * 0.017)}px Georgia, serif`;
  ctx.fillText(plan.quote, W * 0.145, H * 0.928);
}

// Draw the whole cover. photos: [{ image, width, height, analysis }] in the
// order the plan's assignments reference them.
export function drawCover(ctx, env, plan, photos, W, H) {
  const grade = gradeById(plan.gradeId);
  const layout = layoutById(plan.layoutId);

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  const rects = [];
  for (const a of plan.assignments) {
    const photo = photos[a.photo];
    const panel = layout.panels[a.panel];
    rects.push(drawGradedPanel(ctx, env, photo.image, photo, panel, a, grade, W, H));
  }
  for (const panel of layout.panels) strokePanel(ctx, panel, W, H);

  // Colour wash + glow in the grade's colours.
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'overlay';
  } catch {
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const heroRect = rects[0] || { x: 0, y: 0, w: W, h: H };
  const glow = ctx.createRadialGradient(
    heroRect.x + heroRect.w / 2,
    heroRect.y + heroRect.h / 2,
    10,
    heroRect.x + heroRect.w / 2,
    heroRect.y + heroRect.h / 2,
    Math.max(heroRect.w, heroRect.h) * 0.75,
  );
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'screen';
  } catch {
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Vignette.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawRoleChips(ctx, plan, layout, W, H);
  drawTitle(ctx, plan, W, H);
  drawSeal(ctx, W, H);
  drawPressLine(ctx, plan, W, H);
  drawBarcode(ctx, plan, W, H);
  drawRatingBox(ctx, W, H);
  drawBilling(ctx, plan, W, H);
  return { rects };
}

export function renderCoverCanvas(env, plan, photos, W, H) {
  const canvas = env.makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawCover(ctx, env, plan, photos, W, H);
  return canvas;
}
