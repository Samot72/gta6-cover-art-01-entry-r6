// scenes.js — the studio's showcase scenes.
//
// The editor's Showcase view paints these full-canvas scenes, and the
// maker's screenshots are the same scenes drawn headlessly: the cover
// itself, the Director's Notes audit, the before/after of the autopilot,
// and the remix wall. Nothing here is a mock-up — every scene is drawn from
// a live plan and the user's real photographs.

import { drawCover, renderCoverCanvas } from './render.js';
import { gradeById } from './grades.js';
import { layoutById } from './layouts.js';
import { TITLE_FONT_STACK, titleTemplateById } from './titles.js';

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function backdrop(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0b0e1d');
  grad.addColorStop(0.55, '#131033');
  grad.addColorStop(1, '#2a0f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function sceneHeading(ctx, W, title, sub) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd23c';
  ctx.font = `900 ${Math.round(W * 0.032)}px ${TITLE_FONT_STACK}`;
  ctx.fillText(title, W * 0.035, W * 0.052);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.round(W * 0.016)}px ${TITLE_FONT_STACK}`;
  ctx.fillText(sub, W * 0.035, W * 0.052 + W * 0.03);
}

// The finished cover, full bleed — screenshot one.
export function drawCoverScene(ctx, env, plan, photos, W, H) {
  drawCover(ctx, env, plan, photos, W, H);
}

// Cover at the left in its 4:5 poster shape; the audit at the right.
export function drawNotesScene(ctx, env, plan, photos, W, H) {
  backdrop(ctx, W, H);
  sceneHeading(ctx, W, "DIRECTOR'S NOTES", 'Every autopilot decision, audited in plain words.');

  const coverW = Math.round(H * 0.52);
  const coverH = Math.round(coverW * 1.25);
  const coverX = Math.round(W * 0.035);
  const coverY = Math.round(H * 0.16);
  const coverCanvas = renderCoverCanvas(env, plan, photos, 864, 1080);
  ctx.drawImage(coverCanvas, coverX, coverY, coverW, coverH);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(coverX, coverY, coverW, coverH);

  const panelX = coverX + coverW + W * 0.03;
  const panelW = W - panelX - W * 0.035;
  let y = coverY + 6;

  // Decision chips.
  const chips = [
    ['LAYOUT', layoutById(plan.layoutId).name],
    ['GRADE', gradeById(plan.gradeId).name],
    ['TITLE', titleTemplateById(plan.titleId).name],
    ['TITLE BAND', plan.titleZone.toUpperCase()],
  ];
  ctx.textBaseline = 'alphabetic';
  for (const [k, v] of chips) {
    ctx.font = `800 ${Math.round(W * 0.0135)}px ${TITLE_FONT_STACK}`;
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(k, panelX, y + W * 0.016);
    const keyWidth = ctx.measureText(k).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(v, panelX + keyWidth + W * 0.018, y + W * 0.016);
    y += W * 0.028;
  }
  y += W * 0.012;

  ctx.font = `500 ${Math.round(W * 0.0155)}px Georgia, serif`;
  for (const note of plan.notes) {
    const lines = wrapText(ctx, `•  ${note}`, panelW);
    for (const line of lines) {
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fillText(line, panelX, y + W * 0.016);
      y += W * 0.0235;
    }
    y += W * 0.01;
    if (y > H - W * 0.03) break;
  }
}

// Raw photograph on the left, finished cover on the right, one arrow.
export function drawBeforeAfterScene(ctx, env, plan, photos, W, H) {
  backdrop(ctx, W, H);
  sceneHeading(ctx, W, 'ONE PHOTO IN. COVER OUT.', 'The autopilot, before and after — no manual steps between.');

  const photo = photos[0];
  const boxH = Math.round(H * 0.72);
  const boxW = Math.round(boxH * 0.8);
  const y = Math.round(H * 0.17);
  const leftX = Math.round(W * 0.045);
  const rightX = Math.round(W - boxW - W * 0.045);

  // Raw: plain cover-fit draw, no grade, no furniture.
  ctx.save();
  ctx.beginPath();
  ctx.rect(leftX, y, boxW, boxH);
  ctx.clip();
  const scale = Math.max(boxW / photo.width, boxH / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  ctx.drawImage(photo.image, leftX + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, y, boxW, boxH);

  const coverCanvas = renderCoverCanvas(env, plan, photos, 864, 1080);
  ctx.drawImage(coverCanvas, rightX, y, boxW, boxH);
  ctx.strokeStyle = '#ffd23c';
  ctx.strokeRect(rightX, y, boxW, boxH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(W * 0.02)}px ${TITLE_FONT_STACK}`;
  ctx.fillText('RAW — AS SHOT', leftX + boxW / 2, y + boxH + W * 0.032);
  ctx.fillStyle = '#ffd23c';
  ctx.fillText('DIRECTED — ONE CLICK', rightX + boxW / 2, y + boxH + W * 0.032);

  // The arrow.
  const midX = W / 2;
  const midY = y + boxH / 2;
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(midX - W * 0.028, midY - W * 0.012);
  ctx.lineTo(midX + W * 0.008, midY - W * 0.012);
  ctx.lineTo(midX + W * 0.008, midY - W * 0.03);
  ctx.lineTo(midX + W * 0.036, midY);
  ctx.lineTo(midX + W * 0.008, midY + W * 0.03);
  ctx.lineTo(midX + W * 0.008, midY + W * 0.012);
  ctx.lineTo(midX - W * 0.028, midY + W * 0.012);
  ctx.closePath();
  ctx.fill();
}

// Three re-rolled covers of the same photographs, side by side.
export function drawRemixScene(ctx, env, variants, photos, W, H) {
  backdrop(ctx, W, H);
  sceneHeading(ctx, W, 'REMIX WALL', 'Three dice — crop, grade, title — each re-rolls one decision, never the whole cover.');

  const gap = W * 0.025;
  const cardW = (W - gap * 4) / 3;
  const cardH = cardW * 1.25;
  const y = H * 0.17;
  const labels = ['A — CROP RE-ROLLED', 'B — GRADE RE-ROLLED', 'C — TITLE RE-ROLLED'];
  variants.forEach((variantPlan, i) => {
    const x = gap + i * (cardW + gap);
    const c = renderCoverCanvas(env, variantPlan, photos, 576, 720);
    ctx.drawImage(c, x, y, cardW, cardH);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23c';
    ctx.font = `900 ${Math.round(W * 0.016)}px ${TITLE_FONT_STACK}`;
    ctx.fillText(labels[i], x + cardW / 2, y + cardH + W * 0.03);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `600 ${Math.round(W * 0.0125)}px ${TITLE_FONT_STACK}`;
    ctx.fillText(
      `${layoutById(variantPlan.layoutId).name} · ${gradeById(variantPlan.gradeId).name} · ${titleTemplateById(variantPlan.titleId).name}`,
      x + cardW / 2,
      y + cardH + W * 0.055,
    );
  });
}
