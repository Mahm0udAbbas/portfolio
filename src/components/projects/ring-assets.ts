"use client";

import type { Project } from "@/content/site";

/** Card size in world units. The face textures share this aspect ratio. */
export const CARD_W = 2.4;
export const CARD_H = 3;
export const CARD_RADIUS = 0.16;

const FACE_W = 960;
const FACE_H = 1200;
const PX = FACE_W / CARD_W; // texture pixels per world unit

export const FONT_URL = "/fonts/geist-black.typeface.json";

export type RingAssets = {
  /** three.js typeface JSON for the 3D "PROJECTS" word (Geist Black, uppercase subset). */
  font: unknown;
  fronts: HTMLCanvasElement[];
  backs: HTMLCanvasElement[];
  /** Object URLs of the front faces, for the DOM stand-in the overlay flips open. */
  frontUrls: string[];
};

const C = {
  surface: "#ffffff",
  surface2: "#f6f7f9",
  bg: "#eef0f4",
  line: "#d9dde5",
  fg: "#111318",
  muted: "#646a78",
  accent: "#ff9a5c",
  accentStrong: "#c2410c",
};

const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Greedy word wrap; the last allowed line gets an ellipsis if text is left over. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(`${last}…`).width > maxW && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
      lines[maxLines - 1] = `${last}…`;
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function canvas() {
  const c = document.createElement("canvas");
  c.width = FACE_W;
  c.height = FACE_H;
  return [c, c.getContext("2d")!] as const;
}

function drawFront(p: Project, index: number, img: HTMLImageElement | null, sans: string, mono: string) {
  const [c, ctx] = canvas();
  const pad = 56;
  const inner = FACE_W - pad * 2;

  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  // Hairline border, inset so the rounded card geometry doesn't clip it.
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, FACE_W - 3, FACE_H - 3, CARD_RADIUS * PX - 1.5);
  ctx.stroke();

  // Index + meta row
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 30px ${mono}`;
  ctx.fillStyle = C.accentStrong;
  ctx.fillText(String(index + 1).padStart(2, "0"), pad, pad + 30);
  ctx.font = `400 26px ${mono}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.fillText(`${p.year} · ${p.role}`, FACE_W - pad, pad + 30);
  ctx.textAlign = "left";

  // Browser frame with the live-site capture
  const fy = 124;
  const fh = 520;
  const bar = 46;
  ctx.save();
  roundRect(ctx, pad, fy, inner, fh, 26);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.clip();
  if (img) {
    const area = { x: pad, y: fy + bar, w: inner, h: fh - bar };
    const s = Math.max(area.w / img.naturalWidth, area.h / img.naturalHeight);
    ctx.drawImage(img, area.x, area.y, img.naturalWidth * s, img.naturalHeight * s); // top-aligned cover
  }
  ctx.fillStyle = C.surface2;
  ctx.fillRect(pad, fy, inner, bar);
  ctx.fillStyle = C.line;
  ctx.fillRect(pad, fy + bar - 2, inner, 2);
  for (let d = 0; d < 3; d++) {
    ctx.beginPath();
    ctx.arc(pad + 28 + d * 22, fy + bar / 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `400 20px ${mono}`;
  ctx.fillStyle = C.muted;
  const host = p.links.live ? new URL(p.links.live).host : `${p.slug}.dev`;
  ctx.fillText(host, pad + 110, fy + bar / 2 + 7);
  ctx.restore();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  roundRect(ctx, pad, fy, inner, fh, 26);
  ctx.stroke();

  // Title + tagline
  let y = fy + fh + 112;
  ctx.font = `700 96px ${sans}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(p.title, pad, y);
  y += 62;
  ctx.font = `400 34px ${sans}`;
  ctx.fillStyle = C.muted;
  for (const line of wrap(ctx, p.tagline, inner, 2)) {
    ctx.fillText(line, pad, y);
    y += 46;
  }

  // Stack chips (one row, as many as fit)
  y += 14;
  ctx.font = `400 22px ${mono}`;
  let x = pad;
  for (const s of p.stack) {
    const w = ctx.measureText(s).width + 32;
    if (x + w > FACE_W - pad) break;
    roundRect(ctx, x, y, w, 46, 10);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.fillText(s, x + 16, y + 30);
    x += w + 12;
  }

  // Call to action
  ctx.font = `500 28px ${mono}`;
  ctx.fillStyle = C.accentStrong;
  ctx.fillText("open project ↗", pad, FACE_H - pad);

  return c;
}

function drawBack(p: Project, index: number, sans: string, mono: string) {
  const [c, ctx] = canvas();
  ctx.fillStyle = C.surface2;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, FACE_W - 3, FACE_H - 3, CARD_RADIUS * PX - 1.5);
  ctx.stroke();

  // Faint grid, like the placeholder previews
  ctx.strokeStyle = "rgba(17,19,24,0.05)";
  ctx.lineWidth = 2;
  for (let g = 48; g < FACE_W; g += 48) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, FACE_H);
    ctx.stroke();
  }
  for (let g = 48; g < FACE_H; g += 48) {
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(FACE_W, g);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.font = `800 380px ${sans}`;
  ctx.fillStyle = C.line;
  ctx.fillText(String(index + 1).padStart(2, "0"), FACE_W / 2, FACE_H / 2 + 120);
  ctx.font = `500 34px ${mono}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(`~/projects/${p.slug}`, FACE_W / 2, FACE_H / 2 + 230);
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(FACE_W / 2, FACE_H / 2 - 300, 14, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const heroShot = (p: Project) => p.media?.type === "image" ? p.media.src : p.screens?.desktop.src.replace(/desktop\.webp$/, "desktop-hero.webp");

/** Font, card faces (drawn once, shared by the 3D cards and their DOM stand-ins). */
export async function loadRingAssets(projects: Project[]): Promise<RingAssets> {
  const sans = cssVar("--font-geist-sans", "ui-sans-serif, system-ui, sans-serif");
  const mono = cssVar("--font-jetbrains-mono", "ui-monospace, monospace");
  const [font, images] = await Promise.all([
    fetch(FONT_URL).then((r) => r.json()),
    Promise.all(projects.map((p) => (heroShot(p) ? loadImage(heroShot(p)!) : Promise.resolve(null)))),
    document.fonts.load(`700 96px ${sans}`),
    document.fonts.load(`400 34px ${sans}`),
    document.fonts.load(`500 28px ${mono}`),
  ]);

  const fronts = projects.map((p, i) => drawFront(p, i, images[i], sans, mono));
  const backs = projects.map((p, i) => drawBack(p, i, sans, mono));
  const frontUrls = await Promise.all(
    fronts.map(
      (c) => new Promise<string>((resolve) => c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : c.toDataURL()), "image/webp", 0.92)),
    ),
  );
  return { font, fronts, backs, frontUrls };
}
