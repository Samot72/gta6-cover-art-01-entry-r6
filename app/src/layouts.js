// layouts.js — the panel arrangements of the Director's Cut studio.
//
// Panels are rectangles in 0..1 cover coordinates. A layout also suggests
// where its title wants to live; the director may overrule that with the
// photo's own empty band. `slash` panels are clipped to a diagonal polygon
// by the renderer — the GTA poster lean.

export const LAYOUTS = [
  {
    id: 'solo-hero',
    name: 'Solo Hero',
    blurb: 'One photograph, full bleed, nothing else to hide behind.',
    panels: [{ x: 0, y: 0, w: 1, h: 1, role: 'lead' }],
    titleZone: 'bottom',
  },
  {
    id: 'duo-split',
    name: 'Duo Split',
    blurb: 'Two portraits facing off across a hard vertical cut.',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 1, role: 'lead' },
      { x: 0.5, y: 0, w: 0.5, h: 1, role: 'supporting' },
    ],
    titleZone: 'bottom',
  },
  {
    id: 'trio-strip',
    name: 'Trio Strip',
    blurb: 'Three vertical strips — the classic ensemble wall.',
    panels: [
      { x: 0, y: 0, w: 0.34, h: 1, role: 'supporting' },
      { x: 0.34, y: 0, w: 0.32, h: 1, role: 'lead' },
      { x: 0.66, y: 0, w: 0.34, h: 1, role: 'supporting' },
    ],
    titleZone: 'top',
  },
  {
    id: 'quad-grid',
    name: 'Quad Grid',
    blurb: 'Four equal frames, two over two.',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5, role: 'lead' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, role: 'supporting' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, role: 'location' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, role: 'supporting' },
    ],
    titleZone: 'bottom',
  },
  {
    id: 'hero-and-duo',
    name: 'Hero + Duo',
    blurb: 'A wide hero frame with two detail crops stacked beside it.',
    panels: [
      { x: 0, y: 0, w: 0.64, h: 1, role: 'lead' },
      { x: 0.64, y: 0, w: 0.36, h: 0.5, role: 'supporting' },
      { x: 0.64, y: 0.5, w: 0.36, h: 0.5, role: 'location' },
    ],
    titleZone: 'bottom',
  },
  {
    id: 'slash-duo',
    name: 'Slash Duo',
    blurb: 'Two frames split by a diagonal — instant motion.',
    panels: [
      { x: 0, y: 0, w: 1, h: 1, role: 'lead', slash: -0.16 },
      { x: 0, y: 0, w: 1, h: 1, role: 'supporting', slash: -0.16, second: true },
    ],
    titleZone: 'top',
  },
  {
    id: 'banner-cast',
    name: 'Banner Cast',
    blurb: 'A wide establishing frame over three cast frames.',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.58, role: 'location' },
      { x: 0, y: 0.58, w: 0.34, h: 0.42, role: 'lead' },
      { x: 0.34, y: 0.58, w: 0.32, h: 0.42, role: 'supporting' },
      { x: 0.66, y: 0.58, w: 0.34, h: 0.42, role: 'supporting' },
    ],
    titleZone: 'top',
  },
  {
    id: 'mosaic-five',
    name: 'Mosaic Five',
    blurb: 'One hero, four fragments — the full poster wall.',
    panels: [
      { x: 0, y: 0, w: 0.58, h: 0.62, role: 'lead' },
      { x: 0.58, y: 0, w: 0.42, h: 0.31, role: 'supporting' },
      { x: 0.58, y: 0.31, w: 0.42, h: 0.31, role: 'location' },
      { x: 0, y: 0.62, w: 0.5, h: 0.38, role: 'supporting' },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38, role: 'location' },
    ],
    titleZone: 'bottom',
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Which layout the director picks for a given cast of photographs.
export function layoutForCast(photoCount, hasFace) {
  if (photoCount <= 1) return hasFace ? 'hero-and-duo' : 'solo-hero';
  if (photoCount === 2) return 'duo-split';
  if (photoCount === 3) return 'trio-strip';
  if (photoCount === 4) return 'banner-cast';
  return 'mosaic-five';
}
